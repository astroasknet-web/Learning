import { dictionaries, type Dictionaries } from "./data";
import { educationBlock, type Segmented } from "./segmenter";
import { containsAny, findAll, lines as textLines, years as yearsIn } from "./text";
import { escapeRe, mbLen, phpTrim, rx } from "./php";

/**
 * Deterministic feature extractor for the Education section (port of Extract\EducationParser).
 * Produces structured signals that EducationScorer maps onto the 0-5 rubric. Dictionary + regex only, no AI.
 */
const LEVEL_RANK: Record<string, number> = { highschool: 1, diploma: 2, associate: 3, bachelor: 4, master: 5, phd: 6 };
const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

export interface EduEntry {
  raw: string;
  degreeType: string | null;
  levelRank: number;
  degreeFull: boolean;
  abbrevOnly: boolean;
  informal: boolean;
  classification: boolean;
  fieldSpecific: boolean;
  broadOnly: boolean;
  minor: boolean;
  institution: boolean;
  institutionVague: boolean;
  institutionLocation: boolean;
  years: number[];
  startYear: number | null;
  endYear: number | null;
  hasStartEnd: boolean;
  hasMonths: boolean;
  ongoing: boolean;
  expected: boolean;
  gpa: number | null;
  gpaHasScale: boolean;
  rankPercentile: boolean;
}

export interface EduFeatures {
  educationBlock: string;
  educationIsOwnSection: boolean;
  hasEducationSection: boolean;
  entries: EduEntry[];
  entryCount: number;
  highestFirst: boolean;
  reverseChrono: { score: number; ordered: boolean; hasErrors: boolean };
  consistency: { score: number; uniformFields: boolean };
  presentation: { score: number; bullets: boolean; ownSection: boolean };
  dates: { anyDate: boolean; anyMonths: boolean; allStartEnd: boolean; anyYearOnly: boolean; expectedGraduation: boolean; ongoing: boolean };
  academic: { hasGpa: boolean; gpaHasScale: boolean; rankPercentile: boolean };
  honors: { found: boolean; count: number; hasSelectivity: boolean; hasScholarship: boolean; hasDatedContext: boolean };
  coursework: { found: boolean; count: number; dataDump: boolean; contextualized: boolean; projectMapped: boolean };
  thesis: { found: boolean; hasAdvisor?: boolean; hasMethodOrFindings?: boolean; hasPublicationOrFunding?: boolean; detailCount?: number };
  professional: { found: boolean; count?: number; acronymOnly?: boolean; hasIssuingBody?: boolean; hasDates?: boolean; hasLicense?: boolean };
  vocational: { found: boolean; hasInstitutionDate?: boolean; hasHours?: boolean };
  international: { found: boolean; credentialEval?: boolean; translated?: boolean; equivalencyLoose?: boolean; gradingScale?: boolean };
}

type Dict = Dictionaries;
const asLists = (o: unknown) => o as Record<string, string[]>;

export function parseEducation(seg: Segmented, fullText: string): EduFeatures {
  const dict = dictionaries();
  const eduBlock = educationBlock(seg, fullText);
  const eduIsOwnSection = (seg.sections["education"] ?? "") !== "";
  const certBlock = seg.sections["certifications"] ?? "";
  const entries = extractEntries(eduBlock, dict);

  return {
    educationBlock: eduBlock,
    educationIsOwnSection: eduIsOwnSection,
    hasEducationSection: eduBlock !== "" && entries.length > 0,
    entries,
    entryCount: entries.length,
    highestFirst: highestFirst(entries),
    reverseChrono: reverseChronology(entries),
    consistency: consistency(entries),
    presentation: presentation(eduBlock, eduIsOwnSection, dict),
    dates: dateProfile(entries),
    academic: academicProfile(entries),
    honors: honorsProfile(eduBlock, dict),
    coursework: courseworkProfile(eduBlock, dict),
    thesis: thesisProfile(fullText, dict),
    professional: professionalProfile(eduBlock + "\n" + certBlock, dict),
    vocational: vocationalProfile(eduBlock + "\n" + certBlock, dict),
    international: internationalProfile(eduBlock, dict),
  };
}

function extractEntries(block: string, dict: Dict): EduEntry[] {
  const lines = textLines(block);
  if (!lines.length) return [];
  const idx: number[] = [];
  lines.forEach((line, i) => {
    if (detectDegreeType(line, dict) !== null || isInformalDegree(line, dict)) idx.push(i);
  });
  if (!idx.length) return [buildEntry(block, dict)];

  const entries: EduEntry[] = [];
  for (let k = 0; k < idx.length; k++) {
    const start = idx[k];
    const end = k + 1 < idx.length ? idx[k + 1] : lines.length;
    entries.push(buildEntry(lines.slice(start, start + Math.max(1, end - start)).join("\n"), dict));
  }
  return entries;
}

function buildEntry(window: string, dict: Dict): EduEntry {
  const type = detectDegreeType(window, dict);
  let fullMatched = false;
  let abbrevMatched = false;
  if (type !== null) {
    fullMatched = containsAny(window, asLists(dict.degree_full_names)[type] ?? []);
    abbrevMatched = matchesAbbrev(window, asLists(dict.degree_abbreviations)[type] ?? []);
  }
  const informal = isInformalDegree(window, dict) && type === null;

  const years = yearsIn(window);
  const hasMonths = new RegExp("\\b(" + MONTHS + ")\\b", "i").test(window);
  const ongoing = containsAny(window, dict.student_markers) || /\bpresent\b/i.test(window);
  const expected = /\bexpected\b/i.test(window);

  const fieldSpecific = containsAny(window, dict.field_specific_markers);
  const broadOnly = !fieldSpecific && containsAny(window, dict.broad_fields);
  const minor = containsAny(window, dict.minor_markers);

  const institution = containsAny(window, dict.institution_markers);
  const institutionVague = containsAny(window, dict.vague_institution_terms);
  const institutionLocation = hasLocation(window, dict);

  const [gpa, gpaHasScale] = detectGpa(window, dict);
  const rankPercentile = containsAny(window, dict.rank_percentile_markers);
  const classification = containsAny(window, dict.degree_classifications);

  return {
    raw: window,
    degreeType: type,
    levelRank: type !== null ? LEVEL_RANK[type] ?? 0 : 0,
    degreeFull: fullMatched,
    abbrevOnly: abbrevMatched && !fullMatched,
    informal,
    classification,
    fieldSpecific,
    broadOnly,
    minor,
    institution,
    institutionVague,
    institutionLocation,
    years,
    startYear: years[0] ?? null,
    endYear: !ongoing && years.length >= 2 ? years[years.length - 1] : years[0] ?? null,
    hasStartEnd: years.length >= 2 || (ongoing && years.length >= 1),
    hasMonths,
    ongoing,
    expected,
    gpa,
    gpaHasScale,
    rankPercentile,
  };
}

function detectDegreeType(s: string, dict: Dict): string | null {
  for (const type of ["phd", "master", "bachelor", "associate", "diploma", "highschool"]) {
    if (containsAny(s, asLists(dict.degree_full_names)[type] ?? [])) return type;
  }
  for (const type of ["phd", "master", "bachelor", "associate", "diploma"]) {
    if (matchesAbbrev(s, asLists(dict.degree_abbreviations)[type] ?? [])) return type;
  }
  return null;
}

function matchesAbbrev(s: string, abbrevs: string[]): boolean {
  return abbrevs.some((ab) => new RegExp("\\b" + escapeRe(ab) + "\\b", "i").test(s));
}

function isInformalDegree(s: string, dict: Dict): boolean {
  return containsAny(s, dict.informal_degree_terms);
}

function hasLocation(s: string, dict: Dict): boolean {
  if (containsAny(s, dict.international_country_markers)) return true;
  return rx(String.raw`,\s*[A-Z][a-zA-Z]+`).test(s); // "Institution, City"
}

function detectGpa(s: string, dict: Dict): [number | null, boolean] {
  const g = dict.gpa_patterns;
  let m = s.match(rx(g.with_scale));
  if (m) return [parseFloat(m[1]), true];
  if (containsAny(s, g.cgpa_label)) {
    m = s.match(/(\d\.\d{1,2})/);
    if (m) return [parseFloat(m[1]), false];
  }
  m = s.match(rx(g.percentage));
  if (m) return [parseFloat(m[1]), true]; // a percentage carries its own scale
  return [null, false];
}

function highestFirst(entries: EduEntry[]): boolean {
  if (entries.length < 2) return true;
  const ranks = entries.map((e) => e.levelRank);
  return (ranks[0] ?? 0) === Math.max(...ranks);
}

function reverseChronology(entries: EduEntry[]) {
  const ends = entries.filter((e) => e.endYear !== null).map((e) => e.endYear as number);
  if (ends.length < 2) return { score: 3, ordered: true, hasErrors: false };
  const desc = [...ends].sort((a, b) => b - a);
  const asc = [...ends].sort((a, b) => a - b);
  if (ends.every((v, i) => v === desc[i])) return { score: 5, ordered: true, hasErrors: false };
  if (ends.every((v, i) => v === asc[i])) return { score: 1, ordered: false, hasErrors: false };
  return { score: 2, ordered: false, hasErrors: true };
}

function consistency(entries: EduEntry[]) {
  if (entries.length <= 1) return { score: 4, uniformFields: true };
  const sigs = entries.map((e) => (e.degreeType !== null ? "D" : "-") + (e.institution ? "I" : "-") + (e.endYear !== null ? "Y" : "-"));
  const uniform = new Set(sigs).size === 1;
  const allComplete = entries.every((e) => e.degreeType !== null && e.institution && e.endYear !== null);
  const conflict = entries.some((e) => e.startYear !== null && e.endYear !== null && e.startYear > e.endYear);
  if (conflict) return { score: 1, uniformFields: false };
  if (uniform && allComplete) return { score: 5, uniformFields: true };
  if (uniform) return { score: 4, uniformFields: true };
  return { score: 2, uniformFields: false };
}

function presentation(block: string, ownSection: boolean, dict: Dict) {
  if (phpTrim(block) === "") return { score: 0, bullets: false, ownSection: false };
  const lines = textLines(block);
  const bulletLines = lines.filter((line) => dict.bullet_markers.some((b) => line.startsWith(b))).length;
  const bullets = bulletLines > 0;
  const multiLine = lines.length >= 2;
  const avgLen = lines.reduce((a, l) => a + mbLen(l), 0) / Math.max(1, lines.length);
  const blockText = avgLen > 160;

  let score = 3;
  if (blockText) score = 1;
  else if (ownSection && bullets && multiLine) score = 4;
  else if (ownSection && multiLine) score = 3;
  else if (!multiLine) score = 2;
  if (ownSection && bullets && multiLine && !blockText && lines.length >= 3) score = 5;
  return { score, bullets, ownSection };
}

function dateProfile(entries: EduEntry[]) {
  let anyDate = false, anyMonths = false, anyYearOnly = false, anyExpected = false, anyOngoing = false;
  let allStartEnd = entries.length > 0;
  for (const e of entries) {
    if (e.years.length) anyDate = true;
    if (e.hasMonths) anyMonths = true;
    if (!e.hasStartEnd) {
      allStartEnd = false;
      if (e.years.length) anyYearOnly = true;
    }
    if (e.expected) anyExpected = true;
    if (e.ongoing) anyOngoing = true;
  }
  return { anyDate, anyMonths, allStartEnd: allStartEnd && anyDate, anyYearOnly, expectedGraduation: anyExpected, ongoing: anyOngoing };
}

function academicProfile(entries: EduEntry[]) {
  let best: number | null = null;
  let hasScale = false;
  let rank = false;
  for (const e of entries) {
    if (e.gpa !== null) {
      best = e.gpa;
      hasScale = hasScale || e.gpaHasScale;
    }
    if (e.rankPercentile) rank = true;
  }
  return { hasGpa: best !== null, gpaHasScale: hasScale, rankPercentile: rank };
}

function honorsProfile(block: string, dict: Dict) {
  const hits = findAll(block, dict.honor_markers);
  return {
    found: hits.length > 0,
    count: hits.length,
    hasSelectivity: containsAny(block, dict.selectivity_markers),
    hasScholarship: containsAny(block, ["scholarship", "fellowship", "medal"]),
    hasDatedContext: /(19|20)\d{2}/.test(block) && hits.length > 0,
  };
}

function courseworkProfile(block: string, dict: Dict) {
  if (!containsAny(block, dict.coursework_markers)) return { found: false, count: 0, dataDump: false, contextualized: false, projectMapped: false };
  let count = 0;
  for (const line of textLines(block)) {
    if (containsAny(line, dict.coursework_markers)) count = Math.max(count, (line.split(",").length - 1) + 1);
  }
  const projectMapped = containsAny(block, ["project", "applied", "built", "implemented"]);
  const contextualized = containsAny(block, ["skills", "learned", "covered", "focused on"]);
  const dataDump = count > 10 && !contextualized && !projectMapped;
  return { found: true, count, dataDump, contextualized, projectMapped };
}

function thesisProfile(text: string, dict: Dict) {
  if (!containsAny(text, dict.thesis_markers)) return { found: false };
  return {
    found: true,
    hasAdvisor: containsAny(text, ["advisor", "supervisor", "committee"]),
    hasMethodOrFindings: containsAny(text, ["methodology", "findings", "results", "hypothesis"]),
    hasPublicationOrFunding: containsAny(text, ["published", "publication", "grant", "funded"]),
    detailCount: findAll(text, dict.thesis_detail_markers).length,
  };
}

function professionalProfile(text: string, dict: Dict) {
  const bodies = findAll(text, dict.professional_qual_bodies);
  if (!bodies.length) return { found: false };
  const hasDates = /(19|20)\d{2}/.test(text);
  const hasLicense = containsAny(text, dict.license_markers);
  const hasIssuingBody = containsAny(text, ["institute of", "board of", "issued by", "certified by", "aws", "microsoft", "cisco", "pmi", "icai", "icsi", "acca"]);
  return { found: true, count: bodies.length, acronymOnly: !hasIssuingBody && !hasDates, hasIssuingBody, hasDates, hasLicense };
}

function vocationalProfile(text: string, dict: Dict) {
  if (!containsAny(text, dict.vocational_markers)) return { found: false };
  return { found: true, hasInstitutionDate: /(19|20)\d{2}/.test(text), hasHours: containsAny(text, dict.vocational_detail_markers) };
}

function internationalProfile(block: string, dict: Dict) {
  if (!containsAny(block, dict.international_country_markers)) return { found: false };
  return {
    found: true,
    credentialEval: containsAny(block, dict.credential_evaluation_markers),
    translated: containsAny(block, dict.translation_markers),
    equivalencyLoose: containsAny(block, ["equivalent", "equivalency"]),
    gradingScale: rx(String.raw`\/\s*\d(?:\.\d)?`).test(block) || containsAny(block, ["gpa", "first class", "grade"]),
  };
}
