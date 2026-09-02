/**
 * Turning the ids this app has always made into ids Postgres will accept.
 *
 * Every primary key in `0001_init.sql` is a `uuid`. Every id the store made
 * before this change came from `Math.random().toString(36).slice(2, 10)` — an
 * eight-character string like `qq5emksy`, and the seed's are worse (`p_kite`).
 * Handing one of those to a uuid column fails outright with
 * `22P02 invalid input syntax for type uuid`, so the ids in a browser's
 * localStorage cannot be carried across as they are. They have to be mapped.
 *
 * The mapping is a *derivation*, not an allocation, and that one property is
 * what makes the import safe to run twice:
 *
 *   - the same local id always yields the same uuid, so re-running an import
 *     collides with the rows it wrote last time and `on conflict do nothing`
 *     turns the whole thing into a no-op;
 *   - `task.projectId` and `routineLog.routineId` derive through the same
 *     function as the rows they point at, so relationships survive without a
 *     lookup table to get out of step;
 *   - the user id is inside the hash, so the same backup imported into two
 *     accounts produces two disjoint sets of ids and can never collide on a
 *     primary key.
 *
 * New rows made from now on skip all of this — `newId()` returns a real uuid,
 * so there is nothing to derive. This exists for the one-time import of ids
 * that predate it, and for backup files written before it.
 */

/**
 * Namespace for this app's derived ids. Arbitrary but fixed: changing it
 * changes every derived id, which would make a second import duplicate
 * everything the first one wrote. It is a constant, not a knob.
 */
const NAMESPACE = "9b7d2c14-5e83-4a6f-9c2b-1d8e0f3a7b45";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * A fresh id for a new row. A real uuid, so it goes to the database untouched.
 *
 * `randomUUID` needs a secure context; localhost counts, and so does every
 * deployment. The fallback is for the odd browser that exposes `crypto` without
 * it — it is not a security boundary, just an id.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return format(b);
}

function format(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * RFC 4122 §4.3 name-based uuid, SHA-1 flavour.
 *
 * SHA-1 is not doing security work here. The requirement is a stable,
 * well-distributed mapping from a name to 128 bits; the version-5 scheme is the
 * standard way to spell that, and using the standard means the result is
 * recognisable as what it is rather than a bespoke hash nobody can verify.
 */
async function uuidV5(name: string): Promise<string> {
  const nameBytes = new TextEncoder().encode(name);
  const nsBytes = uuidToBytes(NAMESPACE);

  const input = new Uint8Array(nsBytes.length + nameBytes.length);
  input.set(nsBytes, 0);
  input.set(nameBytes, nsBytes.length);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  return format(bytes);
}

/** The tables a derived id can belong to. Part of the hash, so two tables that
 *  happen to share a local id still get different uuids. */
export type IdScope =
  | "projects"
  | "tasks"
  | "routines"
  | "routine_logs"
  | "time_blocks"
  | "work_windows"
  | "notes"
  | "day_logs";

/**
 * The row id for a local id, for a specific user and table.
 *
 * Already a uuid — a row created after `newId()` shipped — and it passes
 * through untouched. Deriving from a uuid would be just as deterministic but it
 * would *change* an id the database may already be holding, which is the one
 * thing this must not do.
 */
export async function rowIdFor(userId: string, scope: IdScope, localId: string): Promise<string> {
  if (isUuid(localId)) return localId;
  return uuidV5(`${userId}:${scope}:${localId}`);
}

/** `rowIdFor` across a list, returning a lookup from local id to row id. */
export async function rowIdMap(
  userId: string,
  scope: IdScope,
  localIds: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(localIds)];
  const ids = await Promise.all(unique.map((id) => rowIdFor(userId, scope, id)));
  return new Map(unique.map((local, i) => [local, ids[i]]));
}
