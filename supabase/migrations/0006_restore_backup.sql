-- 0006 — Restore means replace, and replace must be all-or-nothing.
--
-- "Restore this backup" has always meant *replace my data with this file*, and
-- it keeps meaning that. Against a database that is a destructive operation
-- spanning nine tables, and PostgREST gives one transaction per request — so
-- doing it as a series of client-side deletes and inserts would leave a failure
-- halfway through as an account that is neither the old data nor the new one.
-- Restoring a backup is precisely when you cannot afford that.
--
-- One function call is one statement is one transaction. It commits whole or
-- rolls back whole.
--
--
-- SECURITY INVOKER — read this before changing it.
--
-- The function runs with the *caller's* rights, not the definer's. The tables
-- are owned by `postgres` and the caller is `authenticated`, so row level
-- security is fully enforced inside this body exactly as it is outside. There
-- is no privilege escalation here, and no service-role key anywhere near it: a
-- restore succeeds only through the same policies the user's ordinary writes
-- go through. `security definer` would silently turn this into a function that
-- can rewrite anyone's account, and must not be used.
--
-- `set search_path = ''` for the usual reason — an empty path means a
-- malicious object in a schema the caller controls cannot be resolved ahead of
-- the real one. It is why every name below is schema-qualified, including the
-- casts to `public.task_size` and `public.task_status`.
--
--
-- The redundant `where user_id = v_uid`.
--
-- Under RLS an unqualified `delete from public.tasks` already deletes only the
-- caller's rows; the delete policy rewrites it. The predicate is written out
-- anyway. While RLS is on it changes nothing. If RLS is ever disabled on one
-- of these tables — a migration, an incident, a mistake — it is the difference
-- between one account being replaced and every account being erased. It costs
-- an index lookup that the policy was going to do regardless.
--
--
-- The payload is already snake_case and already carries final UUIDs. The
-- client maps and remaps; this function is a writer, not a translator.

create or replace function public.restore_backup(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());

  -- `payload->'x'` is SQL NULL when the key is absent but jsonb 'null' when
  -- the key is present and null; `jsonb_array_elements` errors on the latter.
  -- Normalising both to an empty array here keeps every insert below identical.
  v_projects     jsonb := coalesce(nullif(payload->'projects',     'null'::jsonb), '[]'::jsonb);
  v_routines     jsonb := coalesce(nullif(payload->'routines',     'null'::jsonb), '[]'::jsonb);
  v_tasks        jsonb := coalesce(nullif(payload->'tasks',        'null'::jsonb), '[]'::jsonb);
  v_routine_logs jsonb := coalesce(nullif(payload->'routine_logs', 'null'::jsonb), '[]'::jsonb);
  v_time_blocks  jsonb := coalesce(nullif(payload->'time_blocks',  'null'::jsonb), '[]'::jsonb);
  v_work_windows jsonb := coalesce(nullif(payload->'work_windows', 'null'::jsonb), '[]'::jsonb);
  v_notes        jsonb := coalesce(nullif(payload->'notes',        'null'::jsonb), '[]'::jsonb);
  v_day_logs     jsonb := coalesce(nullif(payload->'day_logs',     'null'::jsonb), '[]'::jsonb);

  v_counts jsonb := '{}'::jsonb;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'restore_backup requires an authenticated session'
      using errcode = '28000';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'restore_backup expects a json object payload'
      using errcode = '22023';
  end if;

  ----------------------------------------------------------------------------
  -- Out with the old. Children before parents: the composite ownership foreign
  -- keys mean a project cannot leave while a task still points at it.
  ----------------------------------------------------------------------------
  delete from public.routine_logs where user_id = v_uid;
  delete from public.tasks        where user_id = v_uid;
  delete from public.notes        where user_id = v_uid;
  delete from public.time_blocks  where user_id = v_uid;
  delete from public.work_windows where user_id = v_uid;
  delete from public.day_logs     where user_id = v_uid;
  delete from public.routines     where user_id = v_uid;
  delete from public.projects     where user_id = v_uid;

  ----------------------------------------------------------------------------
  -- In with the new. Parents before children, same reason inverted.
  ----------------------------------------------------------------------------
  insert into public.projects
    (id, user_id, name, color, description, notes, sort_order, archived_at, created_at, updated_at)
  select
    (r->>'id')::uuid, v_uid,
    r->>'name',
    coalesce(r->>'color', 'blue'),
    coalesce(r->>'description', ''),
    coalesce(r->>'notes', ''),
    coalesce((r->>'sort_order')::double precision, 0),
    (r->>'archived_at')::timestamptz,
    coalesce((r->>'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(v_projects) as r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('projects', v_n);

  insert into public.routines
    (id, user_id, title, weekdays, fixed_start_min, fixed_end_min, sort_order, archived_at, created_at, updated_at)
  select
    (r->>'id')::uuid, v_uid,
    r->>'title',
    -- `array_agg` over an empty set is NULL, and the column is NOT NULL.
    coalesce(
      (select array_agg(w::smallint order by ordinality)
         from jsonb_array_elements_text(
           coalesce(nullif(r->'weekdays', 'null'::jsonb), '[]'::jsonb)
         ) with ordinality as t(w, ordinality)),
      '{}'::smallint[]
    ),
    (r->>'fixed_start_min')::smallint,
    (r->>'fixed_end_min')::smallint,
    coalesce((r->>'sort_order')::double precision, 0),
    (r->>'archived_at')::timestamptz,
    coalesce((r->>'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(v_routines) as r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('routines', v_n);

  insert into public.tasks
    (id, user_id, project_id, title, detail, size, status, planned_date, due_date,
     is_important, sort_order, scheduled_start_min, scheduled_end_min,
     completed_at, created_at, updated_at)
  select
    (r->>'id')::uuid, v_uid,
    (r->>'project_id')::uuid,
    r->>'title',
    r->>'detail',
    coalesce((r->>'size')::public.task_size, 'medium'),
    coalesce((r->>'status')::public.task_status, 'open'),
    (r->>'planned_date')::date,
    (r->>'due_date')::date,
    coalesce((r->>'is_important')::boolean, false),
    coalesce((r->>'sort_order')::double precision, 0),
    (r->>'scheduled_start_min')::smallint,
    (r->>'scheduled_end_min')::smallint,
    (r->>'completed_at')::timestamptz,
    coalesce((r->>'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(v_tasks) as r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('tasks', v_n);

  insert into public.routine_logs
    (id, user_id, routine_id, day, completed_at, scheduled_start_min, scheduled_end_min, created_at)
  select
    (r->>'id')::uuid, v_uid,
    (r->>'routine_id')::uuid,
    (r->>'day')::date,
    (r->>'completed_at')::timestamptz,
    (r->>'scheduled_start_min')::smallint,
    (r->>'scheduled_end_min')::smallint,
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(v_routine_logs) as r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('routine_logs', v_n);

  insert into public.time_blocks
    (id, user_id, day, title, start_min, end_min, created_at)
  select
    (r->>'id')::uuid, v_uid,
    (r->>'day')::date,
    r->>'title',
    (r->>'start_min')::smallint,
    (r->>'end_min')::smallint,
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(v_time_blocks) as r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('time_blocks', v_n);

  insert into public.work_windows
    (id, user_id, day, start_min, end_min, created_at)
  select
    (r->>'id')::uuid, v_uid,
    (r->>'day')::date,
    (r->>'start_min')::smallint,
    (r->>'end_min')::smallint,
    coalesce((r->>'created_at')::timestamptz, now())
  from jsonb_array_elements(v_work_windows) as r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('work_windows', v_n);

  insert into public.notes
    (id, user_id, day, body, color, x, y, rotation, z, created_at, updated_at)
  select
    (r->>'id')::uuid, v_uid,
    (r->>'day')::date,
    coalesce(r->>'body', ''),
    coalesce(r->>'color', 'blue'),
    coalesce((r->>'x')::real, 0),
    coalesce((r->>'y')::real, 0),
    coalesce((r->>'rotation')::real, 0),
    coalesce((r->>'z')::integer, 0),
    coalesce((r->>'created_at')::timestamptz, now()),
    now()
  from jsonb_array_elements(v_notes) as r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('notes', v_n);

  insert into public.day_logs
    (id, user_id, day, wrapped_at, reflection)
  select
    (r->>'id')::uuid, v_uid,
    (r->>'day')::date,
    (r->>'wrapped_at')::timestamptz,
    r->>'reflection'
  from jsonb_array_elements(v_day_logs) as r;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('day_logs', v_n);

  ----------------------------------------------------------------------------
  -- The motto lives on the profile, which the signup trigger already created.
  -- It is updated, never inserted, and only when the backup actually carries
  -- one — a backup with no motto should not blank the profile's.
  ----------------------------------------------------------------------------
  if payload ? 'motto' and jsonb_typeof(payload->'motto') = 'string' then
    update public.profiles
       set motto = payload->>'motto'
     where id = v_uid;
  end if;

  return jsonb_build_object('ok', true, 'counts', v_counts);
end;
$$;

-- EXECUTE on a new function is granted to PUBLIC by default, which here would
-- include `anon`. The body refuses an unauthenticated caller anyway, but the
-- grant should say what is true rather than relying on the guard.
revoke all on function public.restore_backup(jsonb) from public;
grant execute on function public.restore_backup(jsonb) to authenticated;

comment on function public.restore_backup(jsonb) is
  'Transactionally replaces the calling user''s data with the payload. Caller rights; RLS enforced.';
