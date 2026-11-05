import type { SheetState } from "./sheet/engine";
import type { Deck } from "./slides";
import type { SqlTable } from "./sql/engine";
import type { DaxModel, DaxVisual } from "./dax/engine";
import type { Agg, DateLevel, QuickCalc, Shelf, VizData, VizKind, VizSpec } from "./viz/engine";

/**
 * Reusable learning-activity model. A course lists activities as data (lib/learn/data/<course>.activities.json); the interactive
 * components render them and lib/learn/checks.ts judges them. New courses add JSON, not code, unless they need a new playground.
 */
export type ActivityKind = "word" | "sheet" | "slides" | "classify" | "sql" | "dax" | "viz";
export type Level = "beginner" | "intermediate" | "challenge";

export type CheckSpec =
  // Word
  | { k: "doc.heading"; min: number; level?: 1 | 2 | 3 }
  | { k: "doc.paragraphs"; min: number; minWords?: number }
  | { k: "doc.list"; type?: "ul" | "ol"; minItems: number }
  | { k: "doc.table"; rows: number; cols: number }
  | { k: "doc.format"; what: "bold" | "italic" | "underline" | "center" | "right" | "justify" | "size" }
  | { k: "doc.contains"; text: string }
  | { k: "doc.words"; min?: number; max?: number }
  | { k: "doc.pattern"; re: string; flags?: string; what: string }
  | { k: "doc.order"; texts: string[] }
  // Spreadsheet
  | { k: "sheet.value"; ref: string; equals: string | number }
  | { k: "sheet.formula"; ref: string; fns?: string[]; cover?: string; equals?: number | string; /** A regular expression the typed formula must match (for example, mixed references like $A2), with what to tell the student when it does not. */ pattern?: string; patternMsg?: string }
  | { k: "sheet.filled"; range: string; min?: number }
  | { k: "sheet.result"; ref: string; equals: number | string; tolerance?: number }
  | { k: "sheet.chart"; type?: "bar" | "line" | "pie"; labels?: string; values?: string }
  | { k: "sheet.sorted"; range: string; dir: "asc" | "desc" }
  | { k: "sheet.format"; ref: string; what: "bold" | "currency" | "percent" | "center" | "date" }
  | { k: "sheet.noerrors" }
  // Slides
  | { k: "slides.count"; min: number; max?: number }
  | { k: "slides.titles" }
  | { k: "slides.contains"; text: string }
  | { k: "slides.readable"; maxBullets: number; maxWords: number }
  | { k: "slides.layouts"; min: number }
  | { k: "slides.shapes"; min: number }
  | { k: "slides.theme"; notDefault?: boolean }
  | { k: "slides.title-first"; text?: string }
  // SQL practice: the query must run, must return what the model query returns on the same tables, or must use certain words
  | { k: "sql.runs" }
  | { k: "sql.result"; /** The model query. It runs on the activity's own tables to give the expected result. */ solution: string; /** Rows must also come back in the same order. */ ordered?: boolean }
  | { k: "sql.uses"; re: string; what: string }
  // DAX practice: the measure must run, must give the same matrix as the model measure in every visual, or must use certain words
  | { k: "dax.runs" }
  | { k: "dax.measure"; /** The measure the student must define. */ name: string; /** The model measure (one or more definitions). It runs on the activity's own model to give the expected matrices. */ solution: string }
  | { k: "dax.uses"; re: string; what: string }
  // Viz builder: the view must draw, put fields on shelves, be a kind of chart, show the same marks as the model view, and so on
  | { k: "viz.runs" }
  | { k: "viz.shelf"; shelf: Shelf; field: string; agg?: Agg; date?: DateLevel; quick?: QuickCalc }
  | { k: "viz.kind"; kinds: VizKind[]; what: string }
  | { k: "viz.data"; /** The model view. Its marks are the expected ones. */ solution: VizSpec; /** Calculated fields the model view needs. */ calcs?: Record<string, string>; ordered?: boolean }
  | { k: "viz.sorted"; dir: "asc" | "desc" }
  | { k: "viz.filter"; field: string; values?: string[]; min?: number; max?: number }
  | { k: "viz.top"; n: number }
  | { k: "viz.hasCalc"; name: string }
  | { k: "viz.uses"; re: string; what: string }
  // Classify
  | { k: "classify.item"; item: string };

export interface Check {
  id: string;
  label: string;
  hint: string;
  /** Shown only when the student asks for the explanation. */
  explain: string;
  spec: CheckSpec;
}

export interface ClassifyData { categories: Array<{ id: string; label: string }>; items: Array<{ id: string; text: string; answer: string; why: string }> }

export interface Activity {
  id: string;
  kind: ActivityKind;
  module: string; // module slug, or "capstone"
  title: string;
  level: Level;
  minutes: number;
  xp: number;
  skills: string[];
  objective: string;
  scenario: string;
  steps: string[];
  checks: Check[];
  /** Does passing this activity count toward completing its module (and so the course)? */
  required: boolean;
  /** Starting content: HTML for Word, a SheetState for sheets, a Deck for slides. Absent for classify. */
  initial?: { html?: string; sheet?: SheetState; deck?: Deck };
  classify?: ClassifyData;
  /** SQL only: the tables the student queries and the text that starts in the editor. */
  sql?: { tables: SqlTable[]; starter: string };
  /** DAX only: the model, the starting text, the visuals (matrices) the measure is shown in, and the measure to show. */
  dax?: { model: DaxModel; starter: string; visuals: DaxVisual[]; show: string };
  /** Viz builder only: the data (with any ready-made calculated fields), the view that starts on the canvas, and whether the student may create calculated fields. */
  viz?: { data: VizData; start: VizSpec; allowCalcs: boolean };
  /** Spreadsheet only: the grid area to show and which columns are headers. */
  view?: { cols: number; rows: number };
}

export type ActivityState =
  | { kind: "word"; html: string }
  | { kind: "sheet"; sheet: SheetState }
  | { kind: "slides"; deck: Deck }
  | { kind: "classify"; answers: Record<string, string> }
  | { kind: "sql"; query: string }
  | { kind: "dax"; code: string }
  | { kind: "viz"; spec: VizSpec; calcs: Record<string, string> };

export interface CheckResult { id: string; label: string; passed: boolean; message: string; hint: string; explain: string }
export interface RunResult { results: CheckResult[]; passed: number; total: number; score: number; allPassed: boolean }

export interface Badge { id: string; title: string; description: string; when: { all?: string[]; any?: string[]; module?: string } }
/** Content for the course landing page. Everything on the page comes from here and from the lesson file, so a new course needs no new page code. */
export interface Landing {
  hero: { eyebrow: string; title: string; subtitle: string; level: string; outcomeLine: string };
  outcomes: Array<{ icon: string; title: string; text: string }>;
  projects: Array<{ title: string; text: string; module: string }>;
  tools: Array<{ icon: string; title: string; text: string }>;
  assessment: string[];
  faq: Array<{ q: string; a: string }>;
}
export interface LearnCourse {
  course: string; // lesson-file key
  slug: string; // catalogue slug
  skills: Array<{ id: string; label: string }>;
  badges: Badge[];
  levels: Array<{ min: number; title: string }>;
  activities: Activity[];
  landing?: Landing;
}
