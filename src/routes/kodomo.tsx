import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Play, Pause, RotateCcw, Bell } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/kodomo")({
  head: () => ({
    meta: [
      { title: "Focus — checkcheck" },
      {
        name: "description",
        content:
          "Stay focused with customizable Pomodoro-style focus sessions. Track your deep work time.",
      },
    ],
  }),
  component: KodomoPage,
});

const BUILTIN_PRESETS = [
  { focus: 25, break: 5, label: "Quick" },
  { focus: 30, break: 5, label: "Standard" },
];
const CUSTOM_KEY = "ccc-custom-preset";

type Phase = "focus" | "break";

function KodomoPage() {
  const [custom, setCustom] = useState<{ focus: number; break: number; label: string }>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(CUSTOM_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return { focus: 40, break: 5, label: "Custom" };
  });
  const presets = [...BUILTIN_PRESETS, custom];
  const [preset, setPreset] = useState(presets[1]);
  const [editOpen, setEditOpen] = useState(false);
  const [editFocus, setEditFocus] = useState(custom.focus);
  const [editBreak, setEditBreak] = useState(custom.break);
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(presets[1].focus * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessions = useLiveQuery(
    () => db.sessions.where("completedAt").above(startOfDay(new Date()).getTime()).toArray(),
    [],
  );

  const total = phase === "focus" ? preset.focus * 60 : preset.break * 60;
  const progress = ((total - remaining) / total) * 100;

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          finishPhase();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, preset]);

  function selectPreset(p: { focus: number; break: number; label: string }) {
    setRunning(false);
    setPreset(p);
    setPhase("focus");
    setRemaining(p.focus * 60);
  }

  function saveCustom() {
    const f = Math.max(1, Math.min(180, Math.round(editFocus)));
    const b = Math.max(1, Math.min(60, Math.round(editBreak)));
    const next = { focus: f, break: b, label: "Custom" };
    setCustom(next);
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
    } catch {}
    setPreset(next);
    setPhase("focus");
    setRemaining(f * 60);
    setRunning(false);
    setEditOpen(false);
  }

  function finishPhase() {
    setRunning(false);
    playChime();
    if (phase === "focus") {
      db.sessions.add({
        focusMin: preset.focus,
        breakMin: preset.break,
        completedAt: Date.now(),
      });
      notify("Focus done! Time for a break", `${preset.break} min break starting`);
      setPhase("break");
      setRemaining(preset.break * 60);
    } else {
      notify("Break over — let's focus", `${preset.focus} min focus starting`);
      setPhase("focus");
      setRemaining(preset.focus * 60);
    }
    setTimeout(() => setRunning(true), 800);
  }

  function notify(title: string, body: string) {
    toast(title, { description: body });
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/icon-192.png" });
      }
    } catch {}
  }

  function playChime() {
    try {
      const AC: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const duration = 3;
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Soft arpeggio of bell-like tones (C major 9: C5, E5, G5, D6)
      const notes = [
        { f: 523.25, t: 0.0 },
        { f: 659.25, t: 0.18 },
        { f: 783.99, t: 0.36 },
        { f: 1174.66, t: 0.54 },
      ];
      notes.forEach(({ f, t }) => {
        const start = now + t;
        const tail = duration - t;
        // Fundamental + soft harmonic for bell character
        [
          { mult: 1, gain: 0.5 },
          { mult: 2, gain: 0.18 },
          { mult: 3, gain: 0.06 },
        ].forEach(({ mult, gain: g }) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = f * mult;
          const env = ctx.createGain();
          env.gain.setValueAtTime(0, start);
          env.gain.linearRampToValueAtTime(g, start + 0.02);
          env.gain.exponentialRampToValueAtTime(0.0001, start + tail);
          osc.connect(env);
          env.connect(master);
          osc.start(start);
          osc.stop(start + tail + 0.05);
        });
      });
      if (audioStopRef.current) clearTimeout(audioStopRef.current);
    } catch {}
  }

  function requestNotif() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function reset() {
    setRunning(false);
    setPhase("focus");
    setRemaining(preset.focus * 60);
  }

  function toggle() {
    requestNotif();
    const AC: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AC();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {});
    }
    setRunning((r) => !r);
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const r = 110;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;

  return (
    <AppShell>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Focus
          </p>
          <h1 className="text-2xl font-bold">Focus Timer</h1>
        </div>
        <div className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold shadow-sm">
          {sessions?.length ?? 0} today
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {presets.map((p) => {
          const active = p.label === preset.label;
          const isCustom = p.label === "Custom";
          return (
            <button
              key={p.label}
              onClick={() => {
                if (isCustom && active) {
                  setEditFocus(custom.focus);
                  setEditBreak(custom.break);
                  setEditOpen(true);
                } else {
                  selectPreset(p);
                }
              }}
              className={`rounded-2xl p-3 text-center transition-all ${
                active
                  ? "bg-sky text-foreground shadow-md"
                  : "bg-card text-muted-foreground shadow-sm"
              }`}
            >
              <p className="text-xs font-medium">{p.label}</p>
              <p className="mt-0.5 text-base font-bold">
                {p.focus}/{p.break}
              </p>
            </button>
          );
        })}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Custom Timer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="focus-min">Focus (minutes)</Label>
              <Input
                id="focus-min"
                type="number"
                min={1}
                max={180}
                value={editFocus}
                onChange={(e) => setEditFocus(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="break-min">Break (minutes)</Label>
              <Input
                id="break-min"
                type="number"
                min={1}
                max={60}
                value={editBreak}
                onChange={(e) => setEditBreak(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCustom}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 flex flex-col items-center">
        <div className="relative h-64 w-64">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 240 240">
            <circle cx="120" cy="120" r={r} stroke="var(--muted)" strokeWidth="14" fill="none" />
            <circle
              cx="120"
              cy="120"
              r={r}
              stroke={phase === "focus" ? "var(--sky)" : "var(--peach)"}
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {phase === "focus" ? "Focus" : "Break"}
            </p>
            <p className="font-display text-6xl font-bold tabular-nums">
              {mm}:{ss}
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={reset}
            aria-label="Reset"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm active:scale-95"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
          <button
            onClick={toggle}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-sky text-foreground shadow-lg shadow-sky/40 active:scale-95"
          >
            {running ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
          </button>
          <button
            onClick={requestNotif}
            aria-label="Enable notifications"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm active:scale-95"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-6 max-w-xs text-center text-xs text-muted-foreground">
          Tap the bell to enable notifications so you get reminded when focus or break ends.
        </p>
      </div>
    </AppShell>
  );
}
