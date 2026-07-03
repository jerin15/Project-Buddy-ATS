import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Clock, AlertTriangle, TrendingUp, Pencil, Check,
  Lock, Unlock, Copy, Calendar, LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DirhamSymbol } from "@/components/DirhamSymbol";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Project Tracker — AED Portfolio" },
      { name: "description", content: "Track projects, timelines, hours and AED cost across your portfolio at a glance." },
    ],
  }),
  component: Index,
});

type Project = {
  id: string;
  name: string;
  client?: string;
  budgetCost: number;
  spentCost: number;
  budgetHours: number;
  spentHours: number;
  status: "active" | "paused" | "done";
  createdAt: number;
  dueDate?: number;
};

const STORAGE_KEY = "tracker.projects.v1";
const ADMIN_KEY = "tracker.admin.v1";
const DAY = 86_400_000;

const seed: Project[] = [
  { id: "1", name: "Acme Website Redesign", client: "Acme Co.", budgetCost: 44000, spentCost: 30800, budgetHours: 80, spentHours: 62, status: "active", createdAt: Date.now() - DAY * 12, dueDate: Date.now() + DAY * 18 },
  { id: "2", name: "Mobile App MVP", client: "Northwind", budgetCost: 88000, spentCost: 97300, budgetHours: 160, spentHours: 178, status: "active", createdAt: Date.now() - DAY * 40, dueDate: Date.now() + DAY * 5 },
  { id: "3", name: "Brand Refresh", client: "Lumen", budgetCost: 22000, spentCost: 11400, budgetHours: 40, spentHours: 18, status: "paused", createdAt: Date.now() - DAY * 5, dueDate: Date.now() + DAY * 25 },
];

function load(): Project[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Project[];
    return parsed.map((p) => ({ ...p, dueDate: p.dueDate ?? p.createdAt + DAY * 30 }));
  } catch {
    return seed;
  }
}

const aedFmt = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
const fmtAED = (n: number) => aedFmt.format(n);

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Index() {
  const [projects, setProjects] = useState<Project[]>(seed);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [admin, setAdmin] = useState(false);
  const [passOpen, setPassOpen] = useState(false);

  useEffect(() => {
    setProjects(load());
    // First-run: if no passcode, admin starts unlocked
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ADMIN_KEY);
      if (!stored) setAdmin(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  const totals = useMemo(() => {
    return projects.reduce(
      (acc, p) => {
        acc.budgetCost += p.budgetCost;
        acc.spentCost += p.spentCost;
        acc.budgetHours += p.budgetHours;
        acc.spentHours += p.spentHours;
        if (p.spentCost > p.budgetCost || p.spentHours > p.budgetHours) acc.overflowing += 1;
        return acc;
      },
      { budgetCost: 0, spentCost: 0, budgetHours: 0, spentHours: 0, overflowing: 0 },
    );
  }, [projects]);

  const upsert = (p: Project) => {
    setProjects((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx === -1) return [p, ...prev];
      const copy = [...prev];
      copy[idx] = p;
      return copy;
    });
  };

  const remove = (id: string) => setProjects((p) => p.filter((x) => x.id !== id));
  const duplicate = (p: Project) =>
    setProjects((prev) => [{ ...p, id: crypto.randomUUID(), name: `${p.name} (copy)`, createdAt: Date.now() }, ...prev]);

  const toggleAdmin = () => {
    if (admin) { setAdmin(false); return; }
    const stored = typeof window !== "undefined" ? localStorage.getItem(ADMIN_KEY) : null;
    if (!stored) { setPassOpen(true); return; }
    setPassOpen(true);
  };

  const portfolioPct = totals.budgetCost === 0 ? 0 : (totals.spentCost / totals.budgetCost) * 100;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="glass-strong flex h-10 w-10 items-center justify-center shrink-0">
              <DirhamSymbol className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">
                Project Tracker
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                AED portfolio · cost · time · overflow
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAdmin}
              className={cn(
                "glass inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/10",
                admin ? "text-foreground" : "text-muted-foreground",
              )}
              aria-label={admin ? "Lock admin" : "Unlock admin"}
            >
              {admin ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {admin ? "Admin" : "Locked"}
            </button>
            {admin && (
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditing(null)} className="shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4" /> New project
                  </Button>
                </DialogTrigger>
                <ProjectDialog
                  key={editing?.id ?? "new"}
                  initial={editing}
                  onSubmit={(p) => { upsert(p); setOpen(false); setEditing(null); }}
                />
              </Dialog>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 space-y-8">
        {/* At-a-glance KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<DirhamSymbol className="h-4 w-4" />}
            label="Total budget"
            value={<><DirhamSymbol className="h-4 w-4 mr-1 opacity-70" />{fmtAED(totals.budgetCost)}</>}
            sub={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Spent to date"
            value={<><DirhamSymbol className="h-4 w-4 mr-1 opacity-70" />{fmtAED(totals.spentCost)}</>}
            sub={`${Math.round(portfolioPct)}% of budget`}
            tone={portfolioPct > 100 ? "warn" : "primary"}
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="Hours"
            value={<span className="tabular-nums">{totals.spentHours} <span className="text-muted-foreground text-base font-normal">/ {totals.budgetHours}h</span></span>}
            sub={`${Math.max(0, totals.budgetHours - totals.spentHours)}h remaining`}
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Overflowing"
            value={<span className="tabular-nums">{totals.overflowing}</span>}
            sub={totals.overflowing ? "Over budget or time" : "All on track"}
            tone={totals.overflowing ? "warn" : "ok"}
          />
        </section>

        {/* Portfolio spend meter */}
        <section className="glass p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Portfolio spend</h2>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums inline-flex items-center">
                  <DirhamSymbol className="h-5 w-5 mr-1.5 opacity-70" />{fmtAED(totals.spentCost)}
                </span>
                <span className="text-muted-foreground text-sm tabular-nums">
                  of <DirhamSymbol className="h-3 w-3 mx-0.5 inline opacity-70" />{fmtAED(totals.budgetCost)}
                </span>
              </div>
            </div>
            <span className={cn("text-sm font-semibold tabular-nums", portfolioPct > 100 ? "text-destructive" : "text-foreground")}>
              {Math.round(portfolioPct)}%
            </span>
          </div>
          <PortfolioBar pct={portfolioPct} />
        </section>

        {/* Timeline at a glance */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Timeline</h2>
            <span className="text-xs text-muted-foreground">{projects.length} project{projects.length === 1 ? "" : "s"}</span>
          </div>
          <div className="glass p-4">
            <TimelinePanel projects={projects} />
          </div>
        </section>

        {/* Projects list */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            {admin && <span className="text-xs text-muted-foreground">Click a project to edit</span>}
          </div>

          {projects.length === 0 && (
            <div className="glass p-10 text-center text-muted-foreground">
              No projects yet.{admin && <> Click <span className="font-medium text-foreground">New project</span> to start.</>}
            </div>
          )}

          <div className="grid gap-3">
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                admin={admin}
                onEdit={() => { setEditing(p); setOpen(true); }}
                onDelete={() => remove(p.id)}
                onDuplicate={() => duplicate(p)}
              />
            ))}
          </div>
        </section>

        <footer className="pt-6 pb-4 text-center text-xs text-muted-foreground">
          Data stored locally in this browser.
        </footer>
      </main>

      <PasscodeDialog
        open={passOpen}
        onOpenChange={setPassOpen}
        onUnlock={() => { setAdmin(true); setPassOpen(false); }}
      />
    </div>
  );
}

/* ---------------- KPI ---------------- */

function KpiCard({
  icon, label, value, sub, tone = "neutral",
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string;
  tone?: "neutral" | "ok" | "warn" | "primary";
}) {
  const warn = tone === "warn";
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wider">
        <span className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5",
          warn && "text-destructive",
        )}>
          {icon}
        </span>
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums inline-flex items-center", warn && "text-destructive")}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

/* ---------------- Portfolio bar ---------------- */

function PortfolioBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100);
  const over = pct > 100;
  return (
    <div className="h-2.5 w-full rounded-full bg-white/5 border border-white/10 overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", over ? "bg-destructive" : "bg-foreground/85")}
        style={{ width: `${capped}%` }}
      />
    </div>
  );
}

/* ---------------- Timeline ---------------- */

function TimelinePanel({ projects }: { projects: Project[] }) {
  const now = Date.now();
  const bounds = useMemo(() => {
    if (projects.length === 0) return { min: now - DAY * 30, max: now + DAY * 30 };
    const starts = projects.map((p) => p.createdAt);
    const ends = projects.map((p) => p.dueDate ?? p.createdAt + DAY * 30);
    return {
      min: Math.min(...starts, now - DAY * 3),
      max: Math.max(...ends, now + DAY * 3),
    };
  }, [projects, now]);

  const span = Math.max(1, bounds.max - bounds.min);
  const pos = (t: number) => ((t - bounds.min) / span) * 100;

  if (projects.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">Add a project to see the timeline.</div>;
  }

  return (
    <div className="space-y-3">
      {/* Header ruler */}
      <div className="relative h-4 text-[10px] text-muted-foreground tabular-nums">
        <span className="absolute left-0">{fmtDate(bounds.min)}</span>
        <span className="absolute left-1/2 -translate-x-1/2">Today</span>
        <span className="absolute right-0">{fmtDate(bounds.max)}</span>
      </div>

      <div className="space-y-2.5 relative">
        {/* today line */}
        <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${pos(now)}%` }} />

        {projects.map((p) => {
          const start = pos(p.createdAt);
          const end = pos(p.dueDate ?? p.createdAt + DAY * 30);
          const width = Math.max(1.5, end - start);
          const elapsed = Math.min(100, Math.max(0, ((now - p.createdAt) / Math.max(1, (p.dueDate ?? p.createdAt + DAY * 30) - p.createdAt)) * 100));
          const costOver = p.spentCost > p.budgetCost;
          const overdue = p.dueDate && now > p.dueDate && p.status !== "done";

          return (
            <div key={p.id} className="grid grid-cols-[160px_1fr_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{p.client ?? "—"}</div>
              </div>

              <div className="relative h-6">
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full border overflow-hidden",
                    overdue || costOver ? "border-destructive/40" : "border-white/15",
                    "bg-white/[0.04]",
                  )}
                  style={{ left: `${start}%`, width: `${width}%` }}
                  title={`${fmtDate(p.createdAt)} → ${fmtDate(p.dueDate)}`}
                >
                  <div
                    className={cn(
                      "h-full",
                      overdue ? "bg-destructive/70" :
                      costOver ? "bg-gradient-to-r from-destructive to-orange-400" :
                      p.status === "done" ? "bg-success/70" :
                      p.status === "paused" ? "bg-warning/70" :
                      "bg-gradient-to-r from-primary to-accent",
                    )}
                    style={{ width: `${elapsed}%` }}
                  />
                </div>
              </div>

              <div className="text-xs tabular-nums inline-flex items-center whitespace-nowrap">
                <DirhamSymbol className="h-3 w-3 mr-1 opacity-70" />
                <span className={cn(costOver && "text-destructive font-medium")}>{fmtAED(p.spentCost)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Project row ---------------- */

function ProjectRow({
  project, admin, onEdit, onDelete, onDuplicate,
}: {
  project: Project; admin: boolean;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void;
}) {
  const costPct = project.budgetCost === 0 ? 0 : (project.spentCost / project.budgetCost) * 100;
  const hoursPct = project.budgetHours === 0 ? 0 : (project.spentHours / project.budgetHours) * 100;
  const costOver = project.spentCost > project.budgetCost;
  const hoursOver = project.spentHours > project.budgetHours;
  const overflowing = costOver || hoursOver;

  return (
    <div className={cn("glass p-5 transition-colors", overflowing && "ring-1 ring-destructive/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{project.name}</h3>
            <StatusBadge status={project.status} />
            {overflowing && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Overflow
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-2">
            {project.client && <span>{project.client}</span>}
            {project.client && <span className="text-white/20">·</span>}
            <Calendar className="h-3 w-3" />
            <span className="tabular-nums">{fmtDate(project.createdAt)} → {fmtDate(project.dueDate)}</span>
          </p>
        </div>
        {admin && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onDuplicate} aria-label="Duplicate" className="hover:bg-white/10">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit" className="hover:bg-white/10">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete" className="hover:bg-destructive/20 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <MetricBar
          icon={<DirhamSymbol className="h-3.5 w-3.5" />}
          label="Cost"
          left={<><DirhamSymbol className="h-3 w-3 mr-0.5 opacity-70 inline" />{fmtAED(project.spentCost)}</>}
          right={<><DirhamSymbol className="h-3 w-3 mr-0.5 opacity-70 inline" />{fmtAED(project.budgetCost)}</>}
          pct={costPct}
          over={costOver}
          overflowAmount={costOver ? <><DirhamSymbol className="h-3 w-3 mr-0.5 inline" />{fmtAED(project.spentCost - project.budgetCost)}</> : undefined}
        />
        <MetricBar
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Time"
          left={`${project.spentHours}h`}
          right={`${project.budgetHours}h`}
          pct={hoursPct}
          over={hoursOver}
          overflowAmount={hoursOver ? `${project.spentHours - project.budgetHours}h` : undefined}
        />
      </div>
    </div>
  );
}

function MetricBar({
  icon, label, left, right, pct, over, overflowAmount,
}: {
  icon: React.ReactNode; label: string;
  left: React.ReactNode; right: React.ReactNode; pct: number;
  over: boolean; overflowAmount?: React.ReactNode;
}) {
  const display = Math.min(pct, 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {icon} {label}
        </span>
        <span className="tabular-nums font-medium inline-flex items-center gap-1">
          {left} <span className="text-muted-foreground">/</span> {right}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            over ? "bg-gradient-to-r from-destructive to-orange-400"
                 : "bg-gradient-to-r from-primary to-accent",
          )}
          style={{ width: `${display}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[11px] text-muted-foreground tabular-nums">
        <span>{Math.round(pct)}%</span>
        {over && <span className="text-destructive font-medium inline-flex items-center gap-0.5">+{overflowAmount} over</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const map = {
    active: { label: "Active", cls: "bg-success/15 text-success border-success/30" },
    paused: { label: "Paused", cls: "bg-warning/15 text-warning border-warning/30" },
    done: { label: "Done", cls: "bg-white/10 text-muted-foreground border-white/15" },
  } as const;
  const s = map[status];
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", s.cls)}>{s.label}</span>;
}

/* ---------------- Dialogs ---------------- */

function ProjectDialog({ initial, onSubmit }: { initial: Project | null; onSubmit: (p: Project) => void }) {
  const [form, setForm] = useState<Project>(
    initial ?? {
      id: crypto.randomUUID(),
      name: "",
      client: "",
      budgetCost: 0,
      spentCost: 0,
      budgetHours: 0,
      spentHours: 0,
      status: "active",
      createdAt: Date.now(),
      dueDate: Date.now() + DAY * 30,
    },
  );

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toDateInput = (ms?: number) => ms ? new Date(ms).toISOString().slice(0, 10) : "";

  return (
    <DialogContent className="backdrop-blur-xl bg-popover/90 border-white/10">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit project" : "New project"}</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme website" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="client">Client</Label>
          <Input id="client" value={form.client ?? ""} onChange={(e) => set("client", e.target.value)} placeholder="Optional" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="inline-flex items-center gap-1">Budget <DirhamSymbol className="h-3 w-3" /></Label>
            <Input type="number" min={0} value={form.budgetCost} onChange={(e) => set("budgetCost", +e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label className="inline-flex items-center gap-1">Spent <DirhamSymbol className="h-3 w-3" /></Label>
            <Input type="number" min={0} value={form.spentCost} onChange={(e) => set("spentCost", +e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Budget (hours)</Label>
            <Input type="number" min={0} value={form.budgetHours} onChange={(e) => set("budgetHours", +e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Spent (hours)</Label>
            <Input type="number" min={0} value={form.spentHours} onChange={(e) => set("spentHours", +e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Start date</Label>
            <Input
              type="date"
              value={toDateInput(form.createdAt)}
              onChange={(e) => set("createdAt", e.target.value ? new Date(e.target.value).getTime() : Date.now())}
            />
          </div>
          <div className="grid gap-2">
            <Label>Due date</Label>
            <Input
              type="date"
              value={toDateInput(form.dueDate)}
              onChange={(e) => set("dueDate", e.target.value ? new Date(e.target.value).getTime() : undefined)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Status</Label>
          <div className="flex gap-2">
            {(["active", "paused", "done"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set("status", s)}
                className={cn(
                  "flex-1 rounded-md border px-3 py-1.5 text-sm capitalize transition-colors",
                  form.status === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white/5 border-white/10 hover:bg-white/10",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button disabled={!form.name.trim()} onClick={() => onSubmit(form)}>
          <Check className="h-4 w-4" /> {initial ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PasscodeDialog({
  open, onOpenChange, onUnlock,
}: { open: boolean; onOpenChange: (v: boolean) => void; onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stored = typeof window !== "undefined" ? localStorage.getItem(ADMIN_KEY) : null;
  const isSetup = !stored;

  useEffect(() => { if (open) { setValue(""); setError(null); } }, [open]);

  const submit = () => {
    if (!value.trim()) { setError("Enter a passcode"); return; }
    if (isSetup) {
      localStorage.setItem(ADMIN_KEY, btoa(value));
      onUnlock();
    } else if (stored === btoa(value)) {
      onUnlock();
    } else {
      setError("Incorrect passcode");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="backdrop-blur-xl bg-popover/90 border-white/10">
        <DialogHeader>
          <DialogTitle>{isSetup ? "Set admin passcode" : "Unlock admin"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Label htmlFor="pass">Passcode</Label>
          <Input
            id="pass"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={isSetup ? "Create a passcode" : "Enter passcode"}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-[11px] text-muted-foreground">
            Stored locally in this browser. Admins can create, edit, duplicate and delete projects.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit}>{isSetup ? "Set & unlock" : "Unlock"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
