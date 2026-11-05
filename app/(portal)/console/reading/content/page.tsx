import type { Metadata } from "next";
import Link from "next/link";
import { box, btnDark, ConsolePage, field } from "@/components/admin/console-page";
import { listPassages } from "@/lib/reading/admin";
import { ensureSeed } from "@/lib/reading/store";
import { adminGate } from "../../gate";
import { importAction } from "../actions";

export const metadata: Metadata = { title: "Reading content | Console | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const th = "py-2 pr-3 text-left font-medium text-ink-4";
const SAMPLE = `[{
  "slug": "my-new-passage", "title": "A title", "topic": "science", "difficulty": 2, "vocabLevel": 2, "levelKey": "B", "isDiagnostic": false,
  "body": "Write at least sixty words of passage text here...",
  "questions": [{
    "ref": "NEW-1", "mode": "practice", "format": "mcq", "stem": "What is the main idea of the passage?",
    "options": ["First option", "Second option", "Third option", "Fourth option"], "answer": 1,
    "explanation": "Say why the key is supported by the passage and why the tempting option is not.",
    "skill": "main_idea", "qtype": "interpret", "difficulty": 2, "expectedSecs": 40
  }]
}]`;

export default async function ReadingContent() {
  const me = await adminGate("/console/reading/content");
  await ensureSeed();
  const list = await listPassages();
  return (
    <ConsolePage me={me} tab="reading" title="Passages and questions" subtitle="Approve, archive and review content. A passage with validation errors cannot be approved.">
      <section className={box} aria-labelledby="p-h">
        <h2 id="p-h" className="mb-3 text-[18px] font-semibold text-ink">Passages ({list.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-[14px]">
            <thead><tr><th scope="col" className={th}>Passage</th><th scope="col" className={th}>Where</th><th scope="col" className={th}>Words</th><th scope="col" className={th}>Questions</th><th scope="col" className={th}>Status</th><th scope="col" className={th}>Source</th><th scope="col" className={th}>Review</th><th scope="col" className={th}>Checks</th></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id} className="border-t border-black/[0.07] align-top">
                <th scope="row" className="py-2 pr-3 text-left font-medium"><Link className="underline" href={`/console/reading/content/${p.id}`}>{p.title}</Link><span className="block text-[12px] font-normal text-ink-4">{p.slug} · difficulty {p.difficulty}</span></th>
                <td className="pr-3">{p.isDiagnostic ? "Starting assessment" : p.levelKey ? `Level ${p.levelKey}` : "Unassigned"}</td>
                <td className="pr-3">{p.wordCount}</td>
                <td className="pr-3">{p.approvedQuestions} of {p.questions} approved</td>
                <td className="pr-3">{p.status}</td>
                <td className="pr-3">{p.source}</td>
                <td className="pr-3">{p.reviewState === "reviewed" ? "Reviewed" : `Not reviewed (${p.unreviewedQuestions} q)`}</td>
                <td>{p.errors ? <span className="font-semibold text-red-700">{p.errors} error{p.errors === 1 ? "" : "s"}</span> : "Pass"}{p.warnings ? `, ${p.warnings} warning${p.warnings === 1 ? "" : "s"}` : ""}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </section>
      <section className={box} aria-labelledby="i-h">
        <h2 id="i-h" className="mb-1 text-[18px] font-semibold text-ink">Add content by import (hand-written or AI-drafted)</h2>
        <p className="mb-3 max-w-prose text-[14px] text-ink-3">Paste passages with their questions as JSON. Everything arrives as a <strong>draft</strong>, is validated (keys inside the options, no duplicate options, an explanation, a known skill, no exam names), and must be approved before students see it. Content marked as AI-drafted additionally needs a person to review and mark it reviewed. The AI never publishes anything.</p>
        <form action={importAction} className="grid gap-3">
          <label htmlFor="json" className="text-[14px] font-medium text-ink">Passages JSON</label>
          <textarea id="json" name="json" rows={12} className={`${field} font-mono text-[12.5px]`} defaultValue={SAMPLE} />
          <div className="flex flex-wrap items-center gap-4"><label className="text-[14px]"><span className="mr-2">Source</span><select name="source" className={field}><option value="authored">Written by a person</option><option value="ai">Drafted by an AI (needs review)</option></select></label><button type="submit" className={btnDark}>Validate and import as drafts</button></div>
        </form>
      </section>
    </ConsolePage>
  );
}
