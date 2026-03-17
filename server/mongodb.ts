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
  verifyToken: { type: String, default: null },
  verifyTokenExpires: { type: Date, default: null },
}, { timestamps: true });

const userDataSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});

const userDataBackupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model("User", userSchema);
export const UserData = mongoose.model("UserData", userDataSchema);
export const UserDataBackup = mongoose.model("UserDataBackup", userDataBackupSchema);
const resetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});

export const ResetToken = mongoose.model("ResetToken", resetTokenSchema);
const userSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  utcOffset: { type: Number, default: 1 },
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
  updatedAt: { type: Date, default: Date.now },
});

export const UserSettings = mongoose.model("UserSettings", userSettingsSchema);
