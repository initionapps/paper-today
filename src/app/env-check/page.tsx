/**
 * TEMPORARY production diagnostic for `401 Invalid API key`.
 *
 * Deliberately **not** behind `requireUser()`. The thing being diagnosed is the
 * Supabase client itself; gating this page behind a sign-in that depends on
 * that client would make it unreachable exactly when it is needed.
 *
 * What it exposes is already public: the Supabase host and the publishable key
 * are both compiled into the JavaScript every visitor downloads. It reports the
 * key's *length* and *first six characters* and nothing more. Delete the route
 * once the cause is found.
 *
 *
 * THE DISTINCTION THIS PAGE EXISTS TO DRAW
 *
 * `process.env.NEXT_PUBLIC_X`, written as a literal, is replaced with a string
 * **at build time** — in server code as well as browser code. So a server
 * component reading it that way is not reading the environment; it is reading
 * whatever the build baked in. The first version of this page got that wrong
 * and labelled it "server runtime", which made a stale build indistinguishable
 * from a wrong variable.
 *
 * A *computed* lookup is not substituted, so on the server it reads the real
 * runtime environment. Comparing the two answers the only question left:
 *
 *   build-time wrong + runtime right  → variable fixed, build is stale → redeploy
 *   build-time wrong + runtime wrong  → the variable itself is still wrong
 */
import { BrowserEnvFacts } from "@/components/__env-check";
import { FactsTable, factsFrom } from "@/lib/env-facts";

export const dynamic = "force-dynamic";

/**
 * Assembled at runtime so the bundler cannot constant-fold it back into a
 * literal member expression and inline it. This is the whole trick.
 */
const nameOf = (parts: string[]) => parts.join("_");

interface Probe {
  status: number | string;
  body: string;
}

async function probe(url: string | undefined, key: string | undefined): Promise<Probe> {
  if (!url || !key) return { status: "skipped", body: "url or key missing" };
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    return { status: res.status, body: (await res.text()).slice(0, 220) };
  } catch (e) {
    return { status: "fetch failed", body: e instanceof Error ? e.message : String(e) };
  }
}

export default async function EnvCheckPage() {
  // What the build baked in — this is what the running app actually uses.
  const builtUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const builtKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // What Vercel has configured *right now*, read at request time.
  const env = process.env as Record<string, string | undefined>;
  const runtimeUrl = env[nameOf(["NEXT", "PUBLIC", "SUPABASE", "URL"])];
  const runtimeKey = env[nameOf(["NEXT", "PUBLIC", "SUPABASE", "PUBLISHABLE", "KEY"])];

  const [builtProbe, runtimeProbe] = await Promise.all([
    probe(builtUrl, builtKey),
    probe(runtimeUrl, runtimeKey),
  ]);

  const deployment = {
    env: env.VERCEL_ENV ?? "—",
    commit: (env.VERCEL_GIT_COMMIT_SHA ?? "—").slice(0, 8),
    deploymentId: env.VERCEL_DEPLOYMENT_ID ?? env.VERCEL_URL ?? "—",
    renderedAt: new Date().toISOString(),
  };

  const stale =
    !!runtimeKey && !!builtKey && runtimeKey !== builtKey;

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: 32, fontFamily: "system-ui" }} dir="ltr">
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Supabase env diagnostic</h1>
      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
        Temporary. Reports key length and first 6 characters only — never the key.
      </p>

      <section
        style={{
          marginTop: 20, padding: 14, borderRadius: 8, fontSize: 13.5,
          background: stale ? "#fef3c7" : "#f4f4f5",
        }}
      >
        <strong>Verdict: </strong>
        {!runtimeKey
          ? "the variable is not set in this environment at all."
          : stale
            ? "the variable has been CHANGED but this deployment was built before the change. Redeploy without build cache."
            : "the build and the runtime environment carry the same value — a redeploy will not change anything. If the probe below is 401, the configured value itself is wrong."}
      </section>

      <section style={{ marginTop: 20, fontSize: 13 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Which deployment is this?</h2>
        <table style={{ marginTop: 8, borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {Object.entries(deployment).map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: "3px 16px 3px 0", opacity: 0.7 }}>{k}</td>
                <td style={{ padding: "3px 0", fontFamily: "ui-monospace, monospace" }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <FactsTable
        title="A · Baked into this build (what the app actually uses)"
        facts={factsFrom(builtUrl, builtKey)}
      />
      <BrowserEnvFacts />
      <FactsTable
        title="C · Configured in Vercel right now (runtime lookup, not inlined)"
        facts={factsFrom(runtimeUrl, runtimeKey)}
      />

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Live probes</h2>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          Using the <strong>built-in</strong> key → status{" "}
          <code>{String(builtProbe.status)}</code>
        </p>
        <pre style={preStyle}>{builtProbe.body}</pre>
        <p style={{ fontSize: 13, marginTop: 12 }}>
          Using the <strong>currently configured</strong> key → status{" "}
          <code>{String(runtimeProbe.status)}</code>
        </p>
        <pre style={preStyle}>{runtimeProbe.body}</pre>
        <p style={{ fontSize: 12.5, opacity: 0.75, marginTop: 8 }}>
          If the second probe is 200 and the first is 401, the value in Vercel is now correct and
          only a fresh build is missing.
        </p>
      </section>
    </main>
  );
}

const preStyle: React.CSSProperties = {
  marginTop: 6, padding: 10, background: "#f4f4f5", borderRadius: 8,
  fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all",
};
