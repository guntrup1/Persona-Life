import { User } from "./mongodb";

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

    // Format Start and End times
    let start: any = {};
    let end: any = {};

    if (task.date && task.startTime && !task.noDeadline) {
      const startTimeStr = `${task.date}T${task.startTime}:00`;
      const endTimeStr = task.endTime ? `${task.date}T${task.endTime}:00` : `${task.date}T${task.startTime}:00`;

      // ISO String format
      start = { dateTime: new Date(startTimeStr).toISOString() };
      const endD = new Date(endTimeStr);
      if (!task.endTime) endD.setHours(endD.getHours() + 1);
      end = { dateTime: endD.toISOString() };
    } else {
      // All day event
      start = { date: task.date || new Date().toISOString().split("T")[0] };
      const nextDay = new Date(task.date || new Date());
      nextDay.setDate(nextDay.getDate() + 1);
      end = { date: nextDay.toISOString().split("T")[0] };
    }

    const eventBody = {
      summary: task.name,
      description: `${task.description || ""}\n\n📌 Сфера: ${task.category || "General"}\n🌐 Синхронизировано из Trade Persona`,
      start,
      end,
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 30 }],
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
