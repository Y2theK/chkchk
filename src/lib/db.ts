import Dexie, { type Table } from "dexie";

export type TxType = "income" | "expense";

export interface Category {
  id?: number;
  name: string;
  type: TxType;
  icon: string;
  color: string;
}

export interface Transaction {
  id?: number;
  type: TxType;
  amount: number;
  categoryId: number;
  note?: string;
  occurredAt: number; // epoch ms
}

export interface Todo {
  id?: number;
  title: string;
  done: 0 | 1;
  createdAt: number;
  completedAt?: number;
}

export interface FocusSession {
  id?: number;
  focusMin: number;
  breakMin: number;
  completedAt: number;
}

export interface Goal {
  id?: number;
  title: string;
  durationDays: number;
  startDate: string; // YYYY-MM-DD
  color: string;
  createdAt: number;
}

export interface HabitLog {
  id?: number;
  goalId: number;
  date: string; // YYYY-MM-DD
}

class AppDB extends Dexie {
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  todos!: Table<Todo, number>;
  sessions!: Table<FocusSession, number>;
  goals!: Table<Goal, number>;
  habitLogs!: Table<HabitLog, number>;
  settings!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("checkcheck-app");
    this.version(1).stores({
      categories: "++id, type, name",
      transactions: "++id, type, occurredAt, categoryId",
      todos: "++id, done, createdAt",
      sessions: "++id, completedAt",
    });
    this.version(2).stores({
      categories: "++id, type, name",
      transactions: "++id, type, occurredAt, categoryId",
      todos: "++id, done, createdAt",
      sessions: "++id, completedAt",
      goals: "++id, createdAt",
      habitLogs: "++id, goalId, date, [goalId+date]",
    });
    this.version(3).stores({
      categories: "++id, type, name",
      transactions: "++id, type, occurredAt, categoryId",
      todos: "++id, done, createdAt",
      sessions: "++id, completedAt",
      goals: "++id, createdAt",
      habitLogs: "++id, goalId, date, [goalId+date]",
      settings: "key",
    });
  }
}

export const db = new AppDB();

const DEFAULT_CATEGORIES: Category[] = [
  { name: "Food", type: "expense", icon: "", color: "#fb923c" },
  { name: "Transport", type: "expense", icon: "", color: "#60a5fa" },
  { name: "Shopping", type: "expense", icon: "", color: "#f472b6" },
  { name: "Bills", type: "expense", icon: "", color: "#a78bfa" },
  { name: "Health", type: "expense", icon: "", color: "#34d399" },
  { name: "Entertainment", type: "expense", icon: "", color: "#fbbf24" },
  { name: "Other", type: "expense", icon: "", color: "#94a3b8" },
  { name: "Salary", type: "income", icon: "", color: "#10b981" },
  { name: "Freelance", type: "income", icon: "", color: "#06b6d4" },
  { name: "Gift", type: "income", icon: "", color: "#f59e0b" },
  { name: "Other Income", type: "income", icon: "", color: "#84cc16" },
];

export async function ensureSeed() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
}
