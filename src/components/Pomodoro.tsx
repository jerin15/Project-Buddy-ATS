import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FOCUS_SEC = 25 * 60;
const BREAK_SEC = 5 * 60;

export function Pomodoro() {
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [remaining, setRemaining] = useState(FOCUS_SEC);
  const [running, setRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef<number>(FOCUS_SEC);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (startRef.current == null) return;
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const left = Math.max(0, baseRef.current - elapsed);
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        if (mode === "focus") {
          toast.success("Focus complete — take a 5 min break");
          setMode("break");
          baseRef.current = BREAK_SEC;
          setRemaining(BREAK_SEC);
        } else {
          toast.info("Break over — back to focus");
          setMode("focus");
          baseRef.current = FOCUS_SEC;
          setRemaining(FOCUS_SEC);
        }
      }
    }, 500);
    return () => clearInterval(t);
  }, [running, mode]);

  const toggle = () => {
    if (running) {
      baseRef.current = remaining;
      startRef.current = null;
      setRunning(false);
    } else {
      baseRef.current = remaining;
      startRef.current = Date.now();
      setRunning(true);
    }
  };
  const reset = () => {
    setRunning(false);
    startRef.current = null;
    baseRef.current = mode === "focus" ? FOCUS_SEC : BREAK_SEC;
    setRemaining(baseRef.current);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2">
      <Timer className={cn("h-4 w-4", mode === "focus" ? "text-foreground" : "text-emerald-500")} />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-10">{mode}</span>
      <span className="tabular-nums font-semibold text-sm w-14">{mm}:{ss}</span>
      <button
        onClick={toggle}
        className="glass inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={running ? "Pause" : "Start"}
      >
        {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={reset}
        className="glass inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Reset"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
