import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { databaseConfigured } from "@/lib/portal/db";
import { verify, type VerifyResult } from "@/lib/portal/passport/credential";
import * as share from "@/lib/portal/passport/share";

/**
 * Public verifier: open a credential by code (or paste one) and see, step by step, whether it is authentic, unchanged, current
 * and still published by its holder. Read-only; stores nothing. The paste form is a GET form, so nothing sensitive is stored
 * or needs CSRF protection (a pasted credential is public information by design).
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify a GrowQR credential | GrowQR", description: "Check whether a GrowQR Skill Passport is authentic, unchanged and current.", robots: { index: false, follow: true } };

const HEADLINE: Record<string, [string, string, string]> = {
  valid: ["Authentic and current", "bg-emerald-50 text-emerald-900 border-emerald-200", "This credential was issued by GrowQR, has not been changed, and is still published by its holder."],
  superseded: ["Authentic, but replaced by a newer version", "bg-amber-50 text-amber-900 border-amber-200", "The signature is genuine, but the holder has since published an updated passport."],
  expired: ["Expired", "bg-amber-50 text-amber-900 border-amber-200", "The signature is genuine, but the credential is past its validity date."],
  revoked: ["Withdrawn", "bg-red-50 text-red-900 border-red-200", "The holder withdrew this passport, or GrowQR revoked it. Do not rely on it."],
  invalid: ["Not valid", "bg-red-50 text-red-900 border-red-200", "This did not pass the checks below. Do not rely on it."],
};

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  let input = "";
  let result: VerifyResult | null = null;
  let error: string | null = null;
  const fromCode = (sp.c ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (!databaseConfigured()) {
    error = "The verifier is not available right now. Please try again shortly.";
  } else if (fromCode) {
    const p = await share.byCode(fromCode);
    if (!p || p.is_public !== 1 || !p.credential) error = "No public passport was found for that code. It may have been withdrawn.";
    else {
      input = p.credential.jwt;
      result = await verify(input);
    }
  } else if (sp.credential !== undefined) {
    input = sp.credential.trim().slice(0, 200000);
    if (input === "") error = "Paste a credential to check.";
    else result = await verify(input);
  }
  const head = result ? HEADLINE[result.state] : null;

  return (
    <main id="main" className="min-h-screen bg-cream-2 px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <header className="mb-5"><Link href="/" aria-label="GrowQR home"><Image src="/growqr-logo.png" alt="GrowQR" width={120} height={34} className="h-8 w-auto" priority /></Link></header>
        <article className="bg-white rounded-2xl border border-black/[0.1] shadow-card p-6 sm:p-9">
          <h1 className="text-[26px] font-bold text-ink tracking-tight mb-1">Verify a GrowQR credential</h1>
          <p className="text-[15px] text-ink-3 mb-6">Paste a signed credential, or open one by its code, to see whether it is authentic, unchanged and current.</p>

          {error ? <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[14px] text-red-800">{error}</p> : null}

          {result && head ? (
            <section aria-labelledby="vf-h" className={`mb-6 rounded-xl border px-5 py-4 ${head[1]}`}>
              <h2 id="vf-h" className="text-[18px] font-bold">{head[0]}</h2>
              <p className="text-[14px] mt-1">{head[2]}</p>
              {result.reasons.length ? <ul className="list-disc pl-5 mt-2 text-[14px]">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
            </section>
          ) : null}
          {result ? (
            <ol className="space-y-2 mb-6">
              {result.steps.map(([t, msg, ok]) => (
                <li key={t} className="flex gap-2.5 text-[14px]"><span aria-hidden className={ok ? "text-emerald-700" : "text-red-700"}>{ok ? "✓" : "✗"}</span><span><b>{t}.</b> {msg}</span></li>
              ))}
            </ol>
          ) : null}
          {result?.state === "valid" || result?.state === "superseded" ? (
            fromCode ? <p className="mb-6"><Link className="inline-flex items-center min-h-[44px] px-5 rounded-lg bg-orange hover:bg-orange-dark text-white text-[14px] font-semibold" href={`/v/${fromCode}`}>View the passport</Link></p> : null
          ) : null}

          <form method="get" action="/verify">
            <label htmlFor="credential" className="block text-[14px] font-medium text-ink-2 mb-2">Signed credential</label>
            <textarea id="credential" name="credential" rows={5} defaultValue={fromCode ? "" : input} placeholder="eyJhbGciOiJFZERTQSIs..." className="w-full px-4 py-3 rounded-lg border border-black/[0.12] text-[13px] font-mono mb-4 outline-none focus:ring-2 focus:ring-orange/25 focus:border-orange/60" spellCheck={false} />
            <button type="submit" className="min-h-[48px] px-6 rounded-lg bg-orange hover:bg-orange-dark text-white font-semibold text-[15px]">Check credential</button>
          </form>
          <p className="text-[13px] text-ink-3 mt-6">
            Checks run on this server and, on the passport page, again in your own browser. You can also verify with any standard tool using GrowQR’s published keys:{" "}
            <a className="underline" href="/.well-known/did.json">did.json</a> · <a className="underline" href="/.well-known/jwks.json">jwks.json</a>.
          </p>
        </article>
      </div>
    </main>
  );
}
