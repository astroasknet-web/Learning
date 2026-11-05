import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ClientCheck } from "@/components/portal/passport-ui";
import { Bars, ScoreRing } from "@/components/portal/shell";
import { base, verify } from "@/lib/portal/passport/credential";
import * as share from "@/lib/portal/passport/share";
import { clientIpFrom } from "@/lib/portal/security";
import { databaseConfigured } from "@/lib/portal/db";

/**
 * Public, QR-verifiable Skill Passport. Reached from the QR code or link on a resume. Everything shown is read from the SIGNED
 * credential after its signature has been checked, so the page cannot display anything different from what GrowQR signed.
 * No login, no contact details, not indexed by search engines.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Verified Skill Passport | GrowQR",
  description: "A GrowQR Skill Passport that can be checked for authenticity.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const EVIDENCE: Record<string, [string, string]> = {
  lms_verified: ["Verified by the course platform", "bg-emerald-50 text-emerald-800"],
  certificate_link: ["Certificate link provided", "bg-amber-50 text-amber-800"],
  self_reported: ["Self-reported", "bg-cream-3 text-ink-3"],
};
const dmy = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function Gone({ title, text }: { title: string; text: string }) {
  return (
    <main id="main" className="min-h-screen bg-cream-2 grid place-items-center px-4">
      <article className="max-w-md w-full bg-white rounded-2xl border border-black/[0.1] shadow-card p-8 text-center">
        <Image src="/growqr-logo.png" alt="GrowQR" width={120} height={34} className="h-8 w-auto mx-auto mb-6" />
        <h1 className="text-[22px] font-bold text-ink mb-2">{title}</h1>
        <p className="text-[15px] text-ink-3 mb-6">{text}</p>
        <Link href="/verify" className="inline-flex items-center min-h-[44px] px-5 rounded-lg border border-black/[0.15] text-[14px] font-medium hover:bg-cream-2">Verify a credential</Link>
      </article>
    </main>
  );
}

export default async function PublicPassport({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  if (!databaseConfigured()) return <Gone title="Temporarily unavailable" text="The passport service is not available right now. Please try again in a few minutes." />;
  const code = (await params).code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const sp = await searchParams;
  const p = await share.byCode(code);
  if (!p) notFound(); // a real 404 (see not-found.tsx next to this file)
  if (p.is_public !== 1 || !p.credential) return <Gone title="Passport withdrawn" text="The owner has taken this passport offline, so it can no longer be shown." />;
  const result = await verify(p.credential.jwt);
  if (!result.ok || result.state !== "valid" || !result.payload) {
    return <Gone title="This passport could not be verified" text={result.state === "expired" ? "This passport has expired. Ask the holder for a current one." : "The signature check failed, so GrowQR will not display it."} />;
  }

  const h = await headers();
  await share.recordView(p.id, sp.q !== undefined, { ip: clientIpFrom(h), ua: h.get("user-agent") ?? "", referer: h.get("referer") ?? "", host: h.get("host") ?? "" });

  const vc = result.payload as { validFrom: string; validUntil: string; id: string; issuer?: { id?: string }; credentialSubject: { passport: Record<string, unknown> } };
  const d = vc.credentialSubject.passport as {
    name?: string; college?: string; careerStage?: string; field?: string;
    rq?: { score: number; scale?: number; grade?: string; scoredAt?: string; method?: string; sections?: Array<{ name: string; percent: number }> };
    skills?: Array<{ name: string; evidence?: string }>;
    courses?: Array<{ title: string; completedAt?: string | null; evidence?: string }>;
  };
  const rq = d.rq;
  const origin = await base();

  return (
    <main id="main" className="min-h-screen bg-cream-2 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-5">
          <Link href="/" aria-label="GrowQR home"><Image src="/growqr-logo.png" alt="GrowQR" width={120} height={34} className="h-8 w-auto" priority /></Link>
          <Link href={`/verify?c=${code}`} className="text-[14px] font-medium text-orange-dark underline underline-offset-2">Verify independently</Link>
        </header>

        <article className="bg-white rounded-2xl border border-black/[0.1] shadow-card p-6 sm:p-9" aria-labelledby="pv-name">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-4">GrowQR Verified Skill Passport</p>
          <h1 id="pv-name" className="text-[28px] sm:text-[34px] font-bold text-ink tracking-tight">{d.name ?? "GrowQR learner"}</h1>
          <p role="status" className="mt-2 mb-6 text-[14px] text-emerald-800 bg-emerald-50 rounded-lg px-3.5 py-2.5">
            Signature checked: this is exactly what GrowQR issued on {dmy(vc.validFrom)}, valid until {dmy(vc.validUntil)}.
          </p>
          <ClientCheck jwt={p.credential.jwt} jwksUrl="/.well-known/jwks.json" />

          {rq ? (
            <section aria-labelledby="pv-rq" className="flex flex-col sm:flex-row gap-6 sm:items-center pb-6 mb-6 border-b border-black/[0.07]">
              <ScoreRing value={rq.score} label={`RQ Score ${rq.score} out of ${rq.scale ?? 100}`} />
              <div>
                <h2 id="pv-rq" className="text-[22px] font-bold text-ink">RQ Score {rq.score}<span className="text-ink-4 font-medium"> / {rq.scale ?? 100}</span></h2>
                <p className="text-[16px] font-semibold text-orange-deep">{rq.grade}</p>
                <p className="text-[13px] text-ink-3 mt-1">
                  Scored on {rq.scoredAt ? dmy(rq.scoredAt) : ""}
                  {d.careerStage ? ` · ${d.careerStage[0].toUpperCase()}${d.careerStage.slice(1)}` : ""}
                  {d.field ? ` · ${d.field}` : ""}
                </p>
              </div>
            </section>
          ) : null}
          {rq?.sections?.length ? (
            <div className="mb-6">
              <Bars items={rq.sections} />
              <p className="text-[12px] text-ink-4 mt-3">{rq.method}. Rule-based and explainable: the same resume always gets the same score.</p>
            </div>
          ) : null}

          {d.college ? (
            <section className="mb-6"><h2 className="text-[16px] font-semibold text-ink mb-1">College</h2><p className="text-[15px] text-ink-2">{d.college} <small className="text-ink-4">(stated by the holder)</small></p></section>
          ) : null}

          {d.skills ? (
            <section className="mb-6" aria-labelledby="pv-sk">
              <h2 id="pv-sk" className="text-[16px] font-semibold text-ink mb-2">Skills</h2>
              {d.skills.length ? (
                <>
                  <ul className="flex flex-wrap gap-2">
                    {d.skills.map((s) => (
                      <li key={s.name} className={`px-3 py-1.5 rounded-full text-[13px] ${s.evidence === "course" ? "bg-emerald-50 text-emerald-800" : "bg-cream-3 text-ink-2"}`}>
                        {s.name}{s.evidence === "course" ? <><span className="sr-only"> (backed by a completed course)</span><span aria-hidden> ✓</span></> : null}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] text-ink-4 mt-2">✓ = backed by a completed course. Other skills are listed on the holder’s resume.</p>
                </>
              ) : <p className="text-[14px] text-ink-4">No skills listed.</p>}
            </section>
          ) : null}

          {d.courses ? (
            <section className="mb-6" aria-labelledby="pv-co">
              <h2 id="pv-co" className="text-[16px] font-semibold text-ink mb-2">Completed courses</h2>
              {d.courses.length ? (
                <ul className="divide-y divide-black/[0.07]">
                  {d.courses.map((c) => {
                    const [label, cls] = EVIDENCE[c.evidence ?? "self_reported"] ?? EVIDENCE.self_reported;
                    return (
                      <li key={c.title} className="py-2.5 flex items-start justify-between gap-3 text-[14px]">
                        <span><b className="text-ink">{c.title}</b>{c.completedAt ? <small className="block text-ink-4">Completed {dmy(c.completedAt)}</small> : null}</span>
                        <em className={`not-italic text-[12px] px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>{label}</em>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-[14px] text-ink-4">No completed courses yet.</p>}
            </section>
          ) : null}

          <section aria-labelledby="pv-tr" className="mb-6 rounded-xl bg-cream p-5">
            <h2 id="pv-tr" className="text-[16px] font-semibold text-ink mb-3">What this passport does and does not show</h2>
            <div className="grid sm:grid-cols-2 gap-5 text-[13px] text-ink-3">
              <div><h3 className="font-semibold text-ink mb-1.5">GrowQR confirms</h3><ul className="list-disc pl-4 space-y-1"><li>The details above are exactly what GrowQR signed. Any edit breaks the signature.</li><li>The score was produced by GrowQR’s scoring engine from a resume the holder submitted.</li><li>Course evidence is labelled by how it was confirmed.</li></ul></div>
              <div><h3 className="font-semibold text-ink mb-1.5">GrowQR does not confirm</h3><ul className="list-disc pl-4 space-y-1"><li>Identity, employment history or education claims on the resume.</li><li>That the holder wrote the resume themselves.</li><li>Suitability for any particular role. Use it alongside an interview.</li></ul></div>
            </div>
          </section>

          <section aria-labelledby="pv-vf">
            <h2 id="pv-vf" className="text-[16px] font-semibold text-ink mb-2">Check it yourself</h2>
            <p className="text-[14px] text-ink-3 mb-3">You do not have to trust this page. The credential is signed with GrowQR’s public key, which anyone can fetch and use.</p>
            <ol className="space-y-2 mb-4">
              {result.steps.map(([t, msg, ok]) => (
                <li key={t} className="flex gap-2.5 text-[14px]"><span aria-hidden className={ok ? "text-emerald-700" : "text-red-700"}>{ok ? "✓" : "✗"}</span><span><b>{t}.</b> {msg}</span></li>
              ))}
            </ol>
            <p className="flex flex-wrap gap-2 text-[13px]">
              <Link className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-black/[0.15] hover:bg-cream-2" href={`/verify?c=${code}`}>Open the verifier</Link>
              <a className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-black/[0.15] hover:bg-cream-2" href={`/v/${code}/credential.jwt`} download={`growqr-passport-${code}.jwt`}>Download signed credential</a>
              <a className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-black/[0.15] hover:bg-cream-2" href={`/v/${code}/credential.json`}>View as JSON</a>
              <a className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-black/[0.15] hover:bg-cream-2" href={`${origin}.well-known/did.json`}>Issuer public key</a>
            </p>
            <details className="mt-4 text-[13px] text-ink-3">
              <summary className="cursor-pointer font-medium">Technical details</summary>
              <dl className="mt-2 space-y-1 break-all">
                <div><dt className="inline font-semibold">Standard: </dt><dd className="inline">W3C Verifiable Credential (data model 2.0), Open Badges 3.0 shape, signed as vc+jwt (Ed25519 / EdDSA)</dd></div>
                <div><dt className="inline font-semibold">Issuer: </dt><dd className="inline">{vc.issuer?.id}</dd></div>
                <div><dt className="inline font-semibold">Credential ID: </dt><dd className="inline">{vc.id}</dd></div>
                <div><dt className="inline font-semibold">Key ID: </dt><dd className="inline">{result.kid}</dd></div>
              </dl>
            </details>
          </section>
        </article>
        <footer className="text-center text-[13px] text-ink-3 mt-5">
          <p>Issued by <Link className="underline" href="/">GrowQR</Link>. The holder chose what is shown here and can withdraw it at any time. <Link className="underline" href="/verify">Verify another credential</Link></p>
        </footer>
      </div>
    </main>
  );
}
