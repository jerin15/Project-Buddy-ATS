import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useUserPrefs } from "@/hooks/useUserPrefs";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mounted once inside the authenticated shell. Once per day, at the user's
 * configured reminder_time, shows a toast + browser notification if they
 * haven't punched in yet today.
 */
export function PunchReminder() {
  const { prefs } = useUserPrefs();
  const firedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!prefs?.reminder_enabled) return;

    // Ask notification permission once (non-blocking).
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const tick = async () => {
      const now = new Date();
      const tz = prefs.timezone || "Asia/Dubai";
      const dateKey = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
      if (firedRef.current === dateKey) return;

      // Local time in the user's timezone.
      const hm = now.toLocaleTimeString("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const target = (prefs.reminder_time || "09:00:00").slice(0, 5);
      if (hm < target) return;

      // Already punched today?
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data: existing } = await supabase
        .from("time_entries" as never)
        .select("id")
        .eq("user_id", uid)
        .eq("work_date", dateKey)
        .limit(1);
      firedRef.current = dateKey;
      if (existing && existing.length > 0) return;

      toast.info("Time to punch in", {
        description: `Reminder for ${target}. Open a project to start tracking.`,
        duration: 10_000,
      });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("ANIMA Tech Studio", {
            body: `Time to punch in (${target})`,
            icon: "/anima-logo.png",
          });
        } catch { /* noop */ }
      }
    };

    tick();
    const int = setInterval(tick, 60_000);
    return () => clearInterval(int);
  }, [prefs]);

  return null;
}
