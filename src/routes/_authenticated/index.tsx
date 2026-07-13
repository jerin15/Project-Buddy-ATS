import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Clock, AlertTriangle, TrendingUp, LogOut, Settings as SettingsIcon,
  Sun, Moon, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AnimaLogo } from "@/components/AnimaLogo";
import { Dirham, Aed } from "@/components/Dirham";
import { fmtDate, isOverBudget, isOverTime, isOverdue, type Project } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PunchReminder } from "@/components/PunchReminder";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ANIMA Tech Studio" },
      { name: "description", content: "Live project portfolio: budget, hours and overflow tracking for ANIMA Tech Studio." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const saved = (localStorage.getItem("ats.theme.v1") as "light" | "dark" | null) ?? "light";
    setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("ats.theme.v1", theme);
  }, [theme]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
  }, []);

  // initial load + realtime
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) toast.error(error.message);
      else setProjects((data ?? []) as Project[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel("projects-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, (payload) => {
        setProjects((prev) => {
          if (payload.eventType === "INSERT") return [payload.new as Project, ...prev];
          if (payload.eventType === "UPDATE")
            return prev.map((p) => (p.id === (payload.new as Project).id ? (payload.new as Project) : p));
          if (payload.eventType === "DELETE")
            return prev.filter((p) => p.id !== (payload.old as Project).id);
          return prev;
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const totals = useMemo(() => {
    return projects.reduce(
      (a, p) => {
        a.budget += Number(p.budget_cost);
        a.spent += Number(p.spent_cost);
        a.hoursBudget += Number(p.budget_hours);
        a.hoursSpent += Number(p.spent_hours);
        if (isOverBudget(p) || isOverTime(p) || isOverdue(p)) a.over += 1;
        return a;
      },
      { budget: 0, spent: 0, hoursBudget: 0, hoursSpent: 0, over: 0 },
    );
  }, [projects]);

  const portfolioPct = totals.budget === 0 ? 0 : (totals.spent / totals.budget) * 100;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <AnimaLogo className="h-10 w-10 object-contain shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">ANIMA Tech Studio</h1>
              <p className="text-[11px] text-muted-foreground truncate">Project Tracker · live portfolio</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="glass inline-flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/settings"
              className="glass inline-flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Settings"
              title="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
            <button
              onClick={signOut}
              className="glass hidden sm:inline-flex items-center gap-1.5 px-3 h-9 text-xs font-medium text-muted-foreground hover:text-foreground"
              title={userEmail}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-9">
                  <Plus className="h-4 w-4" /> New project
                </Button>
              </DialogTrigger>
              <ProjectDialog
                onDone={() => setDialogOpen(false)}
              />
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 space-y-8">
        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            icon={<Dirham className="h-4" />}
            label="Total budget"
            value={<Aed value={totals.budget} />}
            sub={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label="Spent to date"
            value={<Aed value={totals.spent} />}
            sub={`${Math.round(portfolioPct)}% of budget`}
            warn={portfolioPct > 100}
          />
          <Kpi
            icon={<Clock className="h-4 w-4" />}
            label="Hours"
            value={
              <span className="tabular-nums">
                {Math.round(totals.hoursSpent)}{" "}
                <span className="text-muted-foreground text-base font-normal">
                  / {Math.round(totals.hoursBudget)}h
                </span>
              </span>
            }
            sub={`${Math.max(0, Math.round(totals.hoursBudget - totals.hoursSpent))}h remaining`}
            warn={totals.hoursSpent > totals.hoursBudget && totals.hoursBudget > 0}
          />
          <Kpi
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Overflowing"
            value={<span className="tabular-nums">{totals.over}</span>}
            sub={totals.over ? "Over budget or time" : "All on track"}
            warn={totals.over > 0}
          />
        </section>

        {/* Portfolio bar */}
        <section className="glass p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Portfolio spend
              </h2>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">
                  <Aed value={totals.spent} />
                </span>
                <span className="text-muted-foreground text-sm">
                  of <Aed value={totals.budget} />
                </span>
              </div>
            </div>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                portfolioPct > 100 ? "text-destructive" : "text-foreground",
              )}
            >
              {Math.round(portfolioPct)}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-foreground/5 border border-foreground/10 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                portfolioPct > 100 ? "bg-destructive" : "bg-foreground/85",
              )}
              style={{ width: `${Math.min(100, portfolioPct)}%` }}
            />
          </div>
        </section>

        {/* Projects list */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            <span className="text-xs text-muted-foreground">
              {projects.length} · click a card to open
            </span>
          </div>

          {loading ? (
            <div className="glass p-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : projects.length === 0 ? (
            <div className="glass p-10 text-center text-muted-foreground text-sm">
              No projects yet. Click <span className="font-medium text-foreground">New project</span> to add the first one.
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        <footer className="pt-6 pb-4 text-center text-[11px] text-muted-foreground">
          ANIMA Tech Studio · Technology with a soul
        </footer>
      </main>
    </div>
  );
}

function Kpi({
  icon, label, value, sub, warn = false,
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; warn?: boolean;
}) {
  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-[11px] uppercase tracking-wider">
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-md border border-foreground/10 bg-foreground/5",
            warn && "text-destructive",
          )}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", warn && "text-destructive")}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function ProjectCard({ project: p }: { project: Project }) {
  const costPct = Number(p.budget_cost) === 0 ? 0 : (Number(p.spent_cost) / Number(p.budget_cost)) * 100;
  const hoursPct = Number(p.budget_hours) === 0 ? 0 : (Number(p.spent_hours) / Number(p.budget_hours)) * 100;
  const costOver = isOverBudget(p);
  const hoursOver = isOverTime(p);
  const overdue = isOverdue(p);
  const anyOver = costOver || hoursOver || overdue;

  return (
    <Link
      to="/projects/$id"
      params={{ id: p.id }}
      className={cn(
        "glass p-4 block transition-all hover:bg-foreground/[0.03] hover:border-foreground/20 group",
        anyOver && "border-destructive/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{p.name}</h3>
            <StatusBadge status={p.status} />
            {anyOver && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-0.5" />
                {overdue ? "Overdue" : costOver ? "Over budget" : "Over time"}
              </Badge>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {p.client ?? "—"} · {fmtDate(p.start_date)} → {fmtDate(p.due_date)}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <MetricBar
          label="Cost"
          icon={<Dirham className="h-3.5" />}
          value={<><Aed value={Number(p.spent_cost)} /> <span className="text-muted-foreground">/ <Aed value={Number(p.budget_cost)} /></span></>}
          pct={costPct}
          over={costOver}
          overText={costOver ? `+ AED ${Math.round(Number(p.spent_cost) - Number(p.budget_cost)).toLocaleString()} over` : `${Math.round(costPct)}%`}
        />
        <MetricBar
          label="Time"
          icon={<Clock className="h-3.5 w-3.5" />}
          value={<span className="tabular-nums">{Math.round(Number(p.spent_hours))}h <span className="text-muted-foreground">/ {Math.round(Number(p.budget_hours))}h</span></span>}
          pct={hoursPct}
          over={hoursOver}
          overText={hoursOver ? `+${Math.round(Number(p.spent_hours) - Number(p.budget_hours))}h over` : `${Math.round(hoursPct)}%`}
        />
      </div>
    </Link>
  );
}

function MetricBar({
  label, icon, value, pct, over, overText,
}: {
  label: string; icon: React.ReactNode; value: React.ReactNode;
  pct: number; over: boolean; overText: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {icon} {label}
        </span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
        <div
          className={cn("h-full transition-all", over ? "bg-destructive" : "bg-foreground/80")}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className={cn("mt-1 text-[10px] tabular-nums", over ? "text-destructive font-medium" : "text-muted-foreground")}>
        {overText}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const label = status === "active" ? "Active" : status === "paused" ? "Paused" : "Done";
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-foreground/15 bg-foreground/5 text-muted-foreground uppercase tracking-wider">
      {label}
    </span>
  );
}

/* -------- New project dialog -------- */

function ProjectDialog({ onDone }: { onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Project["status"]>("active");
  const [startDate, setStartDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [hoursPerDay, setHoursPerDay] = useState("8");
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [budgetHours, setBudgetHours] = useState("");
  const [hoursManual, setHoursManual] = useState(false);
  const [budgetCost, setBudgetCost] = useState("");
  const [spentCost, setSpentCost] = useState("");
  const [spentHours, setSpentHours] = useState("");
  const [busy, setBusy] = useState(false);

  // Auto-calc budget hours from date range × hours/day (working days by default)
  const autoHours = useMemo(() => {
    if (!startDate || !dueDate) return 0;
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(dueDate + "T00:00:00");
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    let days = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (includeWeekends || (dow !== 0 && dow !== 6)) days += 1;
    }
    return Math.round(days * (Number(hoursPerDay) || 0));
  }, [startDate, dueDate, hoursPerDay, includeWeekends]);

  useEffect(() => {
    if (!hoursManual) setBudgetHours(autoHours ? String(autoHours) : "");
  }, [autoHours, hoursManual]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        client: client.trim() || null,
        description: description.trim() || null,
        status,
        start_date: startDate || today,
        due_date: dueDate || null,
        budget_cost: Number(budgetCost) || 0,
        budget_hours: Number(budgetHours) || 0,
        spent_cost: Number(spentCost) || 0,
        spent_hours: Number(spentHours) || 0,
        created_by: userRes.user?.id ?? null,
      })
      .select()
      .single();
    if (!error && inserted) {
      await supabase.from("project_activity").insert({
        project_id: inserted.id,
        user_id: userRes.user?.id ?? null,
        user_email: userRes.user?.email ?? null,
        action: "created",
        details: { name: inserted.name },
      });
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project created");
    onDone();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription className="text-xs">
          Any dates allowed — including past dates so you can back-fill existing projects.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Project name *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Website redesign" />
          </div>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Acme Co." />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Project["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description / notes</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scope, deliverables, links…" />
          </div>
        </div>

        <div className="rounded-lg border border-foreground/10 p-3 space-y-3 bg-foreground/[0.02]">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Hours per working day</Label>
              <Input type="number" min="0" step="0.5" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-xs text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={includeWeekends}
                onChange={(e) => setIncludeWeekends(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              Include weekends
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Auto-calculated: <span className="font-medium text-foreground tabular-nums">{autoHours}h</span> across{" "}
            {startDate && dueDate ? "the selected range" : "—"}. Override below if needed.
          </p>
        </div>

        <div className="rounded-lg border border-foreground/10 p-3 space-y-3 bg-foreground/[0.02]">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Budget & tracking</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Budget (AED)</Label>
              <Input type="number" min="0" value={budgetCost} onChange={(e) => setBudgetCost(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center justify-between">
                <span>Budget (hours)</span>
                {hoursManual && (
                  <button type="button" onClick={() => { setHoursManual(false); }} className="text-[10px] text-muted-foreground underline">
                    reset to auto
                  </button>
                )}
              </Label>
              <Input
                type="number"
                min="0"
                value={budgetHours}
                onChange={(e) => { setBudgetHours(e.target.value); setHoursManual(true); }}
                placeholder={String(autoHours)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Already spent (AED)</Label>
              <Input type="number" min="0" value={spentCost} onChange={(e) => setSpentCost(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Hours already logged</Label>
              <Input type="number" min="0" value={spentHours} onChange={(e) => setSpentHours(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
