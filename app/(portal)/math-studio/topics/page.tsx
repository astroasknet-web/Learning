import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { Bar, Card, Crumbs, EvidenceTag, Locked, btnLight } from "@/components/mathstudio/ui";
import { studentPage } from "@/lib/mathstudio/page";
import { buildTopics } from "@/lib/mathstudio/views";
import { AREAS } from "@/lib/mathstudio/taxonomy";
import { EVIDENCE_LABEL } from "@/lib/mathstudio/taxonomy";

export const metadata: Metadata = { title: "Topic mastery | Mathematics Studio | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const BAND: Record<string, string> = { support: "Needs work", developing: "Developing", progressing: "Progressing", secure: "Secure" };

export default async function Topics() {
  const { me } = await studentPage("/math-studio/topics");
  const v = await buildTopics(me.id);
  return (
    <PortalPage user={me} active="math-studio" title="Topic mastery" subtitle="Every topic you have been tested on, with the evidence behind each estimate." wide="full">
      <Crumbs items={[{ href: "/math-studio/dashboard", label: "Mathematics Studio" }, { label: "Topics" }]} />
      {!v ? <Locked headline="Topic-by-topic mastery" body="The full breakdown of every topic, with a confidence band and the questions behind each estimate, is part of the Mathematics Studio." source="topics" /> : (
        AREAS.filter((a) => v.mastery.some((m) => m.area === a.id && m.evidence !== "insufficient")).map((a) => (
          <Card key={a.id} title={a.name} id={a.id}>
            <ul className="space-y-3">
              {v.mastery.filter((m) => m.area === a.id && m.evidence !== "insufficient").map((m) => (
                <li key={m.topic}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-medium text-ink">{m.topicName}</span>
                    <span className="flex items-center gap-2 text-[13px] text-ink-3"><EvidenceTag label={EVIDENCE_LABEL[m.evidence]} /> {m.items} q · {BAND[m.band]}{m.trend !== null ? ` · ${m.trend > 0 ? "+" : ""}${m.trend}` : ""}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3"><div className="flex-1"><Bar pct={m.score} label={m.topicName} low={m.low} high={m.high} /></div><span className="w-20 text-right text-[14px] font-semibold text-ink">{Math.round(m.score)}/100</span></div>
                  <p className="mt-0.5 text-[12px] text-ink-4">Estimate {Math.round(m.low)}–{Math.round(m.high)}; average difficulty seen {m.avgDifficulty}/5.</p>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
      {v && !v.mastery.some((m) => m.evidence !== "insufficient") ? <Card><p className="text-[14.5px] text-ink-3">No topic has enough questions yet. Take a few more tests and they will appear here.</p></Card> : null}
      <div className="mt-2"><Link href="/math-studio/dashboard" className={btnLight}>Back to my Studio</Link></div>
    </PortalPage>
  );
}
