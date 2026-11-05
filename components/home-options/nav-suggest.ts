/**
 * Search suggestions for the header. Pure matching (tested) plus one hook that adds live course matches from the catalogue.
 * Pages are matched on their label, description, menu and a few plain-language keywords people actually type ("cv", "visa", "mentor"); every
 * result is a page or course that exists. Related terms are words taken from those same labels and keywords, never invented.
 */
import { useEffect, useRef, useState } from "react";
import { INDEX, type Hit } from "./nav-data";

/** Extra words people use for a page, keyed by its href. Only pages that exist in the menus are listed (a test checks this). */
export const KEYWORDS: Record<string, string> = {
  "/courses": "course learn class training certificate skill programme",
  "/resume-score": "cv resume score ats check grade free",
  "/studio": "cv resume builder template",
  "/passport": "credential certificate verify proof qr badge",
  "/internships": "job jobs intern work career employer hiring apply",
  "/applications": "applied status tracker",
  "/ielts": "english band test speaking listening reading writing",
  "/practice-tests": "mock test exam gre ielts practice",
  "/exam-prep": "exam jee neet upsc ssc cat sat gre coaching",
  "/writing-clinic": "essay writing english sat gre gmat",
  "/math-speed": "maths math calculation speed aptitude",
  "/vedic-math": "vedic maths mental shortcuts",
  "/study-abroad": "abroad overseas university universities masters degree college",
  "/abroad": "application plan shortlist",
  "/overseas-packages": "package packages counselling counsellor consultant consultancy admission help price fee shortlist visa settle",
  "/abroad/matches": "university match safe target reach",
  "/abroad/funds": "scholarship fund funding cost fees",
  "/abroad/loans": "loan finance education loan",
  "/abroad/visa": "visa immigration permit",
  "/abroad/documents": "documents sop lor checklist transcripts",
  "/abroad/interview": "visa interview practice",
  "/ai-interviewer": "interview mock practice questions",
  "/ai-resume-expert": "resume review feedback",
  "/experts": "mentor counselling counseling counsellor session coach",
  "/agents": "ai agent assistant",
  "/pricing": "price cost plan plans subscription pro silver gold free upgrade",
  "/school": "class school board cbse icse",
  "/olympiad/imo": "olympiad imo maths",
  "/blog": "article guide read",
  "/events": "workshop webinar",
  "/support": "help ticket problem issue",
  "/contact": "email phone reach",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9₹+# ]+/g, " ").replace(/\s+/g, " ").trim();
const hay = (h: Hit) => norm(`${h.label} ${h.sub} ${h.group} ${KEYWORDS[h.href] ?? ""}`);

/** Pages whose text contains every word typed (a word may be the start of a word). Label matches rank above description or keyword matches. */
export function matchPages(q: string, limit = 6, index: Hit[] = INDEX): Hit[] {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return [];
  const scored: Array<[number, Hit]> = [];
  for (const h of index) {
    const text = hay(h);
    const tokens = text.split(" ");
    if (!words.every((w) => tokens.some((t) => t.startsWith(w)) || (w.length > 2 && text.includes(w)))) continue;
    const label = norm(h.label);
    const rank = label === norm(q) ? 0 : label.startsWith(norm(q)) ? 1 : words.every((w) => label.split(" ").some((t) => t.startsWith(w))) ? 2 : 3;
    scored.push([rank, h]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map((x) => x[1]);
}

const STOP = new Set(["and", "the", "for", "with", "your", "from", "all", "our", "you", "are", "one", "how", "any", "free", "more", "get", "can"]);
const VOCAB: string[] = (() => {
  const c = new Map<string, number>();
  for (const h of INDEX) for (const w of norm(`${h.label} ${KEYWORDS[h.href] ?? ""}`).split(" ")) if (w.length >= 3 && !STOP.has(w) && !/^\d/.test(w)) c.set(w, (c.get(w) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);
})();

/** Words from our own pages that continue what is being typed: "int" gives internships, interview and so on. Only the last word is completed. */
export function relatedTerms(q: string, limit = 4): string[] {
  const parts = norm(q).split(" ");
  const last = parts.pop() ?? "";
  if (last.length < 2) return [];
  const head = parts.join(" ");
  const found = VOCAB.filter((w) => w.startsWith(last) && w !== last);
  return found.filter((w) => !(w.endsWith("s") && found.includes(w.slice(0, -1)))).slice(0, limit).map((w) => (head ? `${head} ${w}` : w));
}

export interface CourseHit { slug: string; title: string; cat_name: string }

/** Live course matches for what is typed, debounced, from the same catalogue search the courses page uses. */
export function useCourseHits(q: string, active: boolean): { courses: CourseHit[]; busy: boolean } {
  const [courses, setCourses] = useState<CourseHit[]>([]);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const phrase = q.trim();
    if (!active || phrase.length < 2) { setCourses([]); setBusy(false); return; }
    const mine = ++seq.current;
    const ctl = new AbortController();
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/courses/suggest?q=${encodeURIComponent(phrase)}`, { signal: ctl.signal });
        const j = (await r.json()) as CourseHit[];
        if (mine === seq.current) setCourses(Array.isArray(j) ? j.slice(0, 5) : []);
      } catch { /* aborted or offline */ }
      if (mine === seq.current) setBusy(false);
    }, 160);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, active]);
  return { courses, busy };
}

export const POPULAR = ["Courses", "All courses", "QR Score", "Internships", "Find universities", "Practice tests", "Pricing"];
export const popularHits = (): Hit[] => INDEX.filter((h) => POPULAR.includes(h.label));
