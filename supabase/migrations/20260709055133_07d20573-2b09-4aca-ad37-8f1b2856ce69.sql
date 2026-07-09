
-- ============================================================
-- TIME ENTRIES
-- ============================================================
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid,
  user_email text,
  work_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dubai')::date,
  punch_in timestamptz NOT NULL DEFAULT now(),
  punch_out timestamptz,
  hours numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read time_entries" ON public.time_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert time_entries" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update time_entries" ON public.time_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete time_entries" ON public.time_entries FOR DELETE TO authenticated USING (true);

-- Cap punch_in >= 09:00 Dubai, punch_out <= 18:00 Dubai, compute hours
CREATE OR REPLACE FUNCTION public.time_entries_normalize()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  d date;
  day_start timestamptz;
  day_end timestamptz;
BEGIN
  d := (NEW.punch_in AT TIME ZONE 'Asia/Dubai')::date;
  NEW.work_date := d;
  day_start := ((d::text || ' 09:00:00')::timestamp AT TIME ZONE 'Asia/Dubai');
  day_end   := ((d::text || ' 18:00:00')::timestamp AT TIME ZONE 'Asia/Dubai');

  IF NEW.punch_in < day_start THEN NEW.punch_in := day_start; END IF;
  IF NEW.punch_in > day_end   THEN NEW.punch_in := day_end;   END IF;

  IF NEW.punch_out IS NOT NULL THEN
    IF NEW.punch_out > day_end   THEN NEW.punch_out := day_end;   END IF;
    IF NEW.punch_out < NEW.punch_in THEN NEW.punch_out := NEW.punch_in; END IF;
    NEW.hours := ROUND((EXTRACT(EPOCH FROM (NEW.punch_out - NEW.punch_in)) / 3600.0)::numeric, 2);
  ELSE
    NEW.hours := 0;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER time_entries_normalize_ins
BEFORE INSERT ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.time_entries_normalize();

CREATE TRIGGER time_entries_normalize_upd
BEFORE UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.time_entries_normalize();

-- Delta-apply hours to projects.spent_hours
CREATE OR REPLACE FUNCTION public.time_entries_apply_delta()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  delta numeric := 0;
  pid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := COALESCE(NEW.hours, 0);
    pid := NEW.project_id;
  ELSIF TG_OP = 'UPDATE' THEN
    delta := COALESCE(NEW.hours, 0) - COALESCE(OLD.hours, 0);
    pid := NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    delta := -COALESCE(OLD.hours, 0);
    pid := OLD.project_id;
  END IF;
  IF delta <> 0 THEN
    UPDATE public.projects
       SET spent_hours = GREATEST(0, COALESCE(spent_hours, 0) + delta),
           updated_at = now()
     WHERE id = pid;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER time_entries_delta_ins AFTER INSERT ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.time_entries_apply_delta();
CREATE TRIGGER time_entries_delta_upd AFTER UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.time_entries_apply_delta();
CREATE TRIGGER time_entries_delta_del AFTER DELETE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.time_entries_apply_delta();

CREATE INDEX idx_time_entries_project ON public.time_entries(project_id, punch_in DESC);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid,
  user_email text,
  amount numeric NOT NULL DEFAULT 0,
  invoice_number text,
  vendor text,
  description text,
  expense_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dubai')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated update expenses" ON public.expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated delete expenses" ON public.expenses FOR DELETE TO authenticated USING (true);

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.expenses_apply_delta()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  delta numeric := 0;
  pid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := COALESCE(NEW.amount, 0);
    pid := NEW.project_id;
  ELSIF TG_OP = 'UPDATE' THEN
    delta := COALESCE(NEW.amount, 0) - COALESCE(OLD.amount, 0);
    pid := NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    delta := -COALESCE(OLD.amount, 0);
    pid := OLD.project_id;
  END IF;
  IF delta <> 0 THEN
    UPDATE public.projects
       SET spent_cost = GREATEST(0, COALESCE(spent_cost, 0) + delta),
           updated_at = now()
     WHERE id = pid;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER expenses_delta_ins AFTER INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.expenses_apply_delta();
CREATE TRIGGER expenses_delta_upd AFTER UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.expenses_apply_delta();
CREATE TRIGGER expenses_delta_del AFTER DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.expenses_apply_delta();

CREATE INDEX idx_expenses_project ON public.expenses(project_id, expense_date DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
