import { Link, useRouterState } from "@tanstack/react-router";
import { Wallet, ListChecks, Timer, User, Target } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/expense", label: "Expense", icon: Wallet },
  { to: "/todo", label: "Todo", icon: ListChecks },
  { to: "/habit", label: "Habit", icon: Target },
  { to: "/kodomo", label: "Focus", icon: Timer },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <main className="flex-1 px-4 pt-6 pb-32">{children}</main>

      <nav
        className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-border bg-card/90 backdrop-blur-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={`flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-all ${
                      active ? "bg-sky text-foreground" : "bg-transparent"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Fab({ onClick, label = "Add" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed right-[max(1rem,calc(50%-13.5rem))] z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-sky text-foreground shadow-lg shadow-sky/40 transition-transform active:scale-95"
      style={{ bottom: "calc(7rem + env(safe-area-inset-bottom))" }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
