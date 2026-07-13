
CREATE TABLE public.user_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_time time NOT NULL DEFAULT '09:00',
  daily_hour_cap numeric NOT NULL DEFAULT 0,
  idle_auto_punch_out boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'Asia/Dubai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_prefs TO authenticated;
GRANT ALL ON public.user_prefs TO service_role;

ALTER TABLE public.user_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage their own prefs"
  ON public.user_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_prefs_updated_at
  BEFORE UPDATE ON public.user_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
