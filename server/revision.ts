import mongoose from "mongoose";

// Central revision bump: every write to any strict collection (tasks, goals,
// notes, ...) increments the user's UserData.revision so the client's cheap
// /api/user/data/version poll can detect "something changed" without
// re-fetching the full data dump every 30 seconds.
export async function bumpRevision(userId: string): Promise<void> {
  try {
    await mongoose.model("UserData").updateOne(
      { userId },
      { $set: { updatedAt: new Date() }, $inc: { revision: 1 } },
      { upsert: true }
    );
  } catch (e: any) {
    console.error("[revision] bump error:", e.message);
  }
}
