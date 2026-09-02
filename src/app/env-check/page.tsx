/**
 * TEMPORARY production diagnostic for `401 Invalid API key`.
 *
 * Deliberately **not** behind `requireUser()`. The thing being diagnosed is the
 * Supabase client itself; gating this page behind a sign-in that depends on
 * that client would make it unreachable exactly when it is needed.
 *
 * What it exposes is already public: the Supabase host and the publishable key
 * are both compiled into the JavaScript every visitor downloads. It reports the
 * key's *length* and *first six characters* and nothing more — enough to tell
 * two keys apart, not enough to be one. Delete the route once the cause is
 * found.
 */
import { BrowserEnvFacts } from "@/components/__env-check";
import { FactsTable, factsFrom } from "@/lib/env-facts";

// Read at request time on the server, so this reflects the deployment's actual
// environment rather than anything captured when the page was rendered.
export const dynamic = "force-dynamic";

interface Probe {
  status: number | string;
  body: string;
}

/**
 * The question neither string can answer alone: does this key actually work
 * against this URL? A key that is perfectly well-formed but belongs to another
 * project looks identical in every field above and fails here.
 */
async function probe(url: string | undefined, key: string | undefined): Promise<Probe> {
  if (!url || !key) return { status: "skipped", body: "url or key missing" };
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    const text = await res.text();
    return { status: res.status, body: text.slice(0, 300) };
  } catch (e) {
    return { status: "fetch failed", body: e instanceof Error ? e.message : String(e) };
  }
}

export default async function EnvCheckPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const server = factsFrom(url, key);
  const result = await probe(url, key);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 32, fontFamily: "system-ui" }} dir="ltr">
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Supabase env diagnostic</h1>
      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
        Temporary. Reports key length and first 6 characters only — never the key. Delete this
        route once the cause is found.
      </p>

      <FactsTable title="Server runtime (process.env on the server)" facts={server} />
      <BrowserEnvFacts />

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Live probe: does this key work against this URL?</h2>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          <strong>GET {"{url}"}/auth/v1/settings</strong> → status{" "}
          <code style={{ fontFamily: "ui-monospace, monospace" }}>{String(result.status)}</code>
        </p>
        <pre
          style={{
            marginTop: 8, padding: 12, background: "#f4f4f5", borderRadius: 8,
            fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}
        >
          {result.body}
        </pre>
        <p style={{ fontSize: 12.5, opacity: 0.75, marginTop: 8 }}>
          200 means the URL and key belong together and the key is live. 401 means the pair is
          wrong — the key does not belong to this project, or it has been revoked/rotated.
        </p>
      </section>

      <section style={{ marginTop: 24, fontSize: 12.5, opacity: 0.75 }}>
        <p>
          If <em>Server runtime</em> shows the variables defined and <em>Browser bundle</em> does
          not, the deployment was built before the variables existed — `NEXT_PUBLIC_` values are
          substituted into the client bundle at build time, so setting them in Vercel does nothing
          until the next build. Redeploy without cache.
        </p>
      </section>
    </main>
  );
}
