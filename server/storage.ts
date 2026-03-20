import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { getDb } from "./mongodb"; // твоя функция подключения

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

// ❌ СТАРЫЙ КЛАСС — оставь на случай локальной разработки без БД
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  constructor() { this.users = new Map(); }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

// ✅ НОВЫЙ КЛАСС — данные хранятся в MongoDB Atlas
export class MongoStorage implements IStorage {
  private get collection() {
    return getDb().collection<User>("users");
  }

  async getUser(id: string): Promise<User | undefined> {
    const user = await this.collection.findOne({ id });
    return user ?? undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await this.collection.findOne({ username });
    return user ?? undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    await this.collection.insertOne(user);
    return user;
  }
}

// ✅ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: используем MongoDB, а не память
export const storage = new MongoStorage();
