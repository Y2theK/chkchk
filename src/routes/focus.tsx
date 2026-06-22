import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import {
  Play,
  Pause,
  RotateCcw,
  Bell,
  Volume2,
  VolumeX,
  Headphones,
  Settings2,
  Music2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/focus")({
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
  component: FocusPage,
});

const BUILTIN_PRESETS = [
  { focus: 25, break: 5, label: "Quick" },
  { focus: 30, break: 5, label: "Standard" },
];
const CUSTOM_KEY = "ccc-custom-preset";
const AUDIO_KEY = "focus-sound";
const EGG_SOUND_KEY = "egg-sound-unlocked";
const EGG_CLICK_WINDOW = 2000;
const EGG_CLICK_COUNT = 5;
const AUDIO_OPTIONS = [
  { id: "focus-1", label: "Chime 1" },
  { id: "focus-2", label: "Chime 2" },
  { id: "focus-3", label: "Chime 3" },
  { id: "focus-4", label: "Chime 4" },
  { id: "focus-5", label: "Chime 5" },
];

const BG_AUDIO_OPTIONS = [
  { id: "bg-1", label: "Ambient 1" },
  { id: "bg-2", label: "Ambient 2" },
  { id: "bg-3", label: "Ambient 3" },
  { id: "bg-4", label: "Ambient 4" },
  { id: "bg-5", label: "Ambient 5" },
  { id: "bg-6", label: "Ambient Special :3" },
];
const BG_AUDIO_KEY = "focus-bg-sound";

type Phase = "focus" | "break";

function FocusPage() {
  const [custom, setCustom] = useState<{ focus: number; break: number; label: string }>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(CUSTOM_KEY);
        if (raw) return JSON.parse(raw);
      } catch {
        // ignore parse error
      }
    }
    return { focus: 40, break: 5, label: "Custom" };
  });
  const presets = [...BUILTIN_PRESETS, custom];
  const [preset, setPreset] = useState(presets[2]);
  const [editOpen, setEditOpen] = useState(false);
  const [editFocus, setEditFocus] = useState(custom.focus);
  const [editBreak, setEditBreak] = useState(custom.break);
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(presets[2].focus * 60);
  const [running, setRunning] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState("focus-1");
  const [soundOpen, setSoundOpen] = useState(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [previewCooldown, setPreviewCooldown] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const eggClicksRef = useRef<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const phaseRef = useRef<Phase>("focus");
  const presetRef = useRef(presets[2]);
  phaseRef.current = phase;
  presetRef.current = preset;
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const [bgMusicId, setBgMusicId] = useState("");
  const [bgPlaying, setBgPlaying] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);

  useEffect(() => {
    db.settings.get(AUDIO_KEY).then((entry) => {
      if (entry?.value) {
        setSelectedAudio(entry.value);
      }
    });
    db.settings.get(EGG_SOUND_KEY).then((entry) => {
      if (entry?.value === "true") {
        setSoundUnlocked(true);
      }
    });
    db.settings.get(BG_AUDIO_KEY).then((entry) => {
      if (entry?.value) {
        setBgMusicId(entry.value);
      }
    });
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleEggClick = useCallback(() => {
    if (soundUnlocked) return;
    const now = Date.now();
    eggClicksRef.current = [...eggClicksRef.current.filter((t) => now - t < EGG_CLICK_WINDOW), now];
    if (eggClicksRef.current.length >= EGG_CLICK_COUNT) {
      setSoundUnlocked(true);
      db.settings.put({ key: EGG_SOUND_KEY, value: "true" });
      toast("Easter egg cracked!", { description: "Sound picker unlocked." });
      eggClicksRef.current = [];
    }
  }, [soundUnlocked]);

  const sessions = useLiveQuery(
    () => db.sessions.where("completedAt").above(startOfDay(new Date()).getTime()).toArray(),
    [],
  );

  const total = phase === "focus" ? preset.focus * 60 : preset.break * 60;
  const progress = ((total - remaining) / total) * 100;

  useEffect(() => {
    const audio = new Audio(`/${selectedAudio}.mp3`);
    audio.preload = "auto";
    audio.volume = 1.0;
    audioRef.current = audio;

    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          audioUnlockedRef.current = true;
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1.0;
        })
        .catch(() => {
          audio.volume = 1.0;
        });
    };

    document.addEventListener("pointerdown", unlockAudio);
    document.addEventListener("keydown", unlockAudio);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        audioUnlockedRef.current = false;
        audio.load();
        unlockAudio();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      document.removeEventListener("visibilitychange", handleVisibility);
      audio.pause();
      audio.src = "";
      audioUnlockedRef.current = false;
      audioRef.current = null;
    };
  }, [selectedAudio]);

  useEffect(() => {
    if (!bgMusicId) {
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
        bgAudioRef.current.src = "";
        bgAudioRef.current = null;
      }
      setBgPlaying(false);
      return;
    }
    const audio = new Audio(`/${bgMusicId}.mp3`);
    audio.preload = "auto";
    audio.volume = 0.2;
    audio.loop = true;
    bgAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      bgAudioRef.current = null;
    };
  }, [bgMusicId]);

  useEffect(() => {
    const audio = bgAudioRef.current;
    if (!audio || !bgMusicId) return;
    if (running && phase === "focus") {
      audio.play().catch(() => {});
      setBgPlaying(true);
    } else {
      audio.pause();
      setBgPlaying(false);
    }
  }, [running, phase, bgMusicId]);

  function selectAudio(id: string) {
    setSelectedAudio(id);
    db.settings.put({ key: AUDIO_KEY, value: id });
  }

  function previewAudio(id: string) {
    if (previewCooldown) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    const audio = new Audio(`/${id}.mp3`);
    audio.volume = 1.0;
    previewAudioRef.current = audio;
    setPreviewCooldown(true);
    audio.play().catch(() => {});
    audio.onended = () => {
      previewAudioRef.current = null;
    };
    setTimeout(() => {
      if (previewAudioRef.current === audio) {
        audio.pause();
        previewAudioRef.current = null;
      }
      setPreviewCooldown(false);
    }, 3000);
  }

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
    } catch {
      // ignore storage error
    }
    setPreset(next);
    setPhase("focus");
    setRemaining(f * 60);
    setRunning(false);
    setEditOpen(false);
  }

  function finishPhase() {
    const currentPhase = phaseRef.current;
    const currentPreset = presetRef.current;
    setRunning(false);
    playChime();
    if (currentPhase === "focus") {
      db.sessions.add({
        focusMin: currentPreset.focus,
        breakMin: currentPreset.break,
        completedAt: Date.now(),
      });
      notify("Focus done! Time for a break", `${currentPreset.break} min break starting`);
      setPhase("break");
      setRemaining(currentPreset.break * 60);
    } else {
      notify("Break over — let's focus", `${currentPreset.focus} min focus starting`);
      setPhase("focus");
      setRemaining(currentPreset.focus * 60);
    }
    setTimeout(() => setRunning(true), 800);
  }

  function notify(title: string, body: string) {
    toast(title, { description: body });
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, icon: "/icon-192.png" });
      }
    } catch {
      // ignore notification error
    }
  }

  function playChime() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 1.0;

    const attemptPlay = (retriesLeft: number) => {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            audioUnlockedRef.current = true;
          })
          .catch(() => {
            if (retriesLeft > 0) {
              setTimeout(() => attemptPlay(retriesLeft - 1), 200);
            }
          });
      }
    };

    attemptPlay(5);
  }

  function requestNotif() {
    if (!("Notification" in window)) {
      toast("Notifications not supported", {
        description: "Your browser doesn't support notifications.",
      });
      return;
    }
    if (Notification.permission === "granted") {
      toast("Notifications enabled", {
        description: "You'll get reminders when focus or break ends.",
      });
      return;
    }
    if (Notification.permission === "denied") {
      toast("Notifications blocked", {
        description: "Enable notifications in your browser settings.",
      });
      return;
    }
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        toast("Notifications enabled", {
          description: "You'll get reminders when focus or break ends.",
        });
      } else {
        toast("Notifications blocked", {
          description: "Enable notifications in your browser settings.",
        });
      }
    });
  }

  function ensureNotif() {
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
    ensureNotif();
    setRunning((r) => !r);
  }

  function toggleBgMusic() {
    const audio = bgAudioRef.current;
    if (!audio || !bgMusicId) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setBgPlaying(true);
    } else {
      audio.pause();
      setBgPlaying(false);
    }
  }

  function selectBgAudio(id: string) {
    setBgMusicId(id);
    db.settings.put({ key: BG_AUDIO_KEY, value: id });
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const r = 110;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;

  return (
    <AppShell>
      <header className="mb-5 flex items-center justify-between">
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Focus
          </p>
          <h1 className="text-2xl font-bold">Focus Timer</h1>
          {!soundUnlocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEggClick();
              }}
              className="absolute -right-6 top-0 rotate-12 opacity-40 transition-all hover:opacity-70 active:scale-90 animate-pulse"
              aria-label="???"
            >
              <img src="/easter-egg-1.png" alt="?" className="h-5 w-5" />
            </button>
          )}
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
              <p className="text-xs font-medium flex items-center justify-center gap-1">
                {p.label}
                {isCustom && <Pencil className="h-3 w-3" />}
              </p>
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

      <Dialog
        open={soundOpen}
        onOpenChange={(open) => {
          if (!open && previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
            setPreviewCooldown(false);
          }
          setSoundOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Timer Sound</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {AUDIO_OPTIONS.map((opt) => {
              const active = opt.id === selectedAudio;
              return (
                <button
                  key={opt.id}
                  onClick={() => selectAudio(opt.id)}
                  className={`flex items-center justify-between rounded-xl p-3 transition-all ${
                    active
                      ? "bg-sky text-foreground shadow-md"
                      : "bg-card text-muted-foreground shadow-sm hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Music2 className="h-5 w-5" />
                    <span className="font-medium">{opt.label}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={active ? "default" : "ghost"}
                    className={active ? "" : "text-muted-foreground"}
                    disabled={previewCooldown}
                    onClick={(e) => {
                      e.stopPropagation();
                      previewAudio(opt.id);
                    }}
                  >
                    {previewCooldown ? "Wait 3 sec" : "Preview"}
                  </Button>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setSoundOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bgOpen} onOpenChange={setBgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Background Sound</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <button
              onClick={() => {
                selectBgAudio("");
                setBgOpen(false);
              }}
              className={`flex items-center rounded-xl p-3 transition-all ${
                !bgMusicId
                  ? "bg-sky text-foreground shadow-md"
                  : "bg-card text-muted-foreground shadow-sm hover:bg-accent"
              }`}
            >
              <span className="font-medium">None (Off)</span>
            </button>
            {BG_AUDIO_OPTIONS.map((opt) => {
              const active = opt.id === bgMusicId;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    selectBgAudio(opt.id);
                    setBgOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-xl p-3 transition-all ${
                    active
                      ? "bg-sky text-foreground shadow-md"
                      : "bg-card text-muted-foreground shadow-sm hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Volume2 className="h-5 w-5" />
                    <span className="font-medium">{opt.label}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={active ? "default" : "ghost"}
                    className={active ? "" : "text-muted-foreground"}
                    disabled={previewCooldown}
                    onClick={(e) => {
                      e.stopPropagation();
                      previewAudio(opt.id);
                    }}
                  >
                    {previewCooldown ? "Wait 3 sec" : "Preview"}
                  </Button>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={() => setBgOpen(false)}>Done</Button>
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
            onClick={requestNotif}
            aria-label="Enable notifications"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm active:scale-95"
          >
            <Bell className="h-5 w-5" />
          </button>
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

          <div className="flex items-center gap-1">
            <button
              onClick={bgMusicId ? toggleBgMusic : () => setBgOpen(true)}
              aria-label={bgMusicId ? "Toggle background sound" : "Choose background sound"}
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm active:scale-95 ${
                bgMusicId && bgPlaying
                  ? "text-sky"
                  : bgMusicId
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
              }`}
            >
              {bgMusicId ? (
                bgPlaying ? (
                  <Volume2 className="h-5 w-5" />
                ) : (
                  <VolumeX className="h-5 w-5" />
                )
              ) : (
                <Headphones className="h-5 w-5" />
              )}
            </button>

            {bgMusicId && (
              <button
                onClick={() => setBgOpen(true)}
                aria-label="Change background sound"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm active:scale-95"
              >
                <Settings2 className="h-5 w-5" />
              </button>
            )}

            {soundUnlocked && (
              <button
                onClick={() => setSoundOpen(true)}
                aria-label="Choose sound"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm active:scale-95"
              >
                <Music2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 max-w-xs text-center text-xs text-muted-foreground">
          Tap the bell to enable notifications so you get reminded when focus or break ends.
        </p>
      </div>
    </AppShell>
  );
}
