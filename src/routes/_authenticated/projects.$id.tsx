import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Save, Trash2, Clock, AlertTriangle, Calendar, User, Activity as ActivityIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Dirham, Aed } from "@/components/Dirham";
import { fmtDate, isOverBudget, isOverTime, isOverdue, type Project } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Activity = {
  id: string;
  action: string;
  user_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [{ title: "Project — ANIMA Tech Studio" }],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [form, setForm] = useState<Partial<Project>>({});
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (!mounted) return;
      if (error) {
        toast.error(error.message);
      } else if (!data) {
        setNotFound(true);
      } else {
        setProject(data as Project);
        setForm(data as Project);
      }
      const { data: acts } = await supabase
        .from("project_activity")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (mounted) setActivity((acts ?? []) as Activity[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`project-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "projects", filter: `id=eq.${id}` },
        (payload) => {
          const next = payload.new as Project;
          setProject(next);
          setForm((prev) => ({ ...next, ...prev })); // keep dirty edits
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "project_activity", filter: `project_id=eq.${id}` },
        (payload) => setActivity((prev) => [payload.new as Activity, ...prev].slice(0, 20)),
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const save = async () => {
    if (!project) return;
    setBusy(true);
    const patch = {
      name: String(form.name ?? project.name),
      client: form.client ?? null,
      description: form.description ?? null,
      status: (form.status ?? project.status) as Project["status"],
      budget_cost: Number(form.budget_cost ?? project.budget_cost) || 0,
      spent_cost: Number(form.spent_cost ?? project.spent_cost) || 0,
      budget_hours: Number(form.budget_hours ?? project.budget_hours) || 0,
      spent_hours: Number(form.spent_hours ?? project.spent_hours) || 0,
      start_date: String(form.start_date ?? project.start_date),
      due_date: form.due_date ?? null,
    };
    const { error } = await supabase.from("projects").update(patch).eq("id", project.id);
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("project_activity").insert({
      project_id: project.id,
      user_id: u.user?.id ?? null,
      user_email: u.user?.email ?? null,
      action: "updated",
      details: patch,
    });
    toast.success("Saved");
    setBusy(false);
  };

  const remove = async () => {
    if (!project) return;
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (error) return toast.error(error.message);
    toast.success("Project deleted");
    navigate({ to: "/" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (notFound || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Project not found</h1>
          <Link to="/" className="mt-3 inline-block text-sm text-muted-foreground underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const costPct = Number(project.budget_cost) === 0 ? 0 : (Number(project.spent_cost) / Number(project.budget_cost)) * 100;
  const hoursPct = Number(project.budget_hours) === 0 ? 0 : (Number(project.spent_hours) / Number(project.budget_hours)) * 100;
  const costOver = isOverBudget(project);
  const hoursOver = isOverTime(project);
  const overdue = isOverdue(project);

  const set = <K extends keyof Project>(k: K, v: Project[K] | string | null) =>
    setForm((f) => ({ ...f, [k]: v as Project[K] }));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-foreground/10 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-5 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                  <AlertDialogDescription>This cannot be undone. All activity history will also be removed.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={save} disabled={busy} size="sm">
              <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 space-y-6">
        {/* Overview */}
        <section className="glass p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <div className="mt-1 text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{project.client ?? "—"}</span>
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmtDate(project.start_date)} → {fmtDate(project.due_date)}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {costOver && <Tag warn>Over budget</Tag>}
              {hoursOver && <Tag warn>Over time</Tag>}
              {overdue && <Tag warn>Overdue</Tag>}
              {!costOver && !hoursOver && !overdue && <Tag>On track</Tag>}
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-6">
            <LiveMetric
              title="Cost"
              icon={<Dirham className="h-4" />}
              spent={<Aed value={Number(project.spent_cost)} />}
              budget={<Aed value={Number(project.budget_cost)} />}
              pct={costPct}
              over={costOver}
              overText={costOver ? <span>+ <Aed value={Number(project.spent_cost) - Number(project.budget_cost)} /> over budget</span> : `${Math.round(costPct)}% used`}
            />
            <LiveMetric
              title="Time"
              icon={<Clock className="h-4 w-4" />}
              spent={<span>{Math.round(Number(project.spent_hours))}h</span>}
              budget={<span>{Math.round(Number(project.budget_hours))}h</span>}
              pct={hoursPct}
              over={hoursOver}
              overText={hoursOver ? `+${Math.round(Number(project.spent_hours) - Number(project.budget_hours))}h over budget` : `${Math.round(hoursPct)}% used`}
            />
          </div>
        </section>

        {/* Edit */}
        <section className="glass p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Details</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Project name">
              <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Client">
              <Input value={form.client ?? ""} onChange={(e) => set("client", e.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={String(form.status ?? "active")} onValueChange={(v) => set("status", v as Project["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Start date">
              <Input type="date" value={String(form.start_date ?? "").slice(0, 10)} onChange={(e) => set("start_date", e.target.value)} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={String(form.due_date ?? "").slice(0, 10)} onChange={(e) => set("due_date", e.target.value)} />
            </Field>
            <div />
            <Field label="Budget (AED)">
              <Input type="number" min="0" value={form.budget_cost ?? 0} onChange={(e) => set("budget_cost", Number(e.target.value))} />
            </Field>
            <Field label="Spent (AED)">
              <Input type="number" min="0" value={form.spent_cost ?? 0} onChange={(e) => set("spent_cost", Number(e.target.value))} />
            </Field>
            <Field label="Budget (hours)">
              <Input type="number" min="0" value={form.budget_hours ?? 0} onChange={(e) => set("budget_hours", Number(e.target.value))} />
            </Field>
            <Field label="Spent (hours)">
              <Input type="number" min="0" value={form.spent_hours ?? 0} onChange={(e) => set("spent_hours", Number(e.target.value))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes">
                <Textarea rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Scope, notes, links…" />
              </Field>
            </div>
          </div>
        </section>

        {/* Activity */}
        <section className="glass p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ActivityIcon className="h-4 w-4" /> Recent activity
          </h2>
          {activity.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No activity yet. Save changes to record history.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-3 border-b border-foreground/10 last:border-0 pb-2 last:pb-0">
                  <span>
                    <span className="text-muted-foreground">{a.user_email ?? "someone"}</span>{" "}
                    <span className="font-medium">{a.action}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(a.created_at).toLocaleString("en-AE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Tag({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border",
      warn ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-foreground/15 bg-foreground/5 text-muted-foreground",
    )}>
      {warn && <AlertTriangle className="h-3 w-3" />}
      {children}
    </span>
  );
}

function LiveMetric({
  title, icon, spent, budget, pct, over, overText,
}: {
  title: string; icon: React.ReactNode;
  spent: React.ReactNode; budget: React.ReactNode;
  pct: number; over: boolean; overText: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">{icon} {title}</span>
        <span className={cn("font-semibold", over && "text-destructive")}>{Math.round(pct)}%</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={cn("text-xl font-semibold", over && "text-destructive")}>{spent}</span>
        <span className="text-xs text-muted-foreground">/ {budget}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-foreground/5 overflow-hidden">
        <div
          className={cn("h-full transition-all", over ? "bg-destructive" : "bg-foreground/85")}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className={cn("mt-1 text-[11px]", over ? "text-destructive font-medium" : "text-muted-foreground")}>{overText}</div>
    </div>
  );
}
