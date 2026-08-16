const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Manually parse .env
const envPath = path.join(__dirname, '..', '.env');
const envFile = fs.readFileSync(envPath, 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.replace(/\\n/gm, '\n');
    }
    value = value.replace(/(^['"]|['"]$)/g, '').trim();
    process.env[key] = value;
  }
});

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

const UserDataBackup = mongoose.model("UserDataBackup", userDataBackupSchema);
const UserData = mongoose.model("UserData", userDataSchema);
const User = mongoose.model("User", userSchema);
const DayNote = mongoose.model("DayNote", dayNoteSchema);
const TradingNote = mongoose.model("TradingNote", tradingNoteSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB\n");

  const users = await User.find({}).lean();
  console.log(`Found ${users.length} user(s):`);

  for (const u of users) {
    const uid = u._id;
    console.log(`\n=== USER: ${u.email} ===`);

    const notes = await DayNote.find({ userId: uid }).lean();
    const tNotes = await TradingNote.find({ userId: uid }).lean();
    
    console.log(`\n[New Collections] DayNote: ${notes.length} | TradingNote: ${tNotes.length}`);

    const backups = await UserDataBackup.find({ userId: uid }).sort({ createdAt: -1 }).lean();
    console.log(`[UserDataBackup] ${backups.length} backup(s) found`);
    
    // Auto-restore logic
    if (backups.length > 0) {
      // Find the best backup (the one with the most notes)
      let bestBackup = backups[0];
      let maxNotes = 0;
      
      for (const b of backups) {
        const bd = b.data || {};
        const count = (bd.dayNotes || []).length + (bd.tradingNotes || []).length;
        if (count > maxNotes) {
          maxNotes = count;
          bestBackup = b;
        }
      }

      const bd = bestBackup.data || {};
      const dayNotesToRestore = bd.dayNotes || [];
      const tradingNotesToRestore = bd.tradingNotes || [];

      if (dayNotesToRestore.length > 0 || tradingNotesToRestore.length > 0) {
        const bDate = bestBackup.createdAt ? new Date(bestBackup.createdAt).toISOString() : "unknown";
        console.log(`\n🔥 AUTO-RESTORE from backup [${bDate}] which has ${dayNotesToRestore.length} dayNotes and ${tradingNotesToRestore.length} tradingNotes`);

        let restoredDayNotes = 0;
        for (const n of dayNotesToRestore) {
          // Only restore if not already there, or overwrite to be safe
          await DayNote.findOneAndUpdate(
            { userId: uid, noteId: n.id },
            { ...n, noteId: n.id, userId: uid },
            { upsert: true }
          );
          restoredDayNotes++;
        }
        console.log(`  ✅ Restored ${restoredDayNotes} dayNotes`);

        let restoredTradingNotes = 0;
        for (const n of tradingNotesToRestore) {
          await TradingNote.findOneAndUpdate(
            { userId: uid, noteId: n.id },
            { ...n, noteId: n.id, userId: uid },
            { upsert: true }
          );
          restoredTradingNotes++;
        }
        console.log(`  ✅ Restored ${restoredTradingNotes} tradingNotes`);
      } else {
        console.log(`  ⚠️  Backups exist but have no dayNotes or tradingNotes to restore`);
      }
    }
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch(err => { console.error(err); process.exit(1); });
