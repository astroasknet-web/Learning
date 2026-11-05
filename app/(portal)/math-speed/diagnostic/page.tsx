import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { Card, Flash, StartButton, btnLight } from "@/components/mathspeed/ui";
import { enrolledStudent } from "@/lib/mathspeed/page";
import { getDiagnostic } from "@/lib/mathspeed/store";
import { placementSummary } from "@/lib/mathspeed/rules";
import { LEVELS } from "@/lib/mathspeed/curriculum";
import { chooseStartAction } from "../actions";

export const metadata: Metadata = { title: "Placement check | Mathematics Speed Enhancement Studio | GrowQR" };
export const dynamic = "force-dynamic";

export default async function DiagnosticPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { me, snap } = await enrolledStudent("/math-speed/diagnostic");
  const diag = await getDiagnostic(me.id);
  const done = snap.enrolment.diagnosticDone && diag?.done && diag.recommended !== null;
  return (
    <PortalPage user={me} active="math-speed" title="Placement check" subtitle="A short check that finds the right level to begin at. It is free and you can take it once." wide>
      <Flash text={sp.e} />
      {done ? (
        <Card title="Your result">
          <p className="text-[16px] text-ink-2">{placementSummary(diag!.recommended!)}</p>
          {diag!.recommended! > 1 ? (
            <form action={chooseStartAction} className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="level" className="text-[14px] font-semibold text-ink">Prefer to begin earlier?</label>
                <select id="level" name="level" defaultValue={snap.enrolment.startLevel} className="mt-1 min-h-[48px] rounded-lg border border-black/20 bg-white px-3 text-[15px]">
                  {LEVELS.slice(0, diag!.recommended!).map((l) => <option key={l.n} value={l.n}>Level {l.letter}: {l.title}</option>)}
                </select>
              </div>
              <button type="submit" className={btnLight}>Use this level</button>
            </form>
          ) : null}
          <div className="mt-4"><Link href="/math-speed/journey" className="inline-flex min-h-[48px] items-center rounded-lg bg-orange px-6 text-[15px] font-semibold text-white hover:bg-orange-dark">Go to my learning journey</Link></div>
        </Card>
      ) : (
        <>
          <Card title="How it works">
            <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-2">
              <li>You answer short sets of five questions. Each set tests one level.</li>
              <li>If you do well, the next set is from a higher level. If not, from a lower one. Most people finish in four sets.</li>
              <li>The result is a recommended starting level. It never closes the earlier levels: they stay open, and a short Foundation Check later makes sure they are secure.</li>
              <li>Nothing is lost if you start at Level A instead. You can skip the check and begin from the start.</li>
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <StartButton kind="diagnostic" refKey="" back="/math-speed/diagnostic">{diag && !diag.done && diag.probes.length ? "Continue the placement check" : "Start the placement check"}</StartButton>
              <Link href="/math-speed/journey" className="text-[14.5px] underline">Skip it and begin at Level A</Link>
            </div>
          </Card>
          {diag && diag.probes.length ? <p className="text-[14px] text-ink-3">You have finished {diag.probes.length} {diag.probes.length === 1 ? "set" : "sets"} so far.</p> : null}
        </>
      )}
    </PortalPage>
  );
}
