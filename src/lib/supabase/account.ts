"use client";

/**
 * Getting an account's data into the store, and — just as much — getting the
 * previous account's data out.
 *
 * This replaces `useDayStore.persist.rehydrate()`. That call read one browser's
 * one blob of localStorage, so there was only ever one account's worth of data
 * and nothing to get wrong. Reading from a server there are two questions
 * instead of one: whose data, and is that still who is signed in.
 *
 * The order below is the whole point and is not incidental:
 *
 *   1. bind the write queue to the new user — which *cancels* anything the
 *      previous user had queued, rather than letting it flush under this one;
 *   2. clear the in-memory store — so no row from the previous account is on
 *      screen, or reachable by an action, while the next one loads;
 *   3. load.
 *
 * Doing 3 before 2 would put two accounts' rows in the same store for as long
 * as the request takes. Doing 2 before 1 would leave a moment where the store
 * is empty but the queue still believes in the old user.
 */
import { useEffect } from "react";
import { create } from "zustand";

import { createClient } from "@/lib/supabase/client";
import { loadAll } from "@/lib/supabase/repository";
import { bindUser, currentBoundUser } from "@/lib/supabase/write-queue";
import { useDayStore } from "@/lib/store/day-store";

export type AccountStatus = "idle" | "loading" | "ready" | "signed-out" | "error";

interface AccountState {
  status: AccountStatus;
  userId: string | null;
  error: string | null;
}

export const useAccount = create<AccountState>()(() => ({
  status: "idle",
  userId: null,
  error: null,
}));

/** Guards against six views all asking to load at once on first paint. */
let inFlight: Promise<void> | null = null;

async function currentUserId(): Promise<string | null> {
  const { data, error } = await createClient().auth.getClaims();
  if (error) throw new Error(`could not read session: ${error.message}`);
  return data?.claims?.sub ?? null;
}

/**
 * Bring the store in line with whoever is signed in.
 *
 * Safe to call from anywhere, any number of times: concurrent calls share one
 * load, and a call for an account that is already loaded does nothing.
 */
export async function syncAccount(force = false): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const userId = await currentUserId();

      if (userId === null) {
        // Signed out. Drop the queue and the data with it — leaving a previous
        // session's tasks on screen behind a login form is a data leak wearing
        // a routing bug's clothes.
        bindUser(null);
        useDayStore.getState().clearLocal();
        useAccount.setState({ status: "signed-out", userId: null, error: null });
        return;
      }

      const already = useAccount.getState();
      if (!force && already.status === "ready" && already.userId === userId) return;

      const changed = currentBoundUser() !== userId;
      useAccount.setState({ status: "loading", userId, error: null });

      bindUser(userId); // 1 — cancels the previous account's pending writes
      if (changed) useDayStore.getState().clearLocal(); // 2 — nothing of theirs left

      const slice = await loadAll(); // 3

      // The account can change while a load is in the air. Landing this data
      // now would show — and let the user edit — the wrong account's rows.
      if (currentBoundUser() !== userId) return;

      useDayStore.getState().replaceAll(slice);
      useAccount.setState({ status: "ready", userId, error: null });
    } catch (e) {
      useAccount.setState({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

let listening = false;

/**
 * Follows sign-in and sign-out for the life of the tab.
 *
 * Both can happen without this tab doing anything — a sign-out in another tab
 * reaches this one through the shared cookie and the auth listener. Without
 * this, that tab would keep showing, and keep writing, the signed-out
 * account's data.
 */
function listen(): void {
  if (listening) return;
  listening = true;

  createClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
      void syncAccount();
    }
  });
}

/**
 * What a view calls instead of `rehydrate()`.
 *
 * Returns whether the store holds this account's data yet, so a view can hold
 * its first paint until there is something true to paint.
 */
export function useAccountReady(): boolean {
  const status = useAccount((s) => s.status);

  useEffect(() => {
    listen();
    void syncAccount();
  }, []);

  return status === "ready";
}
