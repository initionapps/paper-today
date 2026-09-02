-- 0005 — record that this account has absorbed its browser's local data.
--
-- The one-time import is idempotent by construction: every row's id is derived
-- with UUIDv5 from (user, table, local id), so re-running it inserts nothing
-- new. This column is therefore not what makes the import safe — it is what
-- stops the app from *asking*. Without it the import prompt has no way to know
-- it has already been answered, and the only alternative signal ("does this
-- account have any rows?") is wrong for anyone who created a task by hand
-- before importing.
--
-- Written only after a full, verified import. A partial or failed run leaves it
-- null so the prompt returns and the run can be resumed.

alter table profiles
  add column if not exists local_migrated_at timestamptz;

comment on column profiles.local_migrated_at is
  'When this account completed its one-time localStorage import. Null = never, or still incomplete.';
