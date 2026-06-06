import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { db, type Goal } from "@/lib/db";
import { AppShell, Fab } from "@/components/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Target, Flame, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/habit")({
  head: () => ({
    meta: [
      { title: "Habits — checkcheck" },
      {
        name: "description",
        content:
          "Build daily habit streaks with visual progress tracking. Set goals and stay consistent.",
      },
    ],
  }),
  component: HabitPage,
});

const COLORS = ["#7dd3fc", "#f9a8a8", "#86efac", "#fcd34d", "#c4b5fd", "#f0abfc"];

const DURATIONS = [7, 21, 30, 66, 100];

const todayStr = () => format(new Date(), "yyyy-MM-dd");

function HabitPage() {
  const [open, setOpen] = useState(false);

  const goals = useLiveQuery(() => db.goals.orderBy("createdAt").reverse().toArray(), []);
  const logs = useLiveQuery(() => db.habitLogs.toArray(), []);

  const logsByGoal = useMemo(() => {
    const map = new Map<number, Set<string>>();
    (logs ?? []).forEach((l) => {
      if (!map.has(l.goalId)) map.set(l.goalId, new Set());
      map.get(l.goalId)!.add(l.date);
    });
    return map;
  }, [logs]);

  const totals = useMemo(() => {
    const today = todayStr();
    let activeGoals = 0;
    let doneToday = 0;
    (goals ?? []).forEach((g) => {
      const start = parseISO(g.startDate);
      const end = addDays(start, g.durationDays - 1);
      const now = new Date();
      if (now >= start && now <= end) {
        activeGoals++;
        if (logsByGoal.get(g.id!)?.has(today)) doneToday++;
      }
    });
    return { activeGoals, doneToday };
  }, [goals, logsByGoal]);

  return (
    <AppShell>
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Build streaks
        </p>
        <h1 className="text-2xl font-bold">Habits</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-sky-soft p-4">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Target className="h-4 w-4" /> Active goals
          </div>
          <p className="mt-1 text-2xl font-bold">{totals.activeGoals}</p>
        </div>
        <div className="rounded-3xl bg-peach-soft p-4">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" /> Done today
          </div>
          <p className="mt-1 text-2xl font-bold">
            {totals.doneToday}/{totals.activeGoals}
          </p>
        </div>
      </div>

      <section className="mt-6 space-y-3">
        {(goals ?? []).length === 0 && (
          <div className="rounded-3xl bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">No habits yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Tap + to set a goal.</p>
          </div>
        )}
        {(goals ?? []).map((g) => (
          <GoalCard key={g.id} goal={g} done={logsByGoal.get(g.id!) ?? new Set()} />
        ))}
      </section>

      <Fab onClick={() => setOpen(true)} label="Add habit" />
      <AddGoalDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}

function GoalCard({ goal, done }: { goal: Goal; done: Set<string> }) {
  const start = parseISO(goal.startDate);
  const today = new Date();
  const dayIndex = Math.max(0, differenceInCalendarDays(today, start));
  const totalDone = done.size;
  const pct = Math.round((totalDone / goal.durationDays) * 100);
  const streak = useMemo(() => {
    let s = 0;
    for (let i = dayIndex; i >= 0; i--) {
      const d = format(addDays(start, i), "yyyy-MM-dd");
      if (done.has(d)) s++;
      else break;
    }
    return s;
  }, [done, dayIndex, start]);

  async function toggleDay(date: string) {
    const existing = await db.habitLogs.where({ goalId: goal.id!, date }).first();
    if (existing) await db.habitLogs.delete(existing.id!);
    else await db.habitLogs.add({ goalId: goal.id!, date });
  }

  return (
    <div className="rounded-3xl bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: goal.color }} />
            <h3 className="truncate text-base font-bold">{goal.title}</h3>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {totalDone}/{goal.durationDays} days
            </span>
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3" /> {streak} streak
            </span>
            <span>{pct}%</span>
          </div>
        </div>
        <button
          onClick={async () => {
            if (!confirm(`Delete "${goal.title}"?`)) return;
            await db.habitLogs.where("goalId").equals(goal.id!).delete();
            await db.goals.delete(goal.id!);
          }}
          aria-label="Delete habit"
          className="p-1 text-muted-foreground hover:text-expense"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-1.5">
        {Array.from({ length: goal.durationDays }).map((_, i) => {
          const d = addDays(start, i);
          const dateStr = format(d, "yyyy-MM-dd");
          const isFuture = i > dayIndex;
          const isToday = i === dayIndex;
          const isDone = done.has(dateStr);
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => toggleDay(dateStr)}
              title={format(d, "MMM d")}
              aria-label={`Day ${i + 1} ${isDone ? "done" : "not done"}`}
              className={`aspect-square rounded-full border transition-all ${
                isFuture
                  ? "border-border bg-transparent opacity-40"
                  : isDone
                    ? "border-transparent"
                    : isToday
                      ? "border-foreground bg-transparent"
                      : "border-border bg-muted"
              }`}
              style={isDone ? { background: goal.color, borderColor: goal.color } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function AddGoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState<number>(30);
  const [color, setColor] = useState(COLORS[0]);
  const [startDate, setStartDate] = useState(() => todayStr());

  async function save() {
    if (!title.trim()) return;
    await db.goals.add({
      title: title.trim(),
      durationDays: duration,
      startDate,
      color,
      createdAt: Date.now(),
    });
    setTitle("");
    setDuration(30);
    setColor(COLORS[0]);
    setStartDate(todayStr());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>New habit</DialogTitle>
        </DialogHeader>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Goal</label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Read 20 minutes"
            className="mt-1 h-12 rounded-2xl"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Duration</label>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-2xl py-2 text-sm font-semibold transition-all ${
                  duration === d ? "bg-sky-soft ring-2 ring-sky" : "bg-muted text-muted-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Color</label>
          <div className="mt-2 flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={`h-9 w-9 rounded-full transition-all ${
                  color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Start date</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-2xl"
          />
        </div>

        <Button onClick={save} className="h-12 rounded-2xl text-base font-semibold">
          Create habit
        </Button>
      </DialogContent>
    </Dialog>
  );
}
