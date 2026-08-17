import mongoose from "mongoose";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback";

// ── 1. Generate OAuth2 Auth URL ──
export function getGoogleAuthUrl(state = ""): string {
  const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
  const options = {
    redirect_uri: GOOGLE_REDIRECT_URI,
    client_id: GOOGLE_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    state,
  };

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

// ── 2. Exchange authorization code for tokens ──
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const url = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${data.error_description || data.error || response.statusText}`);
  }

  return data;
}

// ── 3. Refresh access token using refresh_token ──
export async function getAccessTokenFromRefresh(refreshToken: string): Promise<string> {
  const url = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${data.error_description || data.error || response.statusText}`);
  }

  return data.access_token;
}

// ── 4. Sync Task to Google Calendar (Insert / Patch) ──
export async function syncTaskToGoogleCalendar(
  userId: string,
  task: {
    id: string;
    name: string;
    description?: string;
    date: string; // YYYY-MM-DD
    startTime?: string; // HH:MM
    endTime?: string; // HH:MM
    noDeadline?: boolean;
    category?: string;
    googleCalendarEventId?: string;
  }
): Promise<string | null> {
  try {
    const user = await User.findById(userId);
    if (!user || !user.googleRefreshToken || !user.googleCalendarConnected) {
      return null;
    }

    const accessToken = await getAccessTokenFromRefresh(user.googleRefreshToken);
    const calendarId = user.googleCalendarId || "primary";

    // Fetch user utcOffset to construct exact localized ISO string
    const { UserSettings } = await import("./mongodb");
    const userSettings = await UserSettings.findOne({ userId });
    const utcOffset = userSettings?.utcOffset ?? 2;

    const sign = utcOffset >= 0 ? "+" : "-";
    const absOffset = Math.abs(utcOffset);
    const offsetHours = String(Math.floor(absOffset)).padStart(2, "0");
    const offsetMins = String(Math.round((absOffset % 1) * 60)).padStart(2, "0");
    const offsetStr = `${sign}${offsetHours}:${offsetMins}`;

    // Format Start and End times
    let start: any = {};
    let end: any = {};

    if (task.date && task.startTime && !task.noDeadline) {
      const startIso = `${task.date}T${task.startTime}:00${offsetStr}`;
      let endIso: string;
      if (task.endTime) {
        endIso = `${task.date}T${task.endTime}:00${offsetStr}`;
      } else {
        const [h, m] = task.startTime.split(":").map(Number);
        const endH = String((h + 1) % 24).padStart(2, "0");
        endIso = `${task.date}T${endH}:${String(m).padStart(2, "0")}:00${offsetStr}`;
      }
      start = { dateTime: startIso };
      end = { dateTime: endIso };
    } else {
      // All day event
      start = { date: task.date || new Date().toISOString().split("T")[0] };
      const nextDay = new Date(task.date || new Date());
      nextDay.setDate(nextDay.getDate() + 1);
      end = { date: nextDay.toISOString().split("T")[0] };
    }

    const minutesList: number[] = Array.isArray((user as any).googleReminderMinutes)
      ? (user as any).googleReminderMinutes
      : typeof (user as any).googleReminderMinutes === "number"
      ? [(user as any).googleReminderMinutes]
      : [30];

    const overrides = minutesList.map((m: number) => ({ method: "popup", minutes: m }));

    const eventBody = {
      summary: task.name,
      description: `${task.description || ""}\n\n📌 Сфера: ${task.category || "General"}\n🌐 Синхронизировано из Trade Persona`,
      start,
      end,
      reminders: {
        useDefault: false,
        overrides: overrides.length > 0 ? overrides : [{ method: "popup", minutes: 30 }],
      },
    };

    let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    let method = "POST";

    if (task.googleCalendarEventId) {
      url += `/${task.googleCalendarEventId}`;
      method = "PATCH";
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[google-calendar] Sync event failed:", data);
      return null;
    }

    return data.id || task.googleCalendarEventId || null;
  } catch (err) {
    console.error("[google-calendar] Error syncing task:", err);
    return null;
  }
}

// ── 5. Delete Task Event from Google Calendar ──
export async function deleteGoogleCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  try {
    const user = await User.findById(userId);
    if (!user || !user.googleRefreshToken || !eventId) return false;

    const accessToken = await getAccessTokenFromRefresh(user.googleRefreshToken);
    const calendarId = user.googleCalendarId || "primary";

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return res.ok || res.status === 404;
  } catch (err) {
    console.error("[google-calendar] Delete event error:", err);
    return false;
  }
}

// ── 6. 2-Way Sync: Pull Events from Google Calendar and update tasks in MongoDB ──
export async function pullAndSyncGoogleCalendar(userId: string): Promise<{ synced: number; deleted: number }> {
  try {
    const { UserData } = await import("./mongodb");
    const user = await User.findById(userId);
    if (!user || !user.googleRefreshToken || !user.googleCalendarConnected) {
      return { synced: 0, deleted: 0 };
    }

    const accessToken = await getAccessTokenFromRefresh(user.googleRefreshToken);
    const calendarId = user.googleCalendarId || "primary";

    // Fetch events from Google Calendar for the last 30 days and future 90 days
    const timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&showDeleted=true`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      console.error("[google-calendar] Pull events failed:", await res.text());
      return { synced: 0, deleted: 0 };
    }

    const data = await res.json();
    const gEvents: Array<any> = data.items || [];
    const gEventsMap = new Map<string, any>();
    for (const ge of gEvents) {
      gEventsMap.set(ge.id, ge);
    }

    const userData = await UserData.findOne({ userId });
    if (!userData) return { synced: 0, deleted: 0 };

    const existingData = (userData.data as any) || {};
    const tasks: any[] = Array.isArray(existingData.todayTasks) ? existingData.todayTasks : [];

    let syncedCount = 0;
    let deletedCount = 0;

    const updatedTasks = tasks.filter(task => {
      if (!task.googleCalendarEventId) return true; // Keep local tasks without google sync

      const gEvent = gEventsMap.get(task.googleCalendarEventId);
      // If deleted in Google Calendar -> remove from Trade Persona
      if (!gEvent || gEvent.status === "cancelled") {
        deletedCount++;
        return false;
      }

      // If updated in Google Calendar -> update task title and dates
      if (gEvent.summary && gEvent.summary !== task.name) {
        task.name = gEvent.summary;
        syncedCount++;
      }

      if (gEvent.start?.date) {
        task.date = gEvent.start.date;
        task.noDeadline = true;
      } else if (gEvent.start?.dateTime) {
        const d = new Date(gEvent.start.dateTime);
        task.date = d.toISOString().split("T")[0];
        task.startTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        task.noDeadline = false;
        if (gEvent.end?.dateTime) {
          const endD = new Date(gEvent.end.dateTime);
          task.endTime = `${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`;
        }
        syncedCount++;
      }

      return true;
    });

    if (syncedCount > 0 || deletedCount > 0) {
      await UserData.findOneAndUpdate(
        { userId },
        { data: { ...existingData, todayTasks: updatedTasks }, updatedAt: new Date() }
      );
    }

    return { synced: syncedCount, deleted: deletedCount };
  } catch (err) {
    console.error("[google-calendar] pullAndSyncGoogleCalendar error:", err);
    return { synced: 0, deleted: 0 };
  }
}
