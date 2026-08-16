// Emergency diagnostic + data restore script
// Run with: node --require dotenv/config server/emergency_restore.mjs
// Or via tsx: npx tsx server/emergency_restore.ts

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI not set");

const userDataBackupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});
const userDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});
const userSchema = new mongoose.Schema({ email: String });
const dayNoteSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  noteId: String,
  date: String,
  title: String,
  content: String,
  noteType: String,
  ideaCategory: String,
});
const tradingNoteSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  noteId: String,
  date: String,
  title: String,
  text: String,
  asset: String,
});

const UserDataBackup = mongoose.model("UserDataBackup", userDataBackupSchema);
const UserData = mongoose.model("UserData", userDataSchema);
const User = mongoose.model("User", userSchema);
const DayNote = mongoose.model("DayNote", dayNoteSchema);
const TradingNote = mongoose.model("TradingNote", tradingNoteSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  // List all users
  const users = await User.find({}).lean();
  console.log(`Found ${users.length} user(s):`);
  for (const u of users) {
    console.log(`  - ${u.email} (id: ${u._id})`);
  }
  console.log();

  for (const u of users) {
    const uid = u._id;
    console.log(`\n=== USER: ${u.email} ===`);

    // Check current UserData
    const ud = await UserData.findOne({ userId: uid }).lean() as any;
    const data = ud?.data || {};
    console.log(`\n[UserData.data] Keys: ${Object.keys(data).join(", ") || "(empty)"}`);
    console.log(`  todayTasks: ${(data.todayTasks || []).length}`);
    console.log(`  dayNotes: ${(data.dayNotes || []).length}`);
    console.log(`  tradingNotes: ${(data.tradingNotes || []).length}`);
    console.log(`  goals: ${(data.goals || []).length}`);
    console.log(`  botVoiceHistory: ${(data.botVoiceHistory || []).length}`);

    // Check new collections
    const tasks = await (mongoose.model("Task", new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, taskId: String, name: String })) as any).find({ userId: uid }).lean().catch(() => []);
    const goals = await (mongoose.model("Goal", new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, goalId: String, title: String })) as any).find({ userId: uid }).lean().catch(() => []);
    const notes = await DayNote.find({ userId: uid }).lean();
    const tNotes = await TradingNote.find({ userId: uid }).lean();

    console.log(`\n[New Collections]`);
    console.log(`  Task collection: ${tasks.length}`);
    console.log(`  Goal collection: ${goals.length}`);
    console.log(`  DayNote collection: ${notes.length}`);
    console.log(`  TradingNote collection: ${tNotes.length}`);

    // List dayNotes
    if (notes.length > 0) {
      console.log(`\n  DayNotes (first 5):`);
      for (const n of notes.slice(0, 5) as any[]) {
        console.log(`    - [${n.date}] ${n.noteType} "${n.title || n.content?.slice(0, 40)}"`);
      }
    }

    // Check backups
    const backups = await UserDataBackup.find({ userId: uid }).sort({ createdAt: -1 }).lean() as any[];
    console.log(`\n[UserDataBackup] ${backups.length} backup(s) found`);
    for (const b of backups) {
      const bd = b.data || {};
      console.log(`  Backup [${b.createdAt?.toISOString?.()}]:`);
      console.log(`    todayTasks: ${(bd.todayTasks || []).length}`);
      console.log(`    dayNotes: ${(bd.dayNotes || []).length}`);
      console.log(`    tradingNotes: ${(bd.tradingNotes || []).length}`);
      console.log(`    goals: ${(bd.goals || []).length}`);
    }

    // If DayNote collection is empty but backups have notes => auto restore
    if (notes.length === 0 && backups.length > 0) {
      const bestBackup = backups[0];
      const bd = bestBackup.data || {};
      const dayNotesToRestore = bd.dayNotes || [];
      const tradingNotesToRestore = bd.tradingNotes || [];

      if (dayNotesToRestore.length > 0 || tradingNotesToRestore.length > 0) {
        console.log(`\n🔥 AUTO-RESTORE: DayNote collection empty, restoring from backup [${bestBackup.createdAt?.toISOString?.()}]`);
        
        for (const n of dayNotesToRestore) {
          await DayNote.findOneAndUpdate(
            { userId: uid, noteId: n.id },
            { ...n, noteId: n.id, userId: uid },
            { upsert: true }
          );
        }
        console.log(`  ✅ Restored ${dayNotesToRestore.length} dayNotes`);

        for (const n of tradingNotesToRestore) {
          await TradingNote.findOneAndUpdate(
            { userId: uid, noteId: n.id },
            { ...n, noteId: n.id, userId: uid },
            { upsert: true }
          );
        }
        console.log(`  ✅ Restored ${tradingNotesToRestore.length} tradingNotes`);
      }
    }
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch(err => { console.error(err); process.exit(1); });
