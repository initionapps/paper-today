-- 0004 — let an archived task keep the day it was finished.
--
-- `0001` shipped this:
--
--   check ((status = 'done') = (completed_at is not null))
--
-- which reads as "a completion timestamp exists exactly when the task is
-- done". That is true of `open` and `done`, and wrong about `archived`.
--
-- `archiveTask` in the store sets `status` and deliberately does not touch
-- `completed_at`, so a task that was completed and later archived keeps the
-- moment it was finished. That is real history — the task *was* done, on a
-- particular day — and the old constraint would have rejected the row, forcing
-- a choice between discarding the timestamp and not migrating the task.
--
-- The database was encoding a rule the domain does not have. This widens the
-- constraint to the actual rule rather than editing the data to fit the old
-- one.
--
-- Enum values verified against the frozen `0001`:
--   create type task_status as enum ('open', 'done', 'archived');
-- so the unfinished state is `open`.

alter table tasks drop constraint if exists tasks_done_has_timestamp;
alter table tasks drop constraint if exists tasks_completion_matches_status;

alter table tasks
  add constraint tasks_completion_matches_status
  check (
    case status
      -- Not finished, so there is nothing to have finished at.
      when 'open'     then completed_at is null
      -- Finished, so the moment is required. A `done` row with no timestamp
      -- would make "completed today" unanswerable.
      when 'done'     then completed_at is not null
      -- Either. Archived-from-done keeps its timestamp; archived-from-open
      -- never had one. Both are legitimate.
      when 'archived' then true
      -- A CHECK passes when its expression is NULL, and a CASE with no ELSE
      -- returns NULL on no match — so without this line an enum value added
      -- later would silently escape the constraint entirely. `false` makes a
      -- future `alter type task_status add value` fail loudly here until
      -- someone decides what completion means for it.
      else false
    end
  );

comment on constraint tasks_completion_matches_status on tasks is
  'open has no completion time; done requires one; archived may keep one or not.';
