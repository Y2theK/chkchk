import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { format, startOfMonth, endOfMonth, subMonths, isSameMonth, isSameDay } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { db, ensureSeed, type Transaction, type TxType } from "@/lib/db";
import { AppShell, Fab } from "@/components/AppShell";
import { SwipeRow } from "@/components/SwipeRow";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — checkcheck" },
      {
        name: "description",
        content:
          "Track and visualize your income and spending by category. See money trends with charts and bar graphs.",
      },
    ],
  }),
  component: WalletPage,
});

const EGG_CHART_KEY = "egg-chart-unlocked";
const EGG_CLICK_WINDOW = 2000;
const EGG_CLICK_COUNT = 5;

const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

function WalletPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [chartUnlocked, setChartUnlocked] = useState(false);
  const eggClicksRef = useRef<number[]>([]);

  const openAdd = useCallback(() => {
    setEditing(null);
    setOpen(true);
  }, []);

  const openEdit = useCallback((t: Transaction) => {
    setEditing(t);
    setOpen(true);
  }, []);

  useEffect(() => {
    ensureSeed();
    db.settings.get(EGG_CHART_KEY).then((entry) => {
      if (entry?.value === "true") {
        setChartUnlocked(true);
      }
    });
  }, []);

  const handleEggClick = useCallback(() => {
    if (chartUnlocked) return;
    const now = Date.now();
    eggClicksRef.current = [...eggClicksRef.current.filter((t) => now - t < EGG_CLICK_WINDOW), now];
    if (eggClicksRef.current.length >= EGG_CLICK_COUNT) {
      setChartUnlocked(true);
      db.settings.put({ key: EGG_CHART_KEY, value: "true" });
      toast("Easter egg cracked!", { description: "6-month trend chart unlocked." });
      eggClicksRef.current = [];
    }
  }, [chartUnlocked]);

  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const transactions = useLiveQuery(
    () =>
      db.transactions
        .where("occurredAt")
        .between(startOfMonth(month).getTime(), endOfMonth(month).getTime())
        .reverse()
        .sortBy("occurredAt"),
    [month.getTime()],
  );

  const allTx = useLiveQuery(() => db.transactions.toArray(), []);

  const { income, expense, balance } = useMemo(() => {
    const inc = (transactions ?? [])
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const exp = (transactions ?? [])
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    return { income: inc, expense: exp, balance: inc - exp };
  }, [transactions]);

  const monthlyChart = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(month, 5 - i));
    return months.map((m) => {
      const inMonth = (allTx ?? []).filter((t) => isSameMonth(new Date(t.occurredAt), m));
      return {
        label: format(m, "MMM"),
        income: inMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: inMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [allTx, month]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<number, number>();
    (transactions ?? [])
      .filter((t) => t.type === "expense")
      .forEach((t) => map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount));
    return Array.from(map.entries()).map(([categoryId, value]) => {
      const cat = categories?.find((c) => c.id === categoryId);
      return { name: cat?.name ?? "Other", value, color: cat?.color ?? "#94a3b8" };
    });
  }, [transactions, categories]);

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof transactions>();
    (transactions ?? []).forEach((t) => {
      const key = format(new Date(t.occurredAt), "yyyy-MM-dd");
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    });
    return Array.from(groups.entries());
  }, [transactions]);

  const deleteTx = useCallback(async (t: Transaction) => {
    await db.transactions.delete(t.id!);
    toast("Transaction deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          await db.transactions.put(t);
        },
      },
    });
  }, []);
  return (
    <AppShell>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Overview
          </p>
          <h1 className="text-2xl font-bold">Wallet</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-card px-2 py-1 shadow-sm">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-semibold">{format(month, "MMM yyyy")}</span>
          <button
            onClick={() => setMonth((m) => subMonths(m, -1))}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 relative rounded-3xl bg-sky p-5 text-sky-foreground shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium opacity-80">
            <Wallet className="h-4 w-4" /> Balance this month
          </div>
          <p className="mt-1 text-3xl font-bold">{fmt(balance)}</p>
          {!chartUnlocked && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEggClick();
              }}
              className="absolute -right-2 -top-2 rotate-6 opacity-30 transition-all hover:opacity-60 active:scale-90 animate-pulse"
              aria-label="???"
            >
              <img src="/easter-egg-2.png" alt="?" className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-income">
            <TrendingUp className="h-3.5 w-3.5" /> Income
          </div>
          <p className="mt-1 text-xl font-bold">{fmt(income)}</p>
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-medium text-expense">
            <TrendingDown className="h-3.5 w-3.5" /> Expense
          </div>
          <p className="mt-1 text-xl font-bold">{fmt(expense)}</p>
        </div>
      </div>

      <section className="mt-6 rounded-3xl bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Last 6 months</h2>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChart} barGap={4} barCategoryGap={12}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis hide width={0} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }}
              />
              <Bar dataKey="income" fill="var(--income)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" fill="var(--expense)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {chartUnlocked && (
        <section className="mt-4 rounded-3xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Income vs Expense Trend</h2>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChart} margin={{ left: 20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickMargin={8}
                />
                <YAxis
                  width={28}
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="var(--income)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="expense"
                  stroke="var(--expense)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {categoryBreakdown.length > 0 && (
        <section className="mt-4 rounded-3xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">By category</h2>
          <div className="flex items-center gap-4">
            <div className="h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    innerRadius={36}
                    outerRadius={56}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryBreakdown.map((c, i) => (
                      <Cell key={i} fill={c.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5 text-sm">
              {categoryBreakdown.slice(0, 5).map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <span className="font-medium">{fmt(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold">Transactions</h2>
        {grouped.length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">No transactions this month yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">Tap + to add one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {isSameDay(new Date(day), new Date())
                    ? "Today"
                    : format(new Date(day), "EEE, MMM d")}
                </p>
                <ul className="space-y-1.5">
                  {(items ?? []).map((t) => {
                    const cat = categories?.find((c) => c.id === t.categoryId);
                    return (
                      <li key={t.id}>
                        <SwipeRow
                          onDelete={() => deleteTx(t)}
                          deleteLabel="Delete transaction"
                          className="shadow-sm"
                        >
                          <div className="flex items-center gap-3 p-3">
                            <span
                              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                              style={{ background: `${cat?.color}22`, color: cat?.color }}
                            >
                              {(cat?.name ?? "?").slice(0, 1).toUpperCase()}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{cat?.name ?? "Other"}</p>
                              {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                            </div>
                            <span
                              className={`text-sm font-bold ${t.type === "income" ? "text-income" : "text-expense"}`}
                            >
                              {t.type === "income" ? "+" : "−"}
                              {fmt(t.amount)}
                            </span>
                          </div>
                        </SwipeRow>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <Fab onClick={openAdd} label="Add transaction" />
      <AddTxDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories ?? []}
        editing={editing}
      />
    </AppShell>
  );
}

function AddTxDialog({
  open,
  onOpenChange,
  categories,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: { id?: number; name: string; type: TxType; icon: string; color: string }[];
  editing: Transaction | null;
}) {
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const filtered = categories.filter((c) => c.type === type);

  // Re-seed the form whenever the dialog opens, either blank or with the
  // transaction being edited.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setAmount(String(editing.amount));
      setCategoryId(editing.categoryId);
      setNote(editing.note ?? "");
      setDate(format(new Date(editing.occurredAt), "yyyy-MM-dd"));
    } else {
      setType("expense");
      setAmount("");
      setCategoryId(null);
      setNote("");
      setDate(format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, editing]);

  async function save() {
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    if (!categoryId) {
      toast.error("Pick a category");
      return;
    }
    const payload = {
      type,
      amount: n,
      categoryId,
      note: note.trim() || undefined,
      occurredAt: new Date(`${date}T00:00:00`).getTime(),
    };
    if (editing?.id) {
      await db.transactions.update(editing.id, payload);
      toast.success("Transaction updated");
    } else {
      await db.transactions.add(payload);
      toast.success("Transaction added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit transaction" : "Add transaction"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          {(["expense", "income"] as TxType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                setCategoryId(null);
              }}
              className={`rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
                type === t ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Amount</label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 h-14 rounded-2xl text-2xl font-bold"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id!)}
                className={`flex flex-col items-center gap-1 rounded-2xl p-2 text-xs transition-all ${
                  categoryId === c.id ? "bg-sky-soft ring-2 ring-sky" : "bg-muted"
                }`}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                  style={{ background: `${c.color}33`, color: c.color }}
                >
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 rounded-2xl"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was it for?"
            rows={2}
            className="mt-1 rounded-2xl"
          />
        </div>

        <Button onClick={save} className="h-12 rounded-2xl text-base font-semibold">
          {editing ? "Save changes" : "Save"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
