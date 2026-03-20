import { type User as UserType, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { User } from "./mongodb"; // твои Mongoose модели уже есть!

export interface IStorage {
  getUser(id: string): Promise<UserType | undefined>;
  getUserByUsername(username: string): Promise<UserType | undefined>;
  createUser(user: InsertUser): Promise<UserType>;
}

// Оставляем MemStorage для локальной разработки без интернета
export class MemStorage implements IStorage {
  private users: Map<string, UserType>;
  constructor() { this.users = new Map(); }

  async getUser(id: string): Promise<UserType | undefined> {
    return this.users.get(id);
  }
  async getUserByUsername(username: string): Promise<UserType | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  async createUser(insertUser: InsertUser): Promise<UserType> {
    const id = randomUUID();
    const user: UserType = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

// ✅ НОВЫЙ КЛАСС — использует твои Mongoose модели из mongodb.ts
export class MongoStorage implements IStorage {
  async getUser(id: string): Promise<UserType | undefined> {
    const doc = await User.findOne({ _id: id }).lean();
    if (!doc) return undefined;
    return {
      id: doc._id.toString(),
      username: doc.email,
      password: doc.password_hash,
    } as UserType;
  }

  async getUserByUsername(username: string): Promise<UserType | undefined> {
    const doc = await User.findOne({ email: username.toLowerCase() }).lean();
    if (!doc) return undefined;
    return {
      id: doc._id.toString(),
      username: doc.email,
      password: doc.password_hash,
    } as UserType;
  }

  async createUser(insertUser: InsertUser): Promise<UserType> {
    const doc = await User.create({
      email: (insertUser as any).username?.toLowerCase() ?? (insertUser as any).email,
      password_hash: (insertUser as any).password,
    });
    return {
      id: doc._id.toString(),
      username: doc.email,
      password: doc.password_hash,
    } as UserType;
  }
}

// ✅ КЛЮЧЕВАЯ СТРОКА — меняем MemStorage на MongoStorage
export const storage = new MongoStorage();
