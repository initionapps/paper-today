"use client";

/**
 * One write at a time, in the order they were asked for, and never under the
 * wrong account.
 *
 * This is not a sync engine. It does not diff state, batch, debounce, coalesce,
 * or survive a reload. It is a queue: an action says what it just did, the
 * write goes out, and if it fails you are told. Everything it deliberately
 * cannot do — offline buffering, conflict resolution, retry-forever — is
 * absent because this app has one user on one device at a time, and a
 * mechanism that guesses is worse here than one that reports.
 *
 *
 * WHY ORDER MATTERS
 *
 * `addProject` then `setTaskProject` are two writes, and the second carries a
 * foreign key to the first. Sent concurrently they can arrive inverted and the
 * second fails on a row that does not exist yet. One request in flight at a
 * time makes that unrepresentable rather than unlikely.
 *
 *
 * WHY EACH JOB CARRIES A USER ID
 *
 * A queued write outlives the moment it was made. Sign out while one is
 * waiting, sign in as someone else, and the write is still sitting there — and
 * because inserts omit `user_id` and let the column default to `auth.uid()`,
 * it would be stamped with the *new* user's id. Row level security would
 * approve it: the row is a perfectly legitimate row for the account that is now
 * signed in. RLS keeps other people out of your data; it has nothing to say
 * about your data being filed under someone else's name.
 *
 * So the check cannot live in the database, and it is made structural here
 * instead. A job cannot be constructed without the id of the user it was
 * queued for, and immediately before every request that id is compared against
 * the session as it stands *now*. A mismatch cancels the write and reports it.
 * It never rebinds and never replays.
 *
 * A request already in flight when the account changes is left alone to settle
 * under the session it started with. It is not retried, because a retry would
 * be a new request under the new session — which is precisely the thing this
 * exists to prevent.
 */
import { create } from "zustand";

import { createClient } from "@/lib/supabase/client";

/** Why a write did not land. The two are not the same and must not read alike. */
export type FailureKind =
  /** The request was made and the database refused it, or the network did. */
  | "failed"
  /** The request was never made: the account changed underneath it. */
  | "cancelled";

export interface WriteFailure {
  label: string;
  kind: FailureKind;
  message: string;
  at: number;
}

interface WriteStatus {
  pending: number;
  failures: WriteFailure[];
  clearFailures: () => void;
}

export const useWriteStatus = create<WriteStatus>()((set) => ({
  pending: 0,
  failures: [],
  clearFailures: () => set({ failures: [] }),
}));

const report = (failure: WriteFailure) =>
  useWriteStatus.setState((s) => ({ failures: [...s.failures, failure] }));

const setPending = (n: number) => useWriteStatus.setState({ pending: n });

interface Job {
  label: string;
  /**
   * Identifies the row this write is about, so a second write for the same row
   * can recognise the first. See `write`.
   */
  key: string | null;
  /** The account this write belongs to. Fixed when the job is made. */
  expectedUserId: string;
  run: () => Promise<void>;
  attempts: number;
}

let queue: Job[] = [];
let draining = false;
let boundUserId: string | null = null;

/**
 * How the queue learns who is signed in *right now*.
 *
 * Replaceable so tests can drive account switches without a browser, and so
 * the check has a single definition rather than one per call site.
 */
let resolveUserId: () => Promise<string | null> = async () => {
  const { data, error } = await createClient().auth.getClaims();
  if (error) throw new Error(`could not verify session: ${error.message}`);
  return data?.claims?.sub ?? null;
};

/** Test seam. Production never calls this. */
export function __setUserResolver(fn: () => Promise<string | null>) {
  resolveUserId = fn;
}

/** At most one retry, and only for a failure that could plausibly be transient. */
const MAX_ATTEMPTS = 2;

/**
 * A pause before the single retry. Retrying a network failure in the same tick
 * just fails again a millisecond later and burns the one attempt for nothing.
 * This is the only timer in the file, and it is not a backoff schedule.
 */
const RETRY_DELAY_MS = 250;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Who the queue is currently writing for.
 *
 * Changing this is the account switch. Anything still queued for the previous
 * user is dropped here rather than at send time — the send-time check is the
 * backstop, not the mechanism — and reported, so a write that will now never
 * happen is visible instead of silently vanishing.
 */
export function bindUser(userId: string | null): void {
  if (userId === boundUserId) return;
  // Clear first, cancel second. The previous account's accumulated failures
  // are not this account's business, but the writes being dropped *by this
  // switch* are exactly what the user needs told — reporting them after the
  // clear is what keeps them visible.
  useWriteStatus.setState({ failures: [] });
  cancelQueued(
    userId === null ? "signed out before this could be saved" : "the account changed before this could be saved",
  );
  boundUserId = userId;
}

export function currentBoundUser(): string | null {
  return boundUserId;
}

function cancelQueued(reason: string): void {
  const dropped = queue;
  queue = [];
  setPending(0);
  for (const job of dropped) {
    report({ label: job.label, kind: "cancelled", message: reason, at: Date.now() });
  }
}

/**
 * Queue one write.
 *
 * `label` is what the user did, not what the row is — it is the sentence a
 * failure notice is built from, so "rename task" beats "upsert tasks".
 *
 *
 * `key` AND WHY TYPING DOES NOT PRODUCE A REQUEST PER KEYSTROKE
 *
 * Some actions fire continuously: the note textarea calls `updateNote` on every
 * keystroke, dragging a note calls it on every frame, and the work-hours editor
 * rewrites a day's windows as you type into the field. One request each would
 * be absurd.
 *
 * The usual fix is a debounce, which is the thing this file exists not to be —
 * a timer means a window in which a write is owed but not sent, which is the
 * window an account switch can slip through.
 *
 * Instead: a job identified by `key` is skipped if one for the same key is
 * already queued and has not started, and every job reads the row *at send
 * time* rather than closing over the row as it was when queued. So the job
 * already sitting in the queue will send whatever the newest state is by the
 * time it runs. With one request in flight at a time, a burst of keystrokes
 * collapses into at most one queued write — the queue's own backpressure does
 * the coalescing, with no timer and no window.
 *
 * A key must therefore identify a row *and* an operation: `task:<id>` and
 * `task-delete:<id>` are different writes about the same row and must not
 * collapse into each other.
 */
export function write(label: string, run: () => Promise<void>, key: string | null = null): void {
  if (boundUserId === null) {
    // Not signed in, or signed out mid-action. Dropping this is correct; doing
    // it quietly is not.
    report({ label, kind: "cancelled", message: "no signed-in account to save to", at: Date.now() });
    return;
  }
  // Only unstarted jobs are in `queue` — the running one is shifted off before
  // its request goes out — so a match here is always still coalescable.
  if (key !== null && queue.some((j) => j.key === key)) return;

  queue.push({ label, key, expectedUserId: boundUserId, run, attempts: 0 });
  setPending(queue.length);
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;

  try {
    while (queue.length > 0) {
      const job = queue[0];

      // Who is signed in *now* — not who was signed in when this was queued.
      let actualUserId: string | null;
      try {
        actualUserId = await resolveUserId();
      } catch (e) {
        // The session could not be established one way or the other. Sending
        // blind is the one thing worse than not sending, so it is not an option.
        job.attempts += 1;
        if (job.attempts < MAX_ATTEMPTS) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        queue.shift();
        setPending(queue.length);
        report({ label: job.label, kind: "failed", message: message(e), at: Date.now() });
        continue;
      }

      if (actualUserId !== job.expectedUserId) {
        queue.shift();
        setPending(queue.length);
        report({
          label: job.label,
          kind: "cancelled",
          message: "the signed-in account changed before this could be saved",
          at: Date.now(),
        });
        continue;
      }

      // Taken off the queue *before* the request goes out. From here the job is
      // in flight: an account switch during it will not find it to cancel, and
      // must not — it is already settling under the session that sent it.
      queue.shift();
      setPending(queue.length);

      try {
        await job.run();
      } catch (e) {
        // A retry is a *new* request under whatever session exists then, so it
        // is only ever allowed while the account is still the one that queued
        // it. Otherwise this failure is final.
        const stillSameUser = boundUserId === job.expectedUserId;
        job.attempts += 1;
        if (stillSameUser && job.attempts < MAX_ATTEMPTS) {
          queue.unshift(job);
          setPending(queue.length);
          await delay(RETRY_DELAY_MS);
          continue;
        }
        report({ label: job.label, kind: "failed", message: message(e), at: Date.now() });
      }
    }
  } finally {
    draining = false;
  }
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Resolves when the queue is empty. For tests and for "am I safe to leave?". */
export async function flush(): Promise<void> {
  while (draining || queue.length > 0) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Wipes queue and bindings. Tests only. */
export function __reset(): void {
  queue = [];
  draining = false;
  boundUserId = null;
  useWriteStatus.setState({ pending: 0, failures: [] });
}
