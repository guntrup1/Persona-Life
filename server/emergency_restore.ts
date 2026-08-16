import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI not set");

const userDataBackupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});
const userDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});
const userSchema = new mongoose.Schema({ email: String });
const dayNoteSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  noteId: String, date: String, title: String, content: String, noteType: String, ideaCategory: String,
});
const tradingNoteSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  noteId: String, date: String, title: String, text: String, asset: String, tag: String, timeframe: String,
  time: String, isTradingIdea: Boolean, tradingIdeaDone: Boolean,
});
const taskSchema2 = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, taskId: String, name: String, date: String, category: String, completed: Boolean });
const goalSchema2 = new mongoose.Schema({ userId: mongoose.Schema.Types.ObjectId, goalId: String, title: String, type: String, status: String });

const UserDataBackup = mongoose.model("UserDataBackup", userDataBackupSchema);
const UserData = mongoose.model("UserData", userDataSchema);
const User = mongoose.model("User", userSchema);
const DayNote = mongoose.model("DayNote", dayNoteSchema);
const TradingNote = mongoose.model("TradingNote", tradingNoteSchema);
const Task2 = mongoose.model("Task", taskSchema2);
const Goal2 = mongoose.model("Goal", goalSchema2);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const users = await User.find({}).lean();
  console.log(`Found ${users.length} user(s):`);
  for (const u of users) {
    console.log(`  - ${u.email} (id: ${u._id})`);
  }

  for (const u of users) {
    const uid = u._id;
    console.log(`\n=== USER: ${u.email} ===`);

    const ud = await UserData.findOne({ userId: uid }).lean();
    const data = (ud && ud.data) ? ud.data : {};
    console.log(`\n[UserData.data] Keys: ${Object.keys(data).join(", ") || "(empty)"}`);
    console.log(`  todayTasks: ${(data.todayTasks || []).length}`);
    console.log(`  dayNotes: ${(data.dayNotes || []).length}`);
    console.log(`  tradingNotes: ${(data.tradingNotes || []).length}`);
    console.log(`  goals: ${(data.goals || []).length}`);
    console.log(`  botVoiceHistory: ${(data.botVoiceHistory || []).length}`);

    const tasks = await Task2.find({ userId: uid }).lean();
    const goals = await Goal2.find({ userId: uid }).lean();
    const notes = await DayNote.find({ userId: uid }).lean();
    const tNotes = await TradingNote.find({ userId: uid }).lean();

    console.log(`\n[New Collections]`);
    console.log(`  Task: ${tasks.length}`);
    console.log(`  Goal: ${goals.length}`);
    console.log(`  DayNote: ${notes.length}`);
    console.log(`  TradingNote: ${tNotes.length}`);

    if (notes.length > 0) {
      console.log(`\n  DayNotes (first 5):`);
      for (const n of notes.slice(0, 5)) {
        console.log(`    - [${n.date}] ${n.noteType} "${n.title || (n.content ? n.content.slice(0, 50) : "")}"`);
      }
    }

    const backups = await UserDataBackup.find({ userId: uid }).sort({ createdAt: -1 }).lean();
    console.log(`\n[UserDataBackup] ${backups.length} backup(s) found`);
    for (const b of backups) {
      const bd = b.data || {};
      const bDate = b.createdAt ? new Date(b.createdAt).toISOString() : "unknown";
      console.log(`  Backup [${bDate}]:`);
      console.log(`    dayNotes: ${(bd.dayNotes || []).length}`);
      console.log(`    tradingNotes: ${(bd.tradingNotes || []).length}`);
      console.log(`    todayTasks: ${(bd.todayTasks || []).length}`);
      console.log(`    goals: ${(bd.goals || []).length}`);
    }

    // AUTO RESTORE: if DayNote collection is empty but backup has notes
    if (notes.length === 0 && backups.length > 0) {
      const bestBackup = backups[0];
      const bd = bestBackup.data || {};
      const dayNotesToRestore = bd.dayNotes || [];
      const tradingNotesToRestore = bd.tradingNotes || [];

      if (dayNotesToRestore.length > 0 || tradingNotesToRestore.length > 0) {
        const bDate = bestBackup.createdAt ? new Date(bestBackup.createdAt).toISOString() : "unknown";
        console.log(`\n🔥 AUTO-RESTORE from backup [${bDate}]`);

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
      } else {
        console.log(`  ⚠️  Backups exist but have no dayNotes or tradingNotes to restore`);
      }
    } else if (notes.length > 0) {
      console.log(`\n  ✅ DayNote collection has ${notes.length} items — no restore needed`);
    }
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch(err => { console.error(err); process.exit(1); });
