"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface LibCard { n: number; title: string; words: number; questions: number; theme: string; themeName: string; hue: string; exams: string[]; difficulty: number; minutes: number; free: boolean; locked: boolean; attempts: number; best: number | null; skills: string[] }
export interface LibTheme { id: string; name: string; hue: string }

const chip = "inline-flex min-h-[40px] items-center rounded-full border px-4 text-[14px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

/** The test library: every test as a card, filtered on the spot by exam, theme, free tests and a word search. */
export default function Library({ cards, themes, exams, signedIn }: { cards: LibCard[]; themes: LibTheme[]; exams: string[]; signedIn: boolean }) {
  const [exam, setExam] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [free, setFree] = useState(false);
  const [q, setQ] = useState("");
  const shown = useMemo(() => cards.filter((c) => (!exam || c.exams.includes(exam)) && (!theme || c.theme === theme) && (!free || c.free) && (!q.trim() || `${c.title} ${c.themeName}`.toLowerCase().includes(q.trim().toLowerCase()))), [cards, exam, theme, free, q]);
  const on = "border-ink bg-ink text-white";
  const off = "border-black/15 bg-white text-ink hover:border-orange";
  return (
    <div>
      <div className="rounded-2xl border border-black/[0.08] bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by examination">
          <span className="mr-1 text-[13px] font-semibold text-ink-3">Exam</span>
          <button type="button" className={`${chip} ${!exam ? on : off}`} aria-pressed={!exam} onClick={() => setExam(null)}>All</button>
          {exams.map((e) => <button key={e} type="button" className={`${chip} ${exam === e ? on : off}`} aria-pressed={exam === e} onClick={() => setExam(exam === e ? null : e)}>{e}</button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by theme">
          <span className="mr-1 text-[13px] font-semibold text-ink-3">Theme</span>
          <button type="button" className={`${chip} ${!theme ? on : off}`} aria-pressed={!theme} onClick={() => setTheme(null)}>All</button>
          {themes.map((t) => <button key={t.id} type="button" className={`${chip} ${theme === t.id ? on : off}`} aria-pressed={theme === t.id} onClick={() => setTheme(theme === t.id ? null : t.id)}><span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.hue }} />{t.name}</button>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex min-h-[40px] items-center gap-2 text-[14px] font-medium text-ink"><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-4 w-4" /> Free tests only</label>
          <label className="flex-1 min-w-[12rem]"><span className="sr-only">Search the tests</span><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: water, AI, UCC, defence…" className="min-h-[44px] w-full rounded-full border border-black/15 bg-cream-2 px-4 text-[14.5px] focus:border-orange focus:outline-none" /></label>
          <p className="text-[13.5px] text-ink-3" aria-live="polite">{shown.length} of {cards.length} tests</p>
        </div>
      </div>

      <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <li key={c.n} className="group relative flex">
            <Link href={`/reading-tests/${c.n}`} className="relative flex w-full flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: c.hue }} />
              <span aria-hidden className="pointer-events-none absolute -right-3 -top-5 select-none text-[92px] font-bold leading-none opacity-[0.07]" style={{ color: c.hue }}>{String(c.n).padStart(2, "0")}</span>
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: `${c.hue}1A`, color: c.hue }}>{c.themeName}</span>
                {c.best !== null ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-900">Best {Math.round(c.best)}/100</span>
                  : c.attempts ? <span className="rounded-full bg-cream-3 px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">Attempted</span>
                  : c.free ? <span className="rounded-full bg-orange px-2.5 py-1 text-[11.5px] font-bold text-white">FREE</span>
                  : <span className="rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-white">{c.locked ? "With the plan" : "Included"}</span>}
              </div>
              <h3 className="mt-3 text-[18px] font-semibold leading-snug text-ink">{c.title}</h3>
              <p className="mt-2 text-[13px] text-ink-3">{c.words} words · {c.questions} questions · about {c.minutes} min</p>
              <p className="mt-3 flex flex-wrap gap-1.5" aria-label="Suits these examinations">{c.exams.map((e) => <span key={e} className="rounded-md border border-black/10 bg-cream-2 px-2 py-0.5 text-[11.5px] font-semibold tracking-wide text-ink-2">{e}</span>)}</p>
              <p className="mt-3 text-[12.5px] text-ink-3"><span className="sr-only">Difficulty </span><span aria-label={`Difficulty ${c.difficulty} of 5`}>{"●".repeat(c.difficulty)}<span className="text-ink-5">{"●".repeat(5 - c.difficulty)}</span></span> · trains {c.skills.slice(0, 2).join(", ").toLowerCase()}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-orange-deep">{c.attempts ? "Open results or retake" : c.locked ? "See what is inside" : signedIn ? "Start this test" : "Preview and start"} <span aria-hidden className="transition group-hover:translate-x-1">→</span></span>
            </Link>
          </li>
        ))}
      </ul>
      {!shown.length ? <p className="mt-6 rounded-2xl border border-dashed border-black/20 bg-white p-8 text-center text-[15px] text-ink-3">No test matches these filters. <button type="button" className="font-semibold text-orange-deep underline" onClick={() => { setExam(null); setTheme(null); setFree(false); setQ(""); }}>Clear the filters</button></p> : null}
    </div>
  );
}
