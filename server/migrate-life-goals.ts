import mongoose from "mongoose";

// One-time migration: fix goals created by the Telegram bot with type="life"
// (the frontend only shows type "week" | "month" | "year").
//
// Safe & idempotent:
//  - Only touches documents with type === "life"
//  - Never deletes anything, only remaps the "type" field
//  - Run with --dry-run to preview without writing
//
// Usage:
//   $env:MONGODB_URI="mongodb://..." ; node node_modules/tsx/dist/cli.mjs server/migrate-life-goals.ts --dry-run
//   $env:MONGODB_URI="mongodb://..." ; node node_modules/tsx/dist/cli.mjs server/migrate-life-goals.ts

const MONGODB_URI: string = process.env.MONGODB_URI || "";
if (!MONGODB_URI) throw new Error("MONGODB_URI not set");

const goalSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  goalId: String,
  type: String,
  title: String,
  timeLimitType: String,
  category: String,
  status: String,
});
const Goal = mongoose.model("Goal", goalSchema);

const dryRun = process.argv.includes("--dry-run");

function mapType(timeLimitType?: string): string {
  switch (timeLimitType) {
    case "week": return "week";
    case "month": return "month";
    case "year": return "year";
    case "life":
    case "custom_date": return "year";
    default: return "month";
  }
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const goals = await Goal.find({ type: "life" }).lean();
  console.log(`Found ${goals.length} goal(s) with type="life"\n`);

  if (goals.length === 0) {
    console.log("Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  for (const g of goals) {
    const newType = mapType((g as any).timeLimitType);
    if (dryRun) {
      console.log(`  [dry-run] "${(g as any).title}" (timeLimitType=${(g as any).timeLimitType || "?"}) → type "${(g as any).type}" → "${newType}"`);
    } else {
      await Goal.updateOne({ _id: g._id }, { $set: { type: newType } });
      console.log(`  ✅ "${(g as any).title}" → type "${newType}"`);
      updated++;
    }
  }

  if (dryRun) {
    console.log("\nDry-run finished — no changes written. Run WITHOUT --dry-run to apply.");
  } else {
    console.log(`\nDone. Updated ${updated} goal(s). Reload the app to see them.`);
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
