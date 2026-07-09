import { useEffect, useMemo, useState } from "react";
import { Play, Square, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TimeEntry = {
  id: string;
  project_id: string;
  user_id: string | null;
  user_email: string | null;
  work_date: string;
  punch_in: string;
  punch_out: string | null;
  hours: number;
  note: string | null;
};

function fmtDur(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AE", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit" });
}
function fmtDay(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-AE", { day: "2-digit", month: "short" });
}

export function TimeTracker({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [me, setMe] = useState<{ id: string | null; email: string | null }>({ id: null, email: null });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe({ id: data.user?.id ?? null, email: data.user?.email ?? null }));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("time_entries" as never)
        .select("*")
        .eq("project_id", projectId)
        .order("punch_in", { ascending: false })
        .limit(30);
      if (!mounted) return;
      if (error) toast.error(error.message);
      else setEntries((data ?? []) as unknown as TimeEntry[]);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`te-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setEntries((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as TimeEntry, ...prev].slice(0, 30);
            if (payload.eventType === "UPDATE")
              return prev.map((e) => (e.id === (payload.new as TimeEntry).id ? (payload.new as TimeEntry) : e));
            if (payload.eventType === "DELETE") return prev.filter((e) => e.id !== (payload.old as TimeEntry).id);
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [projectId]);

  const open = useMemo(
    () => entries.find((e) => e.punch_out === null && (me.id ? e.user_id === me.id : e.user_email === me.email)),
    [entries, me],
  );

  const liveSeconds = useMemo(() => {
    if (!open) return 0;
    return Math.max(0, (now.getTime() - new Date(open.punch_in).getTime()) / 1000);
  }, [open, now]);

  const punchIn = async () => {
    if (busy || open) return;
    setBusy(true);
    const { error } = await supabase.from("time_entries" as never).insert({
      project_id: projectId,
      user_id: me.id,
      user_email: me.email,
      punch_in: new Date().toISOString(),
    } as never);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Punched in");
  };

  const punchOut = async () => {
    if (busy || !open) return;
    setBusy(true);
    const { error } = await supabase
      .from("time_entries" as never)
      .update({ punch_out: new Date().toISOString() } as never)
      .eq("id", open.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Punched out");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("time_entries" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  return (
    <section className="glass p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Clock className="h-4 w-4" /> Time tracking
      </h2>

      <div className="flex items-center justify-between gap-4 flex-wrap rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="flex items-baseline gap-3">
          <div className={cn("text-3xl font-semibold tabular-nums", open && "text-emerald-500 dark:text-emerald-400")}>
            {fmtDur(liveSeconds)}
          </div>
          <div className="text-xs text-muted-foreground">
            {open ? <>Running since {fmtTime(open.punch_in)}</> : "No active session"}
          </div>
        </div>
        {open ? (
          <Button onClick={punchOut} disabled={busy} variant="destructive" size="sm">
            <Square className="h-4 w-4" /> Punch out
          </Button>
        ) : (
          <Button onClick={punchIn} disabled={busy} size="sm">
            <Play className="h-4 w-4" /> Punch in
          </Button>
        )}
      </div>

      <div>
        <div className="text-xs text-muted-foreground mb-2">Recent sessions</div>
        {loading ? (
          <div className="text-xs text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-xs text-muted-foreground">No time logged yet.</div>
        ) : (
          <ul className="divide-y divide-foreground/10 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tabular-nums font-medium">{Number(e.hours).toFixed(2)}h</span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDay(e.work_date)} · {fmtTime(e.punch_in)}
                      {e.punch_out ? ` → ${fmtTime(e.punch_out)}` : " · running"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{e.user_email ?? "—"}</div>
                </div>
                <button
                  onClick={() => remove(e.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  aria-label="Delete entry"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
