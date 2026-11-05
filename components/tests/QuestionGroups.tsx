import { cleanHtml } from "@/lib/market/lessons";
import type { Group, Opt, Q } from "@/lib/tests/ielts";

const html = (s: string) => ({ __html: cleanHtml(s) });
const field = "min-h-[44px] px-3 rounded-lg border border-black/[0.2] bg-white text-[15px]";
const TFNG = ["TRUE", "FALSE", "NOT GIVEN"];
const YNNG = ["YES", "NO", "NOT GIVEN"];

function Choice({ q, items }: { q: Q; items: string[] }) {
  return (
    <fieldset className="mt-1">
      <legend className="sr-only">Answer for question {q.n}</legend>
      <div className="flex flex-wrap gap-2">
        {items.map((v) => (
          <label key={v} className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-black/[0.15] bg-white text-[14px] has-[:checked]:bg-orange-deep has-[:checked]:text-white has-[:checked]:border-orange-deep">
            <input type="radio" name={`q${q.n}`} value={v} className="accent-orange" />{v}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Select({ q, opts, kind }: { q: Q; opts: Opt[]; kind: string }) {
  return (
    <div className="mt-1">
      <label htmlFor={`q${q.n}`} className="sr-only">Answer for question {q.n}</label>
      <select id={`q${q.n}`} name={`q${q.n}`} defaultValue="" className={`${field} w-full sm:w-auto max-w-full`}>
        <option value="">Choose {kind}</option>
        {opts.map((o) => <option key={o.label} value={o.label}>{o.label}{kind === "heading" ? ` — ${o.text}` : ""}</option>)}
      </select>
    </div>
  );
}

/** One test's question groups as an uncontrolled form body: fields are named q<number> and the server action reads them. */
export default function QuestionGroups({ groups }: { groups: Group[] }) {
  return (
    <div className="space-y-6">
      {groups.map((g, gi) => (
        <section key={gi} className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-5" aria-label={`Questions ${g.range}`}>
          <h3 className="text-[16px] font-bold text-ink">Questions {g.range}</h3>
          <div className="text-[14px] text-ink-3 mt-1" dangerouslySetInnerHTML={html(g.instructions)} />
          {g.wordLimit ? <p className="text-[13px] font-semibold text-ink-2 mt-1">{g.wordLimit}</p> : null}
          {g.plan ? <div className="mt-3 rounded-lg bg-cream-2 p-3 text-[14px] text-ink-2" dangerouslySetInnerHTML={html(g.plan)} /> : null}
          {g.headings ? (
            <div className="mt-3 rounded-lg bg-cream-2 p-3"><b className="text-[13px] text-ink">List of headings</b>
              <ul className="mt-1 text-[14px] text-ink-2 space-y-0.5">{g.headings.map((h) => <li key={h.label}><b>{h.label}</b> {h.text}</li>)}</ul></div>
          ) : null}
          {g.type === "matching" && g.options ? (
            <div className="mt-3 rounded-lg bg-cream-2 p-3"><ul className="text-[14px] text-ink-2 space-y-0.5">{g.options.map((o) => <li key={o.label}><b>{o.label}</b> {o.text}</li>)}</ul></div>
          ) : null}
          <ol className="mt-4 space-y-4" start={g.questions[0]?.n}>
            {g.questions.map((q) => (
              <li key={q.n} value={q.n} className="text-[15px] text-ink-2">
                <span className="font-semibold text-ink mr-1">{q.n}.</span><span dangerouslySetInnerHTML={html(q.prompt.replace(/_{3,}/g, "…………"))} />
                {g.type === "tfng" ? <Choice q={q} items={TFNG} />
                  : g.type === "ynng" ? <Choice q={q} items={YNNG} />
                  : g.type === "mcq" ? (
                    <fieldset className="mt-1"><legend className="sr-only">Answer for question {q.n}</legend>
                      {(q.options ?? g.options ?? []).map((o) => (
                        <label key={o.label} className="flex items-start gap-2 min-h-[44px] py-1.5 text-[14px]"><input type="radio" name={`q${q.n}`} value={o.label} className="mt-1 accent-orange" /><span><b>{o.label}</b> {o.text}</span></label>
                      ))}
                    </fieldset>
                  )
                  : g.type === "matching-headings" ? <Select q={q} opts={g.headings ?? []} kind="heading" />
                  : g.type === "matching" ? <Select q={q} opts={q.options ?? g.options ?? []} kind="option" />
                  : (
                    <div className="mt-1"><label htmlFor={`q${q.n}`} className="sr-only">Answer for question {q.n}</label>
                      <input id={`q${q.n}`} name={`q${q.n}`} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={80} className={`${field} w-full sm:w-72`} /></div>
                  )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
