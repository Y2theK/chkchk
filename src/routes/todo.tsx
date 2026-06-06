import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { startOfDay, endOfDay, format } from "date-fns";
import { db } from "@/lib/db";
import { AppShell, Fab } from "@/components/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Trash2, ListTodo, CheckCircle2, Circle } from "lucide-react";

export const Route = createFileRoute("/todo")({
  head: () => ({
    meta: [
      { title: "Todo — checkcheck" },
      {
        name: "description",
        content:
          "Manage your daily tasks and todo list. Stay organized with a simple offline task tracker.",
      },
    ],
  }),
  component: TodoPage,
});

function TodoPage() {
  const [tab, setTab] = useState<"today" | "done">("today");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const todos = useLiveQuery(() => db.todos.orderBy("createdAt").reverse().toArray(), []);

  const todayStart = startOfDay(new Date()).getTime();
  const todayEnd = endOfDay(new Date()).getTime();

  const todayTodos = (todos ?? []).filter(
    (t) => t.createdAt >= todayStart && t.createdAt <= todayEnd,
  );
  const pending = todayTodos.filter((t) => !t.done);
  const done = todayTodos.filter((t) => t.done);
  const list = tab === "today" ? pending : done;

  async function add() {
    if (!title.trim()) return;
    await db.todos.add({ title: title.trim(), done: 0, createdAt: Date.now() });
    setTitle("");
    setOpen(false);
  }

  async function toggle(id: number, current: 0 | 1) {
    await db.todos.update(id, {
      done: current ? 0 : 1,
      completedAt: current ? undefined : Date.now(),
    });
  }

  return (
    <AppShell>
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {format(new Date(), "EEEE, MMM d")}
        </p>
        <h1 className="text-2xl font-bold">Today's tasks</h1>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<ListTodo className="h-4 w-4" />}
          label="Total"
          value={todayTodos.length}
          tint="sky"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Done"
          value={done.length}
          tint="income"
        />
        <StatCard
          icon={<Circle className="h-4 w-4" />}
          label="Left"
          value={pending.length}
          tint="peach"
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
        {(["today", "done"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t === "today" ? "To do" : "Done"}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {list.length === 0 && (
          <li className="rounded-3xl bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              {tab === "today" ? "Nothing left for today." : "Nothing completed yet."}
            </p>
          </li>
        )}
        {list.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
            <button
              onClick={() => toggle(t.id!, t.done)}
              aria-label="Toggle"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                t.done ? "border-income bg-income text-white" : "border-border bg-transparent"
              }`}
            >
              {t.done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
            </button>
            <p
              className={`flex-1 text-sm font-medium ${
                t.done ? "text-muted-foreground line-through" : ""
              }`}
            >
              {t.title}
            </p>
            <button
              onClick={() => db.todos.delete(t.id!)}
              aria-label="Delete"
              className="p-1 text-muted-foreground hover:text-expense"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <Fab onClick={() => setOpen(true)} label="Add todo" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What needs to be done?"
            className="h-12 rounded-2xl"
          />
          <Button onClick={add} className="h-12 rounded-2xl text-base font-semibold">
            Add task
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tint: "sky" | "peach" | "income";
}) {
  const bg = tint === "sky" ? "bg-sky-soft" : tint === "peach" ? "bg-peach-soft" : "bg-income/15";
  return (
    <div className={`rounded-3xl p-3 ${bg}`}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
