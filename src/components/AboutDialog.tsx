import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, ListChecks, Timer, Smartphone, Target } from "lucide-react";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

import { db } from "@/lib/db";

const ABOUT_KEY = "about-seen";

export async function markAboutSeen() {
  await db.settings.put({ key: ABOUT_KEY, value: "1" });
}

export async function hasAboutBeenSeen(): Promise<boolean> {
  const entry = await db.settings.get(ABOUT_KEY);
  return entry !== undefined;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-8 pb-4 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <img src="/icon-192.png" alt="checkcheck" className="h-16 w-16" />
          </div>
          <DialogTitle className="font-display text-xl font-bold">
            What is checkcheck (chkchk) ?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            <strong>Checkcheck</strong> is your all-in-one offline productivity app. No signup. No
            server. Works in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Core Features
          </p>
          <Feature
            icon={<Wallet className="h-5 w-5 text-peach" strokeWidth={2.2} />}
            title="Expense"
            desc="Track income and expenses"
          />
          <Feature
            icon={<ListChecks className="h-5 w-5 text-sky" strokeWidth={2.2} />}
            title="Todo"
            desc="Manage your to-do list"
          />
          <Feature
            icon={<Target className="h-5 w-5 text-income" strokeWidth={2.2} />}
            title="Habit"
            desc="Build streaks, check daily"
          />
          <Feature
            icon={<Timer className="h-5 w-5 text-destructive" strokeWidth={2.2} />}
            title="Focus"
            desc="Pomodoro timer for deep work"
          />
        </div>

        <div className="px-6 pb-4 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
            Install as App
          </p>
          <div className="rounded-2xl bg-muted/50 p-4 text-xs text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">iPhone (Safari):</strong> Share → Add to Home
              Screen
            </p>
            <p>
              <strong className="text-foreground">Android (Chrome):</strong> Menu → Install app
            </p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <p className="text-center text-xs text-muted-foreground">checkcheck v1.0</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-foreground">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
