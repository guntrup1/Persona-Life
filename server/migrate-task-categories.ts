import mongoose from "mongoose";
import { mapToLifeArea } from "./life-areas";

// One-time migration: remap invalid task/goal "category" values to the project's
// canonical life areas (Body, Mind, Hard Skills, Soft Skills, Creativity, Mission, Finance).
// Older bot/audio flows could save hallucinated spheres like "Health", "Работа", etc.
//
// Safe & idempotent:
//  - Only touches documents whose category is NOT already canonical
//  - Never deletes anything, only remaps the "category" field
//  - Run with --dry-run to preview without writing
//
// Usage:
//   $env:MONGODB_URI="mongodb://..." ; node node_modules/tsx/dist/cli.mjs server/migrate-task-categories.ts --dry-run
//   $env:MONGODB_URI="mongodb://..." ; node node_modules/tsx/dist/cli.mjs server/migrate-task-categories.ts

const MONGODB_URI: string = process.env.MONGODB_URI || "";
if (!MONGODB_URI) throw new Error("MONGODB_URI not set");

const CANONICAL = new Set(["Body", "Mind", "Hard Skills", "Soft Skills", "Creativity", "Mission", "Finance"]);

const itemSchema = new mongoose.Schema({
  category: String,
  title: String,
  name: String,
});
const Task = mongoose.model("Task", itemSchema);
const Goal = mongoose.model("Goal", itemSchema);

const dryRun = process.argv.includes("--dry-run");

function remap(doc: any): string | null {
  const rawCat = String(doc.category || "").trim();
  if (CANONICAL.has(rawCat)) return null; // already valid — keep

  const title = String(doc.title || doc.name || "").trim();
  // Prefer the title: it's a much stronger signal than junk categories like "сахарная диета".
  // Treat "Mind" as the generic fallback so we fall through to the category mapping.
  const titleCat = title ? mapToLifeArea(title) : null;
  if (titleCat && titleCat !== "Mind") return titleCat;

  const catCat = rawCat ? mapToLifeArea(rawCat) : null;
  return catCat || "Mind";
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  let fixedTasks = 0;
  let fixedGoals = 0;

  const tasks = await Task.find({}).lean();
  console.log(`Tasks: ${tasks.length} total`);
  for (const t of tasks) {
    const newCat = remap(t);
    if (!newCat) continue;
    const label = t.name || t.title || t._id;
    if (dryRun) {
      console.log(`  [dry-run] Task "${label}" → category "${t.category}" → "${newCat}"`);
      fixedTasks++;
    } else {
      await Task.updateOne({ _id: t._id }, { $set: { category: newCat } });
      console.log(`  ✅ Task "${label}" → "${newCat}"`);
      fixedTasks++;
    }
  }

  const goals = await Goal.find({}).lean();
  console.log(`\nGoals: ${goals.length} total`);
  for (const g of goals) {
    const newCat = remap(g);
    if (!newCat) continue;
    const label = g.title || g._id;
    if (dryRun) {
      console.log(`  [dry-run] Goal "${label}" → category "${g.category}" → "${newCat}"`);
      fixedGoals++;
    } else {
      await Goal.updateOne({ _id: g._id }, { $set: { category: newCat } });
      console.log(`  ✅ Goal "${label}" → "${newCat}"`);
      fixedGoals++;
    }
  }

  if (dryRun) {
    console.log(`\nDry-run finished — ${fixedTasks} task(s) + ${fixedGoals} goal(s) to fix. Run WITHOUT --dry-run to apply.`);
  } else {
    console.log(`\nDone. Fixed ${fixedTasks} task(s) and ${fixedGoals} goal(s). Reload the app to see them.`);
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });