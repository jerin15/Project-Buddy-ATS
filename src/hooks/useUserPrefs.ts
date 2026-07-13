import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserPrefs = {
  user_id: string;
  reminder_enabled: boolean;
  reminder_time: string; // "HH:MM:SS" or "HH:MM"
  daily_hour_cap: number;
  idle_auto_punch_out: boolean;
  timezone: string;
};

const DEFAULTS: Omit<UserPrefs, "user_id"> = {
  reminder_enabled: true,
  reminder_time: "09:00:00",
  daily_hour_cap: 0,
  idle_auto_punch_out: true,
  timezone: "Asia/Dubai",
};

export function useUserPrefs() {
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      if (!mounted) return;
      setUserId(uid);
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_prefs" as never)
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (!mounted) return;
      if (data) setPrefs(data as unknown as UserPrefs);
      else setPrefs({ user_id: uid, ...DEFAULTS });
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = useCallback(
    async (patch: Partial<UserPrefs>) => {
      if (!userId) return { error: new Error("Not signed in") };
      const next = { ...(prefs ?? { user_id: userId, ...DEFAULTS }), ...patch, user_id: userId };
      setPrefs(next);
      const { error } = await supabase
        .from("user_prefs" as never)
        .upsert(next as never, { onConflict: "user_id" } as never);
      return { error };
    },
    [prefs, userId],
  );

  return { prefs, loading, save };
}
