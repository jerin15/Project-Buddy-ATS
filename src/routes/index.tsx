import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Clock, DollarSign, AlertTriangle, TrendingUp, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Project Tracker — Cost, Time & Overflow" },
      { name: "description", content: "Track projects with budgets, hours, and overflow alerts in one minimal dashboard." },
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
};

const STORAGE_KEY = "tracker.projects.v1";

const seed: Project[] = [
  { id: "1", name: "Acme Website Redesign", client: "Acme Co.", budgetCost: 12000, spentCost: 8400, budgetHours: 80, spentHours: 62, status: "active", createdAt: Date.now() - 86400000 * 12 },
  { id: "2", name: "Mobile App MVP", client: "Northwind", budgetCost: 24000, spentCost: 26500, budgetHours: 160, spentHours: 178, status: "active", createdAt: Date.now() - 86400000 * 40 },
  { id: "3", name: "Brand Refresh", client: "Lumen", budgetCost: 6000, spentCost: 3100, budgetHours: 40, spentHours: 18, status: "paused", createdAt: Date.now() - 86400000 * 5 },
];

function load(): Project[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    return JSON.parse(raw);
  } catch {
    return seed;
  }
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function Index() {
  const [projects, setProjects] = useState<Project[]>(seed);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  useEffect(() => {
    setProjects(load());
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto max-w-6xl px-5 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Project Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Cost, time, and overflow at a glance.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}>
                <Plus className="h-4 w-4" /> New project
              </Button>
            </DialogTrigger>
            <ProjectDialog
              key={editing?.id ?? "new"}
              initial={editing}
              onSubmit={(p) => { upsert(p); setOpen(false); setEditing(null); }}
            />
          </Dialog>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 space-y-8">
        {/* Summary */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Budget"
            value={fmtMoney(totals.budgetCost)}
            sub={`${fmtMoney(totals.spentCost)} spent`}
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label="Hours"
            value={`${totals.spentHours} / ${totals.budgetHours}h`}
            sub={`${Math.max(0, totals.budgetHours - totals.spentHours)}h remaining`}
          />
          <SummaryCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Cost progress"
            value={`${totals.budgetCost === 0 ? 0 : Math.round((totals.spentCost / totals.budgetCost) * 100)}%`}
            sub="Across all projects"
          />
          <SummaryCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Overflowing"
            value={String(totals.overflowing)}
            sub={totals.overflowing ? "Over budget or time" : "All on track"}
            tone={totals.overflowing ? "warn" : "ok"}
          />
        </section>

        {/* Projects */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            <span className="text-xs text-muted-foreground">{projects.length} total</span>
          </div>

          {projects.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">
              No projects yet. Click <span className="font-medium text-foreground">New project</span> to start.
            </Card>
          )}

          <div className="grid gap-3">
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                onEdit={() => { setEditing(p); setOpen(true); }}
                onDelete={() => remove(p.id)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({
  icon, label, value, sub, tone = "neutral",
}: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "neutral" | "ok" | "warn" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        <span className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md",
          tone === "warn" ? "bg-destructive/10 text-destructive" :
          tone === "ok" ? "bg-success/10 text-success" :
          "bg-secondary text-secondary-foreground",
        )}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function ProjectRow({ project, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  const costPct = project.budgetCost === 0 ? 0 : (project.spentCost / project.budgetCost) * 100;
  const hoursPct = project.budgetHours === 0 ? 0 : (project.spentHours / project.budgetHours) * 100;
  const costOver = project.spentCost > project.budgetCost;
  const hoursOver = project.spentHours > project.budgetHours;
  const overflowing = costOver || hoursOver;

  return (
    <Card className={cn("p-5", overflowing && "ring-1 ring-destructive/30")}>
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
          {project.client && (
            <p className="text-xs text-muted-foreground mt-0.5">{project.client}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <MetricBar
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Cost"
          left={fmtMoney(project.spentCost)}
          right={fmtMoney(project.budgetCost)}
          pct={costPct}
          over={costOver}
          overflowAmount={costOver ? fmtMoney(project.spentCost - project.budgetCost) : undefined}
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
    </Card>
  );
}

function MetricBar({
  icon, label, left, right, pct, over, overflowAmount,
}: { icon: React.ReactNode; label: string; left: string; right: string; pct: number; over: boolean; overflowAmount?: string }) {
  const display = Math.min(pct, 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {icon} {label}
        </span>
        <span className="tabular-nums font-medium">
          {left} <span className="text-muted-foreground">/ {right}</span>
        </span>
      </div>
      <Progress value={display} className={cn(over && "[&>div]:bg-destructive")} />
      <div className="flex justify-between mt-1 text-[11px] text-muted-foreground tabular-nums">
        <span>{Math.round(pct)}%</span>
        {over && <span className="text-destructive font-medium">+{overflowAmount} over</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const map = {
    active: { label: "Active", cls: "bg-success/10 text-success border-success/20" },
    paused: { label: "Paused", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    done: { label: "Done", cls: "bg-secondary text-secondary-foreground border-border" },
  } as const;
  const s = map[status];
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", s.cls)}>{s.label}</span>;
}

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
    },
  );

  const set = <K extends keyof Project>(k: K, v: Project[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <DialogContent>
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
            <Label>Budget ($)</Label>
            <Input type="number" min={0} value={form.budgetCost} onChange={(e) => set("budgetCost", +e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Spent ($)</Label>
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
                  form.status === s ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-secondary",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          disabled={!form.name.trim()}
          onClick={() => onSubmit(form)}
        >
          <Check className="h-4 w-4" /> {initial ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
