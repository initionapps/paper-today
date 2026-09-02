-- Paper Today — table privileges for the `authenticated` role
--
-- WHY THIS EXISTS
--
-- 0001 enabled RLS and wrote 36 policies, but never granted table privileges.
-- Those are two different mechanisms and both are required:
--
--   GRANT  decides whether a role may touch the table at all.
--   RLS    decides which rows it sees once it may.
--
-- Without the grant, a fully authenticated user gets
-- `42501 permission denied for table …` on every statement — which is what
-- happened: signing in worked, and then the app could not read its own data.
-- Supabase's default privileges did not cover these tables, and relying on
-- them implicitly is what hid the gap in the first place. Being explicit is
-- also auditable, which the implicit version never was.
--
-- THIS DOES NOT WEAKEN ISOLATION. Granting SELECT to `authenticated` does not
-- let one user read another's rows: every policy still restricts to
-- `(select auth.uid()) = user_id`. The grant opens the door to the table; RLS
-- still decides which rows are on the other side of it.
--
-- `anon` is deliberately granted NOTHING. There are no anon policies, so it
-- would see zero rows anyway — but withholding the privilege too means an anon
-- policy added by mistake later still cannot read anything.

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.projects,
  public.routines,
  public.tasks,
  public.routine_logs,
  public.time_blocks,
  public.work_windows,
  public.notes,
  public.day_logs
to authenticated;

-- Prevents the same omission on table number ten: any table created later by
-- this role picks the same grants up automatically. Remove this line if you
-- would rather every future table state its privileges explicitly.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
