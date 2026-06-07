import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Download, Upload, Trash2, Smartphone, Heart, CircleHelp } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AboutDialog } from "@/components/AboutDialog";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — checkcheck" },
      {
        name: "description",
        content:
          "Manage your checkcheck data. Export backups, restore from backup, or clear all data.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const txCount = useLiveQuery(() => db.transactions.count(), []);
  const todoCount = useLiveQuery(() => db.todos.count(), []);
  const sessionCount = useLiveQuery(() => db.sessions.count(), []);
  const goalCount = useLiveQuery(() => db.goals.count(), []);
  const [aboutOpen, setAboutOpen] = useState(false);

  async function exportData() {
    const data = {
      categories: await db.categories.toArray(),
      transactions: await db.transactions.toArray(),
      todos: await db.todos.toArray(),
      sessions: await db.sessions.toArray(),
      goals: await db.goals.toArray(),
      habitLogs: await db.habitLogs.toArray(),
      settings: await db.settings.toArray(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `checkcheck-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup downloaded");
  }

  async function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        await db.transaction(
          "rw",
          [db.categories, db.transactions, db.todos, db.sessions, db.goals, db.habitLogs, db.settings],
          async () => {
            if (data.categories) {
              await db.categories.clear();
              await db.categories.bulkAdd(data.categories);
            }
            if (data.transactions) {
              await db.transactions.clear();
              await db.transactions.bulkAdd(data.transactions);
            }
            if (data.todos) {
              await db.todos.clear();
              await db.todos.bulkAdd(data.todos);
            }
            if (data.sessions) {
              await db.sessions.clear();
              await db.sessions.bulkAdd(data.sessions);
            }
            if (data.goals) {
              await db.goals.clear();
              await db.goals.bulkAdd(data.goals);
            }
            if (data.habitLogs) {
              await db.habitLogs.clear();
              await db.habitLogs.bulkAdd(data.habitLogs);
            }
            if (data.settings) {
              await db.settings.clear();
              await db.settings.bulkAdd(data.settings);
            }
          },
        );
        toast.success("Data restored");
      } catch (e) {
        toast.error("Invalid backup file");
      }
    };
    input.click();
  }

  async function clearAll() {
    if (!confirm("Delete ALL data? This cannot be undone.")) return;
    await db.transaction(
      "rw",
      [db.transactions, db.todos, db.sessions, db.goals, db.habitLogs, db.settings],
      async () => {
        await db.transactions.clear();
        await db.todos.clear();
        await db.sessions.clear();
        await db.goals.clear();
        await db.habitLogs.clear();
        await db.settings.clear();
      },
    );
    toast.success("All data cleared");
  }

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your data lives on this device only.</p>
      </header>

      <div className="rounded-3xl bg-sky p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm">
            <Heart className="h-6 w-6 text-expense" />
          </div>
          <div>
            <p className="font-display text-lg font-bold">Hi there!</p>
            <p className="text-xs text-muted-foreground">Keep up the good work.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Transactions" value={txCount ?? 0} />
          <Stat label="Tasks" value={todoCount ?? 0} />
          <Stat label="Sessions" value={sessionCount ?? 0} />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 text-center">
          <Stat label="Habits" value={goalCount ?? 0} />
        </div>
      </div>

      <section className="mt-6 space-y-2">
        <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Data
        </h2>
        <Row icon={<Download className="h-5 w-5" />} label="Export backup" onClick={exportData} />
        <Row
          icon={<Upload className="h-5 w-5" />}
          label="Restore from backup"
          onClick={importData}
        />
        <Row
          icon={<Trash2 className="h-5 w-5 text-expense" />}
          label="Clear all data"
          onClick={clearAll}
          destructive
        />
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Secrets
        </h2>
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <img src="/easter-day.png" alt="Easter Egg" className="mt-0.5 h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Easter Eggs</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Keep an eye out for hidden eggs across the app. Tap them 5 times quickly to crack them open and unlock secret features.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          About
        </h2>
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-5 w-5 text-sky" />
            <div>
              <p className="text-sm font-semibold">Install as app</p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">iPhone (Safari):</p>
              <ol className="mt-1 list-inside space-y-1 text-xs text-muted-foreground">
                <li>1. Tap the Share button (bottom bar)</li>
                <li>2. Scroll down and tap "Add to Home Screen"</li>
                <li>3. Tap "Add" to confirm</li>
              </ol>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Android (Chrome):</p>
              <ol className="mt-1 list-inside space-y-1 text-xs text-muted-foreground">
                <li>1. Tap the menu icon (⋮ top right)</li>
                <li>2. Tap "Install app" or "Add to Home Screen"</li>
                <li>3. Tap "Install" to confirm</li>
              </ol>
            </div>
          </div>
        </div>
        <button
          onClick={() => setAboutOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-card p-4 text-xs text-muted-foreground shadow-sm active:scale-[0.99] transition-transform"
        >
          <CircleHelp className="h-3.5 w-3.5" />
          checkcheck v1.0
        </button>
      </section>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card/70 py-2">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm active:scale-[0.99] ${
        destructive ? "text-expense" : ""
      }`}
    >
      {icon}
      <span className="flex-1 text-sm font-semibold">{label}</span>
    </button>
  );
}
