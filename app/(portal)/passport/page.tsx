import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/portal/guard";
import { adviceFromResult, isScored, scoreText } from "@/lib/qrscore";
import { dropSessionData, getSession } from "@/lib/portal/session";
import * as passport from "@/lib/portal/passport/profile";
import * as resumes from "@/lib/portal/passport/resumes";
import { deleteResumeAction } from "./actions";
import { Bars, Card, PortalPage, ScoreRing } from "@/components/portal/shell";
import { ScoreForm } from "@/components/portal/passport-ui";
import { Alert } from "@/components/portal/ui";

export const metadata: Metadata = { title: "My Skill Passport | GrowQR" };
export const dynamic = "force-dynamic";

export default async function PassportPage() {
  const me = await requireUser("student");
  // A resume the visitor checked on the public page just before signing up: save it to this passport, once.
  let imported = false;
  const pend = (await getSession())?.data?.pending_resume as { text?: unknown; t?: unknown } | undefined;
  if (pend) {
    await dropSessionData("pending_resume");
    try {
      const had = await passport.profile(me.id);
      if ((!had || had.rq_overall === null) && typeof pend.text === "string" && Date.now() / 1000 - Number(pend.t ?? 0) < 86400) {
        const pr = scoreText(pend.text);
        if (isScored(pr)) {
          await passport.saveResult(me.id, pr, "Resume checked on GrowQR", pend.text);
          await resumes.saveAccepted(me.id, pr, pend.text, {});
          imported = true;
        }
      }
    } catch (e) {
      console.error("pending resume import:", (e as Error).message);
    }
  }
  const p = await passport.profile(me.id);
  const rq = p?.rq ?? null;
  const history = await resumes.forUser(me.id);
  const sections = (rq?.sections ?? [])
    .filter((s) => s.applicable)
    .map((s) => ({ name: String(s.name), percent: Math.round((Number(s.section_score) / Math.max(1, Number(s.points_per_section ?? 20))) * 100) }));
  const advice = rq ? adviceFromResult(rq) : [];

  return (
    <PortalPage user={me} active="passport" title="My Skill Passport" subtitle="Your resume quality score, skills and courses in one place. Private until you choose to share it.">
      {imported ? <Alert kind="success">We saved the resume you just checked to your Skill Passport.</Alert> : null}
      {!me.email_verified_at ? <Alert kind="info">Confirm your email to unlock applying to internships. Check your inbox.</Alert> : null}

      {rq && p ? (
        <Card>
          <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
            <ScoreRing value={Number(p.rq_overall ?? rq.overall.score)} label={`RQ Score ${Math.round(Number(p.rq_overall ?? rq.overall.score))} out of 100`} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-4">RQ Score</p>
              <p className="text-[24px] font-bold text-ink">{p.rq_grade}</p>
              <p className="text-[14px] text-ink-3 mt-1">
                {rq.career.stage ? `Career stage: ${rq.career.stage}. ` : ""}
                {rq.domain.label ? `Field: ${rq.domain.label}.` : ""}
              </p>
              <Link href="/passport/share" className="inline-flex items-center min-h-[44px] mt-3 px-4 rounded-lg bg-orange hover:bg-orange-dark text-white text-[14px] font-semibold">Share my passport</Link>
            </div>
          </div>
        </Card>
      ) : null}

      {sections.length ? (
        <Card title="Score by section">
          <Bars items={sections} />
        </Card>
      ) : null}

      {advice.length ? (
        <Card title="What to work on first">
          <ol className="space-y-4">
            {advice.map((a) => (
              <li key={a.title}>
                <b className="text-ink">{a.title}</b>
                <p className="text-[14px] text-ink-3 mt-0.5">{a.text}</p>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {p && p.skills.length ? (
        <Card title="Skills found in your resume">
          <ul className="flex flex-wrap gap-2">
            {p.skills.slice(0, 40).map((s) => (
              <li key={s} className="px-3 py-1.5 rounded-full bg-cream-3 text-[13px] text-ink-2">{s}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title={rq ? "Update your resume" : "Score your resume to start your passport"}>
        <ScoreForm hasPassport={Boolean(rq)} />
      </Card>

      {history.length ? (
        <Card title="Your uploads">
          <ul className="divide-y divide-black/[0.07]">
            {history.map((h) => (
              <li key={h.id} className="py-3 flex items-center justify-between gap-3 text-[14px]">
                <span className="min-w-0">
                  <b className="text-ink block truncate">{h.original_name || "Pasted text"}</b>
                  <span className="text-ink-4">{new Date(h.created_at.replace(" ", "T") + "Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {h.source}{h.rq_overall ? ` · score ${Math.round(Number(h.rq_overall))}` : ""}{h.is_current ? " · current" : ""}</span>
                </span>
                <form action={deleteResumeAction}>
                  <input type="hidden" name="id" value={h.id} />
                  <button type="submit" className="min-h-[44px] px-3 rounded-lg text-[13px] font-medium text-red-700 hover:bg-red-50">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </PortalPage>
  );
}
