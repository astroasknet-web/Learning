import digitalLiteracy from "./data/digital-literacy.activities.json";
import bbaFinancialAccounting from "./data/bba-financial-accounting.activities.json";
import { NEW_ACTIVITIES } from "./new-activities";
import { cloneSheet, emptySheet } from "./sheet/engine";
import { emptyDeck, sanitizeDeck } from "./slides";
import { sanitizeCalcs, sanitizeSpec } from "./viz/engine";
import { sanitizeDoc } from "./doc";
import type { Activity, ActivityState, Badge, LearnCourse } from "./types";

/**
 * Registry of interactive courses. A course appears here by adding its activities file; the lesson pages, progress tracking, XP and
 * badges all read from this one structure. See COURSE-FRAMEWORK.md for how to add a course.
 */
const COURSES: Record<string, LearnCourse> = {
  "digital-literacy-master": digitalLiteracy as unknown as LearnCourse,
  "bba-financial-accounting": bbaFinancialAccounting as unknown as LearnCourse,
};

const loaded = new Map<string, LearnCourse>();
export const learnCourse = (slug: string): LearnCourse | null => {
  if (Object.prototype.hasOwnProperty.call(COURSES, slug)) return COURSES[slug];
  if (!Object.prototype.hasOwnProperty.call(NEW_ACTIVITIES, slug)) return null;
  let c = loaded.get(slug); // the newer courses are read from disk on first use
  if (!c) { c = NEW_ACTIVITIES[slug]() as LearnCourse; loaded.set(slug, c); }
  return c;
};
export const learnSlugs = (): string[] => [...Object.keys(COURSES), ...Object.keys(NEW_ACTIVITIES)];
export const findActivity = (slug: string, id: string): Activity | null => learnCourse(slug)?.activities.find((a) => a.id === id) ?? null;
export const activitiesFor = (slug: string, module: string): Activity[] => learnCourse(slug)?.activities.filter((a) => a.module === module) ?? [];
export const requiredFor = (slug: string, module: string): Activity[] => activitiesFor(slug, module).filter((a) => a.required);

/** The state an activity starts in (a fresh copy every time). */
export function initialState(a: Activity): ActivityState {
  switch (a.kind) {
    case "word": return { kind: "word", html: a.initial?.html ?? "<p><br></p>" };
    case "sheet": return { kind: "sheet", sheet: a.initial?.sheet ? cloneSheet(a.initial.sheet) : emptySheet() };
    case "slides": return { kind: "slides", deck: sanitizeDeck(a.initial?.deck ?? emptyDeck()) };
    case "classify": return { kind: "classify", answers: {} };
    case "sql": return { kind: "sql", query: a.sql?.starter ?? "" };
    case "dax": return { kind: "dax", code: a.dax?.starter ?? "" };
    case "viz": return { kind: "viz", spec: JSON.parse(JSON.stringify(a.viz?.start ?? { columns: [], rows: [] })), calcs: {} };
  }
}

/** Accept whatever a client sends and return a clean state of the right kind, or null if it is the wrong shape. */
export function cleanState(a: Activity, raw: unknown): ActivityState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== a.kind) return null;
  switch (a.kind) {
    case "word": return typeof o.html === "string" ? { kind: "word", html: sanitizeDoc(o.html) } : null;
    case "slides": return { kind: "slides", deck: sanitizeDeck(o.deck) };
    case "viz": return { kind: "viz", spec: sanitizeSpec(o.spec), calcs: a.viz?.allowCalcs ? sanitizeCalcs(o.calcs) : {} };
    case "dax": return typeof o.code === "string" ? { kind: "dax", code: o.code.slice(0, 6000) } : null;
    case "sql": return typeof o.query === "string" ? { kind: "sql", query: o.query.slice(0, 4000) } : null;
    case "classify": {
      const answers: Record<string, string> = {};
      const ids = new Set(a.classify?.categories.map((c) => c.id));
      const items = new Set(a.classify?.items.map((i) => i.id));
      if (o.answers && typeof o.answers === "object") for (const [k, v] of Object.entries(o.answers as Record<string, unknown>)) if (items.has(k) && typeof v === "string" && ids.has(v)) answers[k] = v;
      return { kind: "classify", answers };
    }
    case "sheet": {
      const s = o.sheet as Record<string, unknown> | undefined;
      if (!s || typeof s !== "object") return null;
      const cells: Record<string, string> = {};
      const formats: Record<string, Record<string, unknown>> = {};
      const ok = /^[A-Z]\d{1,3}$/;
      let n = 0;
      for (const [k, v] of Object.entries((s.cells as Record<string, unknown>) ?? {})) if (ok.test(k) && typeof v === "string" && n++ < 2600) cells[k] = v.slice(0, 500);
      for (const [k, v] of Object.entries((s.formats as Record<string, unknown>) ?? {})) if (ok.test(k) && v && typeof v === "object") {
        const f = v as Record<string, unknown>;
        formats[k] = {
          ...(f.bold === true ? { bold: true } : {}),
          ...(f.align === "left" || f.align === "center" || f.align === "right" ? { align: f.align } : {}),
          ...(["auto", "int", "dec2", "currency", "percent", "date"].includes(f.num as string) ? { num: f.num } : {}),
          ...(typeof f.bg === "string" && /^#[0-9a-fA-F]{6}$/.test(f.bg) ? { bg: f.bg.toLowerCase() } : {}),
        };
      }
      const charts = (Array.isArray(s.charts) ? s.charts : []).slice(0, 5).flatMap((c) => {
        const x = c as Record<string, unknown>;
        return (x.type === "bar" || x.type === "line" || x.type === "pie") && typeof x.labels === "string" && typeof x.values === "string"
          ? [{ type: x.type, labels: x.labels.slice(0, 16).toUpperCase(), values: x.values.slice(0, 16).toUpperCase(), ...(typeof x.title === "string" ? { title: x.title.slice(0, 80) } : {}) }]
          : [];
      });
      const hidden = Array.isArray(s.hidden) ? (s.hidden as unknown[]).filter((x): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < 100).slice(0, 100) : undefined;
      return { kind: "sheet", sheet: { cells, formats, charts: charts as never, hidden } as never };
    }
  }
}

// ---- progress rules: XP, level, badges, skills (all derived from what the student has actually passed) ----------------------

export const xpFor = (course: LearnCourse, passed: Set<string>): number => course.activities.reduce((n, a) => n + (passed.has(a.id) ? a.xp : 0), 0);
export const levelFor = (course: LearnCourse, xp: number): { title: string; next: { title: string; need: number } | null } => {
  const ls = [...course.levels].sort((a, b) => a.min - b.min);
  let cur = ls[0];
  for (const l of ls) if (xp >= l.min) cur = l;
  const next = ls.find((l) => l.min > xp);
  return { title: cur.title, next: next ? { title: next.title, need: next.min - xp } : null };
};
export const badgeEarned = (b: Badge, passed: Set<string>): boolean => (b.when.all ? b.when.all.every((id) => passed.has(id)) : true) && (b.when.any ? b.when.any.some((id) => passed.has(id)) : true);
export function skillProgress(course: LearnCourse, passed: Set<string>): Array<{ id: string; label: string; done: number; total: number }> {
  return course.skills.map((s) => {
    const list = course.activities.filter((a) => a.skills.includes(s.id));
    return { id: s.id, label: s.label, done: list.filter((a) => passed.has(a.id)).length, total: list.length };
  });
}
