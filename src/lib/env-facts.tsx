/**
 * TEMPORARY — shared by both halves of the env diagnostic.
 *
 * No `"use client"`: this module is imported by a server component *and* by a
 * client one, and a function in a client module cannot be called from the
 * server ("Attempted to call factsFrom() from the server but factsFrom is on
 * the client"). Keeping the pure part neutral is what lets the same derivation
 * describe both sides, which is the whole point — the two must be compared
 * like for like.
 *
 * Never returns the key. Length and first six characters only.
 */

export interface EnvFacts {
  urlDefined: boolean;
  keyDefined: boolean;
  host: string;
  keyLength: number;
  keyFirst6: string;
  keyHasWhitespaceEdges: boolean;
  keyHasQuotes: boolean;
}

export function factsFrom(u: string | undefined, k: string | undefined): EnvFacts {
  let host = "—";
  if (u) {
    try {
      host = new URL(u).host;
    } catch {
      host = "UNPARSEABLE";
    }
  }
  return {
    urlDefined: typeof u === "string" && u.length > 0,
    keyDefined: typeof k === "string" && k.length > 0,
    host,
    keyLength: k?.length ?? 0,
    keyFirst6: k?.slice(0, 6) ?? "—",
    // Both survive a copy-paste into a dashboard field, and both break the key
    // while leaving it looking correct in the UI.
    keyHasWhitespaceEdges: !!k && /^\s|\s$/.test(k),
    keyHasQuotes: !!k && /^["']|["']$/.test(k),
  };
}

export function FactsTable({ title, facts }: { title: string; facts: EnvFacts }) {
  const rows: [string, string][] = [
    ["NEXT_PUBLIC_SUPABASE_URL defined", String(facts.urlDefined)],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY defined", String(facts.keyDefined)],
    ["Supabase host", facts.host],
    ["key length", String(facts.keyLength)],
    ["key first 6", facts.keyFirst6],
    ["key has leading/trailing whitespace", String(facts.keyHasWhitespaceEdges)],
    ["key wrapped in quotes", String(facts.keyHasQuotes)],
  ];
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600 }}>{title}</h2>
      <table style={{ marginTop: 8, borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: "3px 16px 3px 0", opacity: 0.7 }}>{k}</td>
              <td style={{ padding: "3px 0", fontFamily: "ui-monospace, monospace" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
