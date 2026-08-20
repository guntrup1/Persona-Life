import mongooseModule from "mongoose";
const mongoose = (mongooseModule as any).default || mongooseModule;

const MONGODB_URI: string = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI environment variable is not set");
}

export async function connectMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB Atlas");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verifyToken: { type: String, default: null, index: true},
  verifyTokenExpires: { type: Date, default: null },
  telegramId: { type: String, default: null, unique: true, sparse: true },
  telegramLinkToken: { type: String, default: null },
  telegramLinkExpires: { type: Date, default: null },
  geminiApiKey: { type: String, default: null },
  groqApiKey: { type: String, default: null },
  botSetupStep: { type: String, default: null }, // null | 'awaiting_groq' | 'awaiting_gemini' | 'done'
  botRecordMode: { type: String, default: "notes" }, // 'tasks' | 'goals' | 'notes' | 'brainstorm'
  googleRefreshToken: { type: String, default: null },
  googleCalendarConnected: { type: Boolean, default: false },
  googleCalendarId: { type: String, default: "primary" },
  googleReminderMinutes: { type: [Number], default: [30] },
  personaMemory: { type: String, default: null }, // encrypted JSON: {boli[], oshibki[], zadachi[], zhelaniya[]}
}, { timestamps: true });

const userDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
  revision: { type: Number, default: 0 },
  migrated: { type: Boolean, default: false }, // legacy blob → strict collections, once
});

const userDataBackupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

// ── Brainstorm Session Schema ──
const BrainstormSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  theme: { type: String, required: true },
  prompt: { type: String, required: true },
  sourceNoteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProcessedAudio' }],
  // snake_case fields — match frontend BrainstormSession interface exactly
  executive_summary: { type: String, default: "" },
  key_insights: [{ type: String }],
  patterns_found: [{ type: String }],
  contradictions: [{ type: String }],
  action_items: [{
    task: { type: String },
    priority: { type: String, default: "medium" },
  }],
  newIdeas: [{ type: String }],
  questions_raised: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
}, { strict: false }); // strict: false allows any extra fields without error


export const User = mongoose.model("User", userSchema);
export const UserData = mongoose.model("UserData", userDataSchema);
export const UserDataBackup = mongoose.model("UserDataBackup", userDataBackupSchema);
export const BrainstormSession = mongoose.model("BrainstormSession", BrainstormSessionSchema);
const resetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});

export const ResetToken = mongoose.model("ResetToken", resetTokenSchema);
const userSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  utcOffset: { type: Number, default: 1 },
  geminiApiKey: { type: String, default: null },
  googleRefreshToken: { type: String, default: null },
  googleCalendarConnected: { type: Boolean, default: false },
  googleCalendarId: { type: String, default: "primary" },
  googleReminderMinutes: { type: [Number], default: [30] },
  workStart: { type: Number, default: 9 },
  workEnd: { type: Number, default: 18 },
  restStart: { type: Number, default: 18 },
  restEnd: { type: Number, default: 23 },
  sleepStart: { type: Number, default: 23 },
  sleepEnd: { type: Number, default: 7 },
  tradingSessions: {
    type: [{
      name: { type: String, default: "" },
      start: { type: Number, default: 0 },
      end: { type: Number, default: 0 },
      enabled: { type: Boolean, default: true },
    }],
    default: [
      { name: "Азия",      start: 3,  end: 8,  enabled: true },
      { name: "Франкфурт", start: 8,  end: 9,  enabled: true },
      { name: "Лондон",    start: 9,  end: 14, enabled: true },
      { name: "Нью-Йорк",  start: 14, end: 17, enabled: true },
    ],
  },
  workDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  updatedAt: { type: Date, default: Date.now },
});

export const UserSettings = mongoose.model("UserSettings", userSettingsSchema);

// ── Strict Schemas for Data Entities ──

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  taskId: { type: String, required: true, unique: true }, // The string UUID from the frontend
  name: { type: String, required: true },
  description: { type: String, default: "" },
  category: { type: String, required: true },
  difficulty: { type: String },
  xp: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  type: { type: String, required: true },
  routineId: { type: String },
  goalId: { type: String },
  weekGoalId: { type: String },
  startTime: { type: String },
  endTime: { type: String },
  noDeadline: { type: Boolean, default: false },
  completedAt: { type: String },
  googleCalendarEventId: { type: String },
  addToGoogleCalendar: { type: Boolean, default: false },
}, { timestamps: true });

const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  goalId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  parentId: { type: String },
  completed: { type: Boolean, default: false },
  xp: { type: Number, default: 0 },
  linkedTaskIds: { type: [String], default: [] },
  taskWeights: { type: mongoose.Schema.Types.Mixed, default: {} },
  year: { type: Number },
  month: { type: Number },
  week: { type: Number },
  description: { type: String },
  plan: { type: [{ id: String, text: String, done: Boolean }], default: [] },
  timeLimitType: { type: String },
  startDate: { type: String },
  endDate: { type: String },
  status: { type: String, default: "active" },
  failedAt: { type: String },
  restoredFromId: { type: String },
}, { timestamps: true });

const dayNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  noteId: { type: String, required: true, unique: true },
  date: { type: String, required: true, index: true },
  title: { type: String },
  content: { type: String, required: true },
  noteType: { type: String, default: "note" },
  ideaCategory: { type: String },
  link: { type: String },
  ideaDone: { type: Boolean, default: false },
}, { timestamps: true });

const tradingNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  noteId: { type: String, required: true, unique: true },
  title: { type: String },
  time: { type: String },
  asset: { type: String, required: true },
  timeframe: { type: String },
  tag: { type: String, required: true },
  text: { type: String, required: true },
  screenshotUrl: { type: String },
  date: { type: String, required: true },
  isTradingIdea: { type: Boolean, default: false },
  tradingIdeaDone: { type: Boolean, default: false },
}, { timestamps: true });

const dailyBiasSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  biasId: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  asset: { type: String, required: true },
  direction: { type: String, required: true },
  pros: { type: String },
  cons: { type: String },
  screenshotUrl: { type: String },
}, { timestamps: true });

const focusSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sessionId: { type: String, required: true, unique: true },
  duration: { type: Number, required: true },
  mode: { type: String, required: true },
  xp: { type: Number, default: 0 },
  date: { type: String, required: true },
  completedAt: { type: String, required: true },
  note: { type: String },
}, { timestamps: true });

const routineTemplateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  templateId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true },
  xp: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
  goalId: { type: String },
  days: { type: [Number], default: [] },
}, { timestamps: true });

const simulationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  simId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  mode: { type: String, required: true },
  startingBalance: { type: Number, required: true },
  riskType: { type: String, required: true },
  commission: { type: Number, default: 0 },
  maxTradesPerDay: { type: Number },
  maxWinsPerDay: { type: Number },
  notes: { type: String },
  assets: { type: mongoose.Schema.Types.Mixed, required: true },
  results: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });

export const Task = mongoose.model("Task", taskSchema);
export const Goal = mongoose.model("Goal", goalSchema);
export const DayNote = mongoose.model("DayNote", dayNoteSchema);
export const TradingNote = mongoose.model("TradingNote", tradingNoteSchema);
export const DailyBias = mongoose.model("DailyBias", dailyBiasSchema);
export const FocusSession = mongoose.model("FocusSession", focusSessionSchema);
export const RoutineTemplate = mongoose.model("RoutineTemplate", routineTemplateSchema);
export const Simulation = mongoose.model("Simulation", simulationSchema);

const processedAudioSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  telegramMessageId: { type: String, required: true },
  raw_transcript: { type: String, default: "" },
  title: { type: String, default: null },
  executive_summary: { type: String, default: "" },
  action_items: { type: mongoose.Schema.Types.Mixed, default: [] },
  semantic_tags: { type: [String], default: [] },
  mind_map_nodes: { type: mongoose.Schema.Types.Mixed, default: [] },
  key_insights: { type: [String], default: [] },
  topics: { type: [String], default: [] },
  sentiment: { type: String },
  questions_raised: { type: [String], default: [] },
  note_type: { type: String },
  mode: { type: String },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
}, { timestamps: true });

export const ProcessedAudio = mongoose.model("ProcessedAudio", processedAudioSchema);

