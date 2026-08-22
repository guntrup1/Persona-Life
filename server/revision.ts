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

// Record a delete tombstone so removals propagate to other devices. The client
// merge prunes any local item whose id is present in UserData.deletedIds, which
// is returned by /api/sync/init. Capped (rolling) to avoid unbounded growth.
export async function recordDeletion(userId: string, id: string): Promise<void> {
  try {
    await mongoose.model("UserData").updateOne(
      { userId },
      {
        $push: { deletedIds: { $each: [id], $slice: -500 } },
        $set: { updatedAt: new Date() },
        $inc: { revision: 1 },
      },
      { upsert: true }
    );
  } catch (e: any) {
    console.error("[revision] recordDeletion error:", e?.message || e);
  }
}
