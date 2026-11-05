import { dictionaries } from "../data";
import type { Career } from "../career-stage";
import type { Segmented } from "../segmenter";
import { containsAny, findAll, lines as textLines } from "../text";
import { asciiLower, bin, ltrimBytes, mbLen, nowYear, phpTrim, rtrimChars, rx, sameList } from "../php";
import { rate, type RawScores } from "./types";

/**
 * Section 2, Work Experience (port of Score\ExperienceScorer). Extracts job entries from the experience block and rates
 * presence, progression, timeline, stability and the quality of the bullet descriptions.
 */
const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
const BULLET_TRIM = "-•*◦▪‣· ";

interface Range {
  start: number;
  end: number;
}

export function scoreExperience(seg: Segmented, fullText: string, _career: Career): RawScores {
  const dict = dictionaries();
  let block = seg.sections["experience"] ?? "";
  if (block === "") block = fullText; // no dedicated section: look for date-ranged lines anywhere
  const lines = textLines(block);

  const ranges = dateRanges(block);
  const jobCount = Math.max(ranges.length, titleCompanyLines(lines));
  const hasExp = jobCount > 0 || (seg.sections["experience"] ?? "") !== "";

  const endYears = ranges.map((r) => r.end).filter((y) => y);
  const reverse = isReverse(endYears);
  const hasMonths = new RegExp("\\b(" + MONTHS + ")[a-z]*\\b", "i").test(block);
  const ongoing = /\b(present|current|till date|to date|now)\b/i.test(block);
  const tenure = avgTenure(ranges);
  const shortStints = ranges.filter((r) => r.end - r.start <= 1).length;

  const bullets = bulletLines(lines, dict.bullet_markers);
  const bulletRatio = lines.length === 0 ? 0 : bullets.length / lines.length;
  const descLines = bullets.length ? bullets : lines;
  const actionRatio = actionVerbRatio(descLines, dict.action_verbs_strong);
  const weakCount = findAll(block, dict.weak_openers).length;
  const specific = specificity(descLines);

  const r: RawScores = {};
  r[201] = rate(presenceScore(hasExp, jobCount, bulletRatio, seg), { 0: "No experience shown.", 1: "Experience barely present.", 2: "Roles listed without structure.", 3: "Clear roles with basic structure.", 4: "Dedicated, well-structured section.", 5: "Every role has title, company, dates and bullets." });
  r[202] = rate(titleScore(lines, ranges), { 0: "No job titles.", 1: "Vague titles.", 2: "Generic titles.", 3: "Standard titles.", 4: "Clear, specific titles.", 5: "Titles convey seniority and function." });
  r[203] = rate(companyScore(block), { 0: "No employers named.", 1: "Unclear employers.", 2: "Company names only.", 3: "Companies with some context.", 4: "Companies with location/industry.", 5: "Companies with location, industry and scale." });
  r[204] = rate(progressionScore(lines), { 0: "No progression evident.", 1: "Lateral moves only.", 2: "Slight growth.", 3: "Clear upward steps.", 4: "Strong progression in scope.", 5: "Compelling upward trajectory." });
  r[205] = rate(dateScore(ranges, hasMonths, ongoing), { 0: "No dates.", 1: "Vague years.", 2: "Years only.", 3: "Start-end years.", 4: "Month-year ranges.", 5: "Precise month-year ranges incl. current role." });
  r[206] = rate(reverse, { 0: "Chaotic order.", 1: "Oldest first.", 2: "Mostly reverse with errors.", 3: "Reverse-chronological.", 4: "Reverse with clear separation.", 5: "Flawless reverse-chronology." });
  r[207] = rate(tenureScore(tenure, shortStints, jobCount), { 0: "Constant job-hopping.", 1: "Many short stints.", 2: "Some short stints.", 3: "Reasonable tenure.", 4: "Healthy, stable tenure.", 5: "Strong, purposeful tenure." });
  r[208] = rate(recencyScore(ongoing, endYears), { 0: "No recent role.", 1: "Large recent gap.", 2: "Dated experience.", 3: "Recent role present.", 4: "Current role ongoing.", 5: "Current, relevant role." });
  r[209] = rate(bulletScore(bulletRatio, lines), { 0: "Dense paragraphs.", 1: "Mostly paragraphs.", 2: "Mixed.", 3: "Mostly bullets.", 4: "Clean bullets.", 5: "Tight, scannable bullets." });
  r[210] = rate(actionScore(actionRatio, weakCount), { 0: "Passive / no verbs.", 1: 'Weak openers ("responsible for").', 2: "Occasional action verbs.", 3: "Mostly action verbs.", 4: "Strong action verbs.", 5: "Powerful action verbs lead every bullet." });
  r[211] = rate(specific, { 0: "Vague duties.", 1: "Generic responsibilities.", 2: "Some detail.", 3: "Clear what/how.", 4: "Specific scope and tools.", 5: "Precise scope, tools and context." });
  r[212] = rate(concisenessScore(descLines), { 0: "Verbose or empty.", 1: "Length off.", 2: "Uneven length.", 3: "Reasonable length.", 4: "Concise and focused.", 5: "Crisp, no filler." });
  return r;
}

/** Whether the Experience section applies to this candidate (N/A for early-career people with no experience). */
export function experienceApplicable(seg: Segmented, fullText: string, career: Career): boolean {
  if ((seg.sections["experience"] ?? "") !== "") return true;
  const hasRanges = dateRanges(fullText).length > 0;
  if (!hasRanges && (career.stage === "student" || career.stage === "fresher")) return false;
  return true;
}

// The next two patterns run on the UTF-8 bytes (like PHP without /u), so "–" is the three bytes E2 80 93.
const EN = bin("–");

function dateRanges(block: string): Range[] {
  const re = new RegExp(
    "((?:" + MONTHS + ")[a-z]*\\.?\\s*)?((?:19|20)\\d{2})\\s*[-" + EN + "to]+\\s*((?:present|current|now)|(?:(?:" + MONTHS + ")[a-z]*\\.?\\s*)?(?:19|20)\\d{2})",
    "gi",
  );
  const out: Range[] = [];
  for (const x of bin(block).matchAll(re)) {
    const ym = x[3].match(/(?:19|20)\d{2}/);
    out.push({ start: parseInt(x[2], 10), end: ym ? parseInt(ym[0], 10) : nowYear() });
  }
  return out;
}

const TITLE_COMPANY = new RegExp("^[A-Z][^\\n]{2,60}(,| at | \\| |" + EN + "| - )[A-Z]");
const BULLETISH = new RegExp("^[-" + bin("•") + "*]");

function titleCompanyLines(lines: string[]): number {
  let n = 0;
  for (const l of lines) {
    const b = bin(l);
    if (TITLE_COMPANY.test(b) && !BULLETISH.test(b)) n++;
  }
  return n;
}

function isReverse(ends: number[]): number {
  const e = ends.filter((y) => y);
  if (e.length < 2) return 3;
  const desc = [...e].sort((a, b) => b - a);
  const asc = [...e].sort((a, b) => a - b);
  if (sameList(e, desc)) return 5;
  if (sameList(e, asc)) return 1;
  return 2;
}

function avgTenure(ranges: Range[]): number {
  if (!ranges.length) return 0;
  return ranges.reduce((s, r) => s + Math.max(0, r.end - r.start), 0) / ranges.length;
}

function bulletLines(lines: string[], markers: string[]): string[] {
  const out: string[] = [];
  for (const l of lines) {
    if (markers.some((b) => b !== "" && l.startsWith(b))) out.push(ltrimBytes(l, BULLET_TRIM));
  }
  return out;
}

function firstWord(l: string): string {
  return rtrimChars(asciiLower(phpTrim(phpTrim(l).split(" ")[0] ?? "")), ".,:;");
}

function actionVerbRatio(descLines: string[], verbs: string[]): number {
  if (!descLines.length) return 0;
  return descLines.filter((l) => verbs.includes(firstWord(l))).length / descLines.length;
}

function specificity(descLines: string[]): number {
  if (!descLines.length) return 0;
  const dict = dictionaries();
  const avgLen = descLines.reduce((a, l) => a + mbLen(l), 0) / descLines.length;
  const joined = descLines.join(" ");
  const hasTools = containsAny(joined, [...dict.field_specific_markers, ...dict.leadership_markers]);
  const hasNumbers = /\d/.test(joined);
  if (avgLen < 20) return 1;
  if (hasTools && hasNumbers && avgLen > 40) return 5;
  if (hasTools || hasNumbers) return 4;
  if (avgLen > 35) return 3;
  return 2;
}

function presenceScore(has: boolean, jobs: number, bulletRatio: number, seg: Segmented): number {
  if (!has) return 0;
  const own = (seg.sections["experience"] ?? "") !== "";
  if (own && jobs >= 2 && bulletRatio > 0.3) return 5;
  if (own && jobs >= 1 && bulletRatio > 0) return 4;
  if (jobs >= 1) return 3;
  return 2;
}

function titleScore(lines: string[], ranges: Range[]): number {
  const re = /\b(engineer|manager|analyst|developer|lead|director|executive|consultant|designer|officer|head|founder|intern|specialist|associate|architect|administrator|scientist|accountant|coordinator)\b/i;
  const titled = lines.filter((l) => re.test(l)).length;
  if (titled === 0) return 0;
  if (titled >= Math.max(1, ranges.length)) return 5;
  return titled >= 2 ? 4 : 3;
}

function companyScore(block: string): number {
  const dict = dictionaries();
  const hasName = /\b(Ltd|Limited|Inc|LLC|Pvt|Technologies|Solutions|Group|Systems|Labs|Foundation|University|Bank|Consulting|Services|Corp|Company)\b/.test(block) || rx(String.raw`,\s*[A-Z][a-z]+`).test(block);
  const hasLoc = containsAny(block, dict.international_country_markers) || rx(String.raw`,\s*[A-Z][a-z]+,`).test(block);
  if (!hasName) return /[A-Z][a-z]+/.test(block) ? 2 : 0;
  return hasLoc ? 5 : 4;
}

const SENIORITY: Record<string, number> = { intern: 1, trainee: 1, junior: 1, associate: 2, executive: 2, analyst: 2, engineer: 3, developer: 3, specialist: 3, senior: 4, lead: 5, manager: 5, principal: 6, head: 6, director: 7, vp: 8, chief: 9, founder: 7 };

function progressionScore(lines: string[]): number {
  const seq: number[] = [];
  for (const l of lines) {
    const ll = asciiLower(l);
    let best = 0;
    for (const [k, v] of Object.entries(SENIORITY)) if (ll.includes(k)) best = Math.max(best, v);
    if (best > 0) seq.push(best);
  }
  if (seq.length < 2) return 0; // triggers N/A via na_rule "absent"
  const rise = seq[0] - seq[seq.length - 1]; // resume lists newest first
  if (rise >= 3) return 5;
  if (rise >= 2) return 4;
  if (rise >= 1) return 3;
  return 2;
}

function dateScore(ranges: Range[], months: boolean, ongoing: boolean): number {
  if (!ranges.length) return 0;
  if (months && ongoing) return 5;
  if (months) return 4;
  return 3;
}

function tenureScore(tenure: number, shortStints: number, jobs: number): number {
  if (jobs === 0) return 0;
  if (jobs >= 4 && shortStints >= 3) return 1;
  if (shortStints >= 2) return 2;
  if (tenure >= 3) return 5;
  if (tenure >= 2) return 4;
  return 3;
}

function recencyScore(ongoing: boolean, endYears: number[]): number {
  if (ongoing) return 5;
  if (!endYears.length) return 0;
  const gap = nowYear() - Math.max(...endYears);
  if (gap <= 1) return 4;
  if (gap <= 3) return 3;
  return 2;
}

function bulletScore(ratio: number, lines: string[]): number {
  if (!lines.length) return 0;
  if (ratio > 0.6) return 5;
  if (ratio > 0.4) return 4;
  if (ratio > 0.2) return 3;
  if (ratio > 0) return 2;
  return 1;
}

function actionScore(actionRatio: number, weakCount: number): number {
  if (actionRatio === 0 && weakCount > 0) return 1;
  if (actionRatio >= 0.8) return 5;
  if (actionRatio >= 0.6) return 4;
  if (actionRatio >= 0.35) return 3;
  if (actionRatio > 0) return 2;
  return 0;
}

function concisenessScore(descLines: string[]): number {
  if (!descLines.length) return 0;
  const avg = descLines.reduce((a, l) => a + mbLen(l), 0) / descLines.length;
  if (avg >= 40 && avg <= 160) return 5;
  if (avg >= 25 && avg <= 200) return 4;
  if (avg > 200 || avg < 15) return 1;
  return 3;
}
