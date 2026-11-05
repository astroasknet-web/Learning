import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/portal/guard";
import { available } from "@/lib/portal/passport/credential";
import * as passport from "@/lib/portal/passport/profile";
import { qrSvg } from "@/lib/portal/passport/qr";
import * as share from "@/lib/portal/passport/share";
import { Card, PortalPage } from "@/components/portal/shell";
import { CopyField, PublishForm } from "@/components/portal/passport-ui";
import { Alert } from "@/components/portal/ui";
import { withdrawPassportAction } from "../actions";

export const metadata: Metadata = { title: "Share my passport | GrowQR" };
export const dynamic = "force-dynamic";

export default async function SharePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser("student");
  const sp = await searchParams;
  const p = await passport.profile(me.id);
  const row = await share.forUser(me.id);
  const pub = row && row.is_public === 1 ? await share.byCode(row.code) : null;

  if (!p?.rq) {
    return (
      <PortalPage user={me} active="share" title="Share my passport" subtitle="Score your resume first: a passport needs an RQ Score.">
        <Card>
          <Link href="/passport" className="inline-flex items-center min-h-[48px] px-5 rounded-lg bg-orange hover:bg-orange-dark text-white font-semibold">Score my resume</Link>
        </Card>
      </PortalPage>
    );
  }

  const code = row?.code ?? "";
  const url = pub ? await share.url(code) : "";
  const qrUrl = pub ? await share.url(code, true) : "";
  const svg = pub ? await qrSvg(qrUrl, 224) : "";
  const stats = pub && row ? await share.stats(row.id) : null;
  const cred = pub?.credential;
  const linkedIn = pub && cred ? await share.linkedInUrl(code, Date.parse(cred.issued_at.replace(" ", "T") + "Z") / 1000, Date.parse(cred.expires_at.replace(" ", "T") + "Z") / 1000) : "";

  return (
    <PortalPage user={me} active="share" title="Share my passport" subtitle="A public page with a QR code that anyone can check for authenticity. You choose what it shows and can withdraw it at any time.">
      {!available() ? <Alert>Passport signing is not set up on this server yet, so publishing is switched off. Please contact support.</Alert> : null}
      {sp.withdrawn ? <Alert kind="success">Your passport is offline. Old links and QR codes now say it was withdrawn.</Alert> : null}

      {pub && stats ? (
        <Card title="Your public passport">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="shrink-0 rounded-xl border border-black/[0.08] p-2 bg-white self-start" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="min-w-0 flex-1 space-y-4">
              <CopyField label="Passport link" value={url} />
              <div className="flex flex-wrap gap-2 text-[14px]">
                <Link className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-black/[0.15] hover:bg-cream-2" href={`/v/${code}`} target="_blank">Open public page</Link>
                <a className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-black/[0.15] hover:bg-cream-2" href={linkedIn} target="_blank" rel="noopener noreferrer">Add to LinkedIn</a>
                <Link className="min-h-[44px] inline-flex items-center px-4 rounded-lg border border-black/[0.15] hover:bg-cream-2" href={`/verify?c=${code}`} target="_blank">Verifier</Link>
              </div>
              <p className="text-[13px] text-ink-3">Print the QR code on your resume. Anyone who scans it sees this page and can check the signature.</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-black/[0.07] text-center">
            <div><dt className="text-[12px] text-ink-4">Views</dt><dd className="text-[22px] font-bold text-ink">{stats.total}</dd></div>
            <div><dt className="text-[12px] text-ink-4">Last 7 days</dt><dd className="text-[22px] font-bold text-ink">{stats.d7}</dd></div>
            <div><dt className="text-[12px] text-ink-4">Last 30 days</dt><dd className="text-[22px] font-bold text-ink">{stats.d30}</dd></div>
            <div><dt className="text-[12px] text-ink-4">From QR scans</dt><dd className="text-[22px] font-bold text-ink">{stats.qr}</dd></div>
          </dl>
          <p className="text-[12px] text-ink-4 mt-3">Counts are anonymous. We store no names, IP addresses or devices, and ignore search-engine bots.</p>
        </Card>
      ) : null}

      <Card title={pub ? "Change what it shows" : "Publish your passport"}>
        <PublishForm
          styles={share.STYLES}
          current={{ name_style: row?.name_style ?? "first_initial", show_skills: row ? row.show_skills === 1 : true, show_courses: row ? row.show_courses === 1 : true, show_college: row ? row.show_college === 1 : false, is_public: Boolean(pub) }}
        />
      </Card>

      {pub ? (
        <Card title="Withdraw">
          <details>
            <summary className="cursor-pointer text-[14px] font-medium text-red-700 min-h-[44px] inline-flex items-center">Take my passport offline</summary>
            <form action={withdrawPassportAction} className="mt-3">
              <p className="text-[14px] text-ink-3 mb-3">The public page stops working and every signed copy is marked withdrawn. You can publish again later and keep the same link.</p>
              <button type="submit" className="min-h-[44px] px-4 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[14px] font-semibold">Yes, withdraw it</button>
            </form>
          </details>
        </Card>
      ) : null}
    </PortalPage>
  );
}
