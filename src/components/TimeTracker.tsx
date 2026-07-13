import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Clock, Trash2, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import { Pomodoro } from "@/components/Pomodoro";
import { downloadCSV, toCSV } from "@/lib/csv";

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

const IDLE_WARN_MS = 10 * 60 * 1000; // 10 min
const IDLE_AUTO_MS = 15 * 60 * 1000; // 15 min total → auto punch-out

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
  const { prefs } = useUserPrefs();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [me, setMe] = useState<{ id: string | null; email: string | null }>({ id: null, email: null });
  const lastActiveRef = useRef<number>(Date.now());
  const idleWarnedRef = useRef(false);
  const capWarnedRef = useRef(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe({ id: data.user?.id ?? null, email: data.user?.email ?? null }));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Track user activity for idle detection.
  useEffect(() => {
    const bump = () => {
      lastActiveRef.current = Date.now();
      idleWarnedRef.current = false;
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, bump));
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

  // Total hours today across all projects for the current user.
  const [todayHours, setTodayHours] = useState(0);
  useEffect(() => {
    if (!me.id) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: prefs?.timezone || "Asia/Dubai" });
    (async () => {
      const { data } = await supabase
        .from("time_entries" as never)
        .select("hours,punch_in,punch_out")
        .eq("user_id", me.id)
        .eq("work_date", today);
      const rows = (data ?? []) as unknown as { hours: number; punch_in: string; punch_out: string | null }[];
      const sum = rows.reduce((a, r) => {
        if (r.punch_out) return a + Number(r.hours);
        return a + Math.max(0, (Date.now() - new Date(r.punch_in).getTime()) / 3600_000);
      }, 0);
      setTodayHours(sum);
    })();
  }, [me.id, entries, prefs?.timezone]);

  const punchOut = async (whenIso?: string) => {
    if (busy || !open) return;
    setBusy(true);
    const { error } = await supabase
      .from("time_entries" as never)
      .update({ punch_out: whenIso ?? new Date().toISOString() } as never)
      .eq("id", open.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Punched out");
  };

  // Idle auto-punch-out.
  useEffect(() => {
    if (!open || !prefs?.idle_auto_punch_out) return;
    const int = setInterval(() => {
      const idleMs = Date.now() - lastActiveRef.current;
      if (idleMs >= IDLE_AUTO_MS) {
        const punchIso = new Date(lastActiveRef.current).toISOString();
        toast.warning("Auto-punched out after 15 min idle");
        void punchOut(punchIso);
      } else if (idleMs >= IDLE_WARN_MS && !idleWarnedRef.current) {
        idleWarnedRef.current = true;
        toast.info("Still working? Auto punch-out in 5 min if idle.");
      }
    }, 30_000);
    return () => clearInterval(int);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefs?.idle_auto_punch_out]);

  // Daily cap warning.
  useEffect(() => {
    const cap = Number(prefs?.daily_hour_cap || 0);
    if (!cap || !open) return;
    if (todayHours >= cap && !capWarnedRef.current) {
      capWarnedRef.current = true;
      toast.warning(`Daily cap of ${cap}h reached. Consider punching out.`);
    }
    if (todayHours < cap) capWarnedRef.current = false;
  }, [todayHours, prefs?.daily_hour_cap, open]);

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

  const remove = async (id: string) => {
    const { error } = await supabase.from("time_entries" as never).delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const exportCSV = () => {
    if (entries.length === 0) return toast.info("No entries to export");
    const rows = entries.map((e) => ({
      date: e.work_date,
      punch_in: e.punch_in,
      punch_out: e.punch_out ?? "",
      hours: Number(e.hours).toFixed(2),
      user: e.user_email ?? "",
      note: e.note ?? "",
    }));
    downloadCSV(`timesheet-${projectId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
  };

  const cap = Number(prefs?.daily_hour_cap || 0);
  const overCap = cap > 0 && todayHours >= cap;

  return (
    <section className="glass p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" /> Time tracking
        </h2>
        <div className="flex items-center gap-2">
          <Pomodoro />
          <button
            onClick={exportCSV}
            className="glass inline-flex items-center gap-1.5 px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground"
            title="Export sessions as CSV"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

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
          <Button onClick={() => punchOut()} disabled={busy} variant="destructive" size="sm">
            <Square className="h-4 w-4" /> Punch out
          </Button>
        ) : (
          <Button onClick={punchIn} disabled={busy} size="sm">
            <Play className="h-4 w-4" /> Punch in
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular-nums">
          Today: <span className="font-medium text-foreground">{todayHours.toFixed(2)}h</span>
          {cap > 0 && <> / {cap}h cap</>}
        </span>
        {overCap && (
          <span className="text-destructive inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Daily cap reached
          </span>
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
