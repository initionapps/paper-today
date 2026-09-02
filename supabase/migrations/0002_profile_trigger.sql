-- Paper Today — one profiles row per auth user
--
-- Additive migration. 0001_init.sql has been applied and is now frozen; every
-- change from here forward is a new file.
--
-- WHY A TRIGGER RATHER THAN APP CODE
--
-- Email confirmation is enabled, so `signUp()` returns no session: at that
-- moment there is no authenticated context in which the client could insert a
-- profile, and RLS would correctly reject the attempt. Doing it from the app
-- would need the service-role key, which this project deliberately does not
-- have. A trigger also keeps profile creation atomic with user creation — an
-- "upsert on first page load" leaves a window where a confirmed user has no
-- profile, and puts a write on every render — and it covers users created
-- outside the app's own signup form (the dashboard, or any provider added
-- later).

create function public.handle_new_user()
returns trigger
language plpgsql
-- SECURITY DEFINER because the inserting session is not yet an authenticated
-- user, so it cannot satisfy the profiles RLS policy on its own.
security definer
-- Empty search_path with fully-qualified names below: a SECURITY DEFINER
-- function that resolves names through a caller-controlled search_path is the
-- classic privilege-escalation hole.
set search_path = ''
as $$
begin
  -- `on conflict do nothing` keeps this idempotent: re-running the migration,
  -- or any future path that also creates a profile, must not error.
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
