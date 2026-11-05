import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { box, btnDark, btnLine, ConsolePage, field } from "@/components/admin/console-page";
import { passageDetail } from "@/lib/reading/admin";
import { QTYPES, SKILLS } from "@/lib/reading/taxonomy";
import { adminGate } from "../../../gate";
import { passageStatusAction, questionAction, reviewAction } from "../../actions";

export const metadata: Metadata = { title: "Passage | Console | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PassageAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await adminGate(`/console/reading/content/${id}`);
  const d = await passageDetail(Number(id));
  if (!d) notFound();
  const p = d.passage;
  const back = `/console/reading/content/${p.id}`;
  return (
    <ConsolePage me={me} tab="reading" title={p.title} subtitle={`${p.slug} · ${p.word_count} words · difficulty ${p.difficulty} · ${p.status} · ${p.source} · ${p.review_state === "reviewed" ? "reviewed" : "not reviewed"}`}>
      <p className="mb-4 text-[14px]"><Link href="/console/reading/content" className="underline">All passages</Link></p>
      <section className={box} aria-labelledby="act-h">
        <h2 id="act-h" className="mb-3 text-[18px] font-semibold text-ink">Publishing</h2>
        {d.issues.length ? <ul className="mb-3 space-y-1 text-[14px]">{d.issues.map((i, k) => <li key={k} className={i.level === "error" ? "text-red-700" : "text-amber-800"}>{i.level === "error" ? "Error" : "Warning"}: {i.message}</li>)}</ul> : <p className="mb-3 text-[14px] text-emerald-800">All validation checks pass.</p>}
        <div className="flex flex-wrap gap-3">
          {(["approved", "draft", "archived"] as const).map((st) => <form key={st} action={passageStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={st} /><button type="submit" className={st === "approved" ? btnDark : btnLine} disabled={p.status === st}>{st === "approved" ? "Approve" : st === "draft" ? "Return to draft" : "Archive"}</button></form>)}
          <form action={reviewAction}><input type="hidden" name="entity" value="passage" /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} /><button type="submit" className={btnLine}>Mark passage and questions as reviewed by me</button></form>
        </div>
      </section>
      <section className={box} aria-labelledby="body-h"><h2 id="body-h" className="mb-2 text-[18px] font-semibold text-ink">Passage text</h2><div className="max-w-prose space-y-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{p.body}</div></section>
      <section aria-labelledby="q-h">
        <h2 id="q-h" className="mb-3 text-[18px] font-semibold text-ink">Questions ({d.questions.length})</h2>
        {d.questions.map((q) => {
          const opts: string[] | { left: string[]; right: string[] } = JSON.parse(q.options_json);
          const ans = JSON.parse(q.answer_json);
          return (
            <details key={q.id} className="mb-3 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-card">
              <summary className="cursor-pointer text-[14.5px] font-medium text-ink">{q.ref} · {q.mode} · {q.format} · {SKILLS[q.skill as keyof typeof SKILLS]?.label ?? q.skill} · {q.status}{q.issues.some((i) => i.level === "error") ? " · has errors" : ""}{q.review_state === "reviewed" ? " · reviewed" : ""}</summary>
              <div className="mt-3">
                {q.issues.length ? <ul className="mb-3 text-[13.5px]">{q.issues.map((i, k) => <li key={k} className={i.level === "error" ? "text-red-700" : "text-amber-800"}>{i.message}</li>)}</ul> : null}
                {q.format === "match" ? <p className="text-[14px] text-ink-3">Match question: {JSON.stringify(opts)} key {JSON.stringify(ans)}. Re-import to change a match question.</p> : (
                  <form action={questionAction} className="grid gap-3">
                    <input type="hidden" name="id" value={q.id} /><input type="hidden" name="passage" value={p.id} />
                    <label className="text-[13.5px] font-medium">Question<textarea name="stem" rows={2} defaultValue={q.stem} className={`${field} mt-1 w-full`} /></label>
                    {q.format === "short" ? <label className="text-[13.5px] font-medium">Accepted answers (separate with |)<input name="key" defaultValue={(ans as string[]).join(" | ")} className={`${field} mt-1 w-full`} /></label> : (<>
                      <label className="text-[13.5px] font-medium">Options (one per line)<textarea name="options" rows={4} defaultValue={(opts as string[]).join("\n")} className={`${field} mt-1 w-full`} /></label>
                      <label className="text-[13.5px] font-medium">Position of the correct option (0 is the first)<input name="key" type="number" min={0} max={4} defaultValue={ans as number} className={`${field} mt-1 w-24`} /></label></>)}
                    <label className="text-[13.5px] font-medium">Explanation (why the key is supported, why a tempting option is not)<textarea name="explanation" rows={3} defaultValue={q.explanation} className={`${field} mt-1 w-full`} /></label>
                    <div className="flex flex-wrap gap-3">
                      <label className="text-[13.5px] font-medium">Skill<select name="skill" defaultValue={q.skill} className={`${field} mt-1 block`}>{Object.entries(SKILLS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
                      <label className="text-[13.5px] font-medium">Question type<select name="qtype" defaultValue={q.qtype} className={`${field} mt-1 block`}>{Object.entries(QTYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                      <label className="text-[13.5px] font-medium">Difficulty<select name="difficulty" defaultValue={q.difficulty} className={`${field} mt-1 block`}><option value={1}>Easy</option><option value={2}>Medium</option><option value={3}>Difficult</option></select></label>
                      <label className="text-[13.5px] font-medium">Guide seconds<input name="secs" type="number" min={10} max={300} defaultValue={q.expected_secs} className={`${field} mt-1 block w-24`} /></label>
                      <label className="text-[13.5px] font-medium">Status<select name="status" defaultValue={q.status} className={`${field} mt-1 block`}><option value="draft">Draft</option><option value="approved">Approved</option><option value="archived">Archived</option></select></label>
                    </div>
                    <div className="flex flex-wrap gap-3"><button type="submit" className={btnDark}>Validate and save</button></div>
                  </form>)}
                <form action={reviewAction} className="mt-3"><input type="hidden" name="entity" value="question" /><input type="hidden" name="id" value={q.id} /><input type="hidden" name="back" value={back} /><button type="submit" className={btnLine}>Mark this question as reviewed</button></form>
              </div>
            </details>
          );
        })}
      </section>
    </ConsolePage>
  );
}
