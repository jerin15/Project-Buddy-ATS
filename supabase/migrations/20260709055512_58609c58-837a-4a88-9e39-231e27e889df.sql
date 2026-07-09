
CREATE OR REPLACE FUNCTION public.time_entries_normalize()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.work_date := (NEW.punch_in AT TIME ZONE 'Asia/Dubai')::date;

  IF NEW.punch_out IS NOT NULL THEN
    IF NEW.punch_out < NEW.punch_in THEN
      NEW.punch_out := NEW.punch_in;
    END IF;
    NEW.hours := ROUND((EXTRACT(EPOCH FROM (NEW.punch_out - NEW.punch_in)) / 3600.0)::numeric, 2);
  ELSE
    NEW.hours := 0;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;
