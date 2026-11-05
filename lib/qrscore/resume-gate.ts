import gate from "./data/gate.json";
import { bin, phpRound, phpTrim, mbLen } from "./php";

/**
 * Decides, before any scoring, whether a document is a resume / CV (port of Extract\ResumeGate).
 *
 * Deterministic and explainable (no AI): it adds up evidence a resume has (section headings, contact details, education and
 * job vocabulary, date ranges, bullet structure) and subtracts evidence for other document types (cover letters, invoices,
 * papers, contracts, exam papers, ...). It returns a verdict plus the reasons, so the user is told why a file was refused.
 *
 * Design rule kept from the PHP engine: a real resume must never be refused for lacking one signal, so the verdict needs a
 * combination of independent signals, and a recognised other-document type only refuses a file when resume evidence is weak.
 *
 * Regex notes: the PHP patterns used PCRE's UCP mode (/u) in some places and plain byte mode in others. /u patterns are run
 * through ucp() (Unicode-aware \b \w \d); the others run on bin(text) (byte string, ASCII classes) so results are identical.
 */
export const ACCEPT_AT = gate.accept_at;
export const MIN_WORDS = gate.min_words;

export interface GateResult {
  is_resume: boolean;
  score: number;
  label: string;
  reason: string;
  reasons: string[];
  found: string[];
  other_type: string | null;
  words: number;
  signals: Record<string, number>;
  metrics: Record<string, number>;
}

export interface Extraction {
  text: string;
  layout_text?: string | null;
  source: string;
  method: string;
  confidence: string;
  note?: string | null;
}

const WORD = "[\\p{L}\\p{N}_]";
/** Make a PCRE pattern behave under UCP (/u): Unicode word boundaries, \w and \d. */
function ucp(p: string): string {
  return p
    .replace(/\\b/g, "(?:(?<=" + WORD + ")(?!" + WORD + ")|(?<!" + WORD + ")(?=" + WORD + "))")
    .replace(/\\w/g, WORD)
    .replace(/\\d/g, "\\p{Nd}");
}

export function assessExtraction(extraction: Extraction): GateResult {
  const g = assess(extraction.text);
  const alt = extraction.layout_text ?? "";
  if (!g.is_resume && alt !== "" && alt !== extraction.text) {
    const g2 = assess(alt);
    if (g2.is_resume || g2.score > g.score) return g2;
  }
  return g;
}

const count = (re: RegExp, s: string): number => (s.match(re) ?? []).length;

export function assess(rawText: string): GateResult {
  const text = phpTrim(rawText);
  const btext = bin(text); // PHP non-/u regexes see bytes
  const words = count(/[\p{L}\p{N}][\p{L}\p{N}'’.+#&/-]*/gu, text);
  if (words < MIN_WORDS) {
    return result(false, 0, "unreadable", "We could not read enough text from this file.", ["The file has almost no readable text. It may be a scanned or image-only PDF."], [], null, words, {});
  }

  const low = text.toLowerCase();
  const lines = text.split("\n").map(phpTrim).filter((l) => l !== "");
  const nLines = Math.max(1, lines.length);
  const found: string[] = [];
  const sig: Record<string, number> = {};

  // ---- A. section headings (short standalone lines) ----
  const fam = new Set<string>();
  const HEADING_SMALL = gate.heading_small;
  for (const l of lines) {
    if (mbLen(l) > 48 || /\d/.test(l)) continue;
    const clean = phpTrim(l.replace(/[^\p{L}&/ ]+/gu, " ").replace(/\s+/g, " "));
    const tokens = clean === "" ? [] : clean.split(" ");
    if (!tokens.length || tokens.length > 5) continue;
    let titleStyle = true;
    for (const tk of tokens) {
      if (!(/^\p{Lu}/u.test(tk) || HEADING_SMALL.includes(tk.toLowerCase()))) {
        titleStyle = false;
        break;
      }
    }
    if (!titleStyle) continue;
    const lc = clean.toLowerCase();
    for (const [name, re] of Object.entries(gate.headings)) {
      if (new RegExp("^(?:[a-z]+ ){0,2}(?:" + ucp(re) + ")(?: (?:and|&) [a-z]+| details| information| summary| history| section)?$", "u").test(lc)) fam.add(name);
    }
  }
  const labelled: Record<string, string> = {
    skills: "skills?|key skills|technical skills",
    education: "education|qualifications?",
    experience: "experience|work experience|employment",
    projects: "projects?",
    summary: "objective|summary|profile|career objective",
    certs: "certifications?|courses",
    awards: "achievements?|awards",
  };
  for (const [name, re] of Object.entries(labelled)) {
    if (new RegExp("^\\s*(?:" + re + ")\\s*[:\\-\\u2013]\\s*\\S", "imu").test(text)) fam.add(name);
  }
  const core = ["experience", "education", "skills", "projects"].filter((k) => fam.has(k)).length;
  // 'Contact', 'Languages', 'Activities' alone also head forms and lists, so they only count next to a real resume section.
  const famCount = core >= 1 ? fam.size : Array.from(fam).filter((k) => k !== "personal" && k !== "activities").length;
  sig.headings = Math.min(40, famCount * 9) + (core >= 1 ? 6 : 0);
  if (famCount > 0) found.push("Resume sections: " + Array.from(fam).join(", "));

  // ---- B. contact details ----
  const email = /[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_-]+\.[\p{L}\p{N}_.-]+/u.test(text);
  const phone =
    /(?<!\d)(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}(?!\d)/.test(btext) &&
    /\d{10}|\d{3}[\s-]\d{3}[\s-]\d{4}|\+\d{2}[\s-]?\d{5}/.test(btext.replace(/(?<=\d)[\s-](?=\d)/g, "") + "\n" + btext);
  const link = /linkedin\.com|github\.com|gitlab\.com|behance\.net|portfolio|kaggle\.com|leetcode|medium\.com\/@/i.test(btext);
  sig.contact = Math.min(22, (email ? 12 : 0) + (phone ? 8 : 0) + (link ? 6 : 0));
  if (email || phone || link) found.push("Contact details" + (link ? " and profile links" : ""));

  // ---- C. resume vocabulary ----
  const hit = (list: string[]): number => {
    let n = 0;
    for (const re of list) if (new RegExp("(?<![\\p{L}\\p{N}])(?:" + ucp(re) + ")", "u").test(low)) n++;
    return n;
  };
  const edu = hit(gate.edu);
  const job = hit(gate.job);
  const verbs = hit(gate.verbs);
  const skills = hit(gate.skills);
  const dates = count(new RegExp(ucp("(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?,?\\s+)?(?:19|20)\\d{2}\\s*(?:-|–|—|to|until|till)\\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?,?\\s+)?(?:(?:19|20)\\d{2}|\\d{2}\\b|present|current|till date|to date|ongoing|now)"), "giu"), text);
  const years = count(/\b(?:19|20)\d{2}\b/g, btext);
  sig.education = edu >= 6 ? 14 : edu >= 3 ? 10 : edu >= 1 ? 4 : 0;
  sig.jobs = job >= 5 ? 12 : job >= 3 ? 8 : job >= 1 ? 3 : 0;
  sig.verbs = verbs >= 6 ? 12 : verbs >= 3 ? 8 : verbs >= 1 ? 3 : 0;
  sig.skills = skills >= 6 ? 10 : skills >= 3 ? 6 : skills >= 1 ? 2 : 0;
  sig.dates = dates >= 3 ? 12 : dates >= 1 ? 8 : years >= 3 ? 4 : 0;
  if (edu >= 3) found.push("Education terms");
  if (job >= 3) found.push("Job titles / employers");
  if (verbs >= 3) found.push("Achievement verbs");
  if (dates >= 1) found.push("Date ranges");

  // ---- D. layout: short lines / bullets, not paragraphs ----
  let bullets = 0;
  let short = 0;
  let flow = "";
  for (const l of lines) {
    const wc = count(/\S+/gu, l);
    const isBullet = /^[•◦▪‣·●–—\-*►▪➢✓●]\s*\S/u.test(l);
    if (isBullet) bullets++;
    if (wc <= 12) short++;
    // A line that starts in lower case continues the previous one (wrapped prose); anything else starts a new unit.
    const continues = !isBullet && flow !== "" && /^\p{Ll}/u.test(l);
    flow += (continues ? " " : " . ") + l;
  }
  const avgWords = words / nLines;
  sig.layout = (bullets / nLines >= 0.08 ? 6 : 0) + (short / nLines >= 0.6 ? 4 : 0) + (avgWords <= 14 ? 3 : 0);
  let longWords = 0;
  for (const sentence of flow.split(/(?<=[.!?])\s+/u).filter((s) => s !== "")) {
    const n = count(/\S+/gu, sentence);
    if (n >= 20 && (sentence.split(",").length - 1) / n < 0.2) longWords += n; // comma-heavy runs are lists (skills, coursework), not prose
  }
  const proseShare = longWords / Math.max(1, words);
  const wellStructured = famCount >= 4 || (famCount >= 3 && (dates >= 1 || years >= 2));
  sig.prose = wellStructured ? 0 : proseShare >= 0.5 ? -24 : proseShare >= 0.35 ? -12 : 0;

  // ---- E. length ----
  sig.length = words < 60 ? -10 : words > 9000 ? -45 : words > 5000 ? -35 : words > 3500 ? -20 : words > 2600 ? -8 : 0;

  // ---- F. other document types ----
  let otherType: string | null = null;
  let otherHits = 0;
  for (const o of gate.other) {
    let n = 0;
    for (const re of o.patterns) {
      if (o.label === "source code or data file") {
        n += count(new RegExp(re, "gmi"), btext) > 2 ? 1 : 0;
      } else if (new RegExp(ucp(re), "imu").test(text)) {
        n++;
      }
    }
    if (n >= o.need && n > otherHits) {
      otherType = o.label;
      otherHits = n;
    }
  }
  const citations = count(/\([A-Z][A-Za-z-]+(?: et al\.| and [A-Z][a-z]+| & [A-Z][a-z]+)?,? (?:19|20)\d{2}[a-z]?\)/gu, text);
  const paperWords = count(new RegExp(ucp("^\\s*(?:abstract|introduction|methodology|methods|conclusions?|results|discussion)\\b"), "gimu"), text);
  if (citations >= 4 && paperWords >= 2 && otherType === null) {
    otherType = "research paper or article";
    otherHits = 3;
  }
  sig.other_type = otherType !== null ? -Math.min(40, 18 + 5 * otherHits) : 0;

  // First-person narrative (essays, statements of purpose) is rarely a resume.
  const firstPerson = count(new RegExp(ucp("\\b(?:i|my|me|myself)\\b"), "giu"), text);
  sig.narrative = words > 150 && firstPerson / words > 0.035 && proseShare >= 0.2 ? -14 : 0;

  // Gibberish / non-linguistic: very low share of letters.
  const letters = count(/\p{L}/gu, text);
  const textLen = mbLen(text);
  sig.letters = textLen > 0 && letters / textLen < 0.5 ? -20 : 0;

  // Numeric tables and spreadsheets: far more digits than a resume ever has.
  const digits = count(/\d/g, text);
  sig.numeric = letters + digits > 0 && digits / (letters + digits) > 0.2 ? -25 : 0;
  if (sig.numeric < 0 && otherType === null) {
    otherType = "data table or spreadsheet";
    sig.other_type = -23;
  }

  const score = Math.max(0, Math.min(100, Object.values(sig).reduce((a, b) => a + b, 0)));

  // ---- verdict: score AND independent evidence ----
  const nFam = famCount;
  const hasTime = dates >= 1 || years >= 2;
  const hasContact = sig.contact > 0;
  const structured =
    nFam >= 3 ||
    (nFam >= 2 && ((hasTime && hasContact) || ((hasTime || hasContact) && (job >= 2 || verbs >= 2)))) ||
    (nFam >= 1 && hasContact && edu >= 3 && hasTime && (job >= 2 || verbs >= 2)) ||
    (nFam === 0 && hasContact && edu >= 4 && job >= 3 && dates >= 2 && proseShare < 0.3 && verbs >= 3);
  let isResume = score >= ACCEPT_AT && structured && (proseShare < 0.5 || wellStructured);
  // A very short but genuine resume has too little text to score high; accept it when it carries education terms and skills with a resume label.
  if (!isResume && otherType === null && words <= 150 && nFam >= 1 && edu >= 2 && skills >= 1 && proseShare < 0.5 && sig.letters === 0) isResume = true;

  // A recognised other document type refuses the file unless resume evidence is overwhelming.
  const overridable = ["cover letter", "offer, experience or recommendation letter", "job description", "course outline or syllabus"].includes(otherType ?? "");
  const fixedType = ["placeholder or sample text", "source code or data file", "data table or spreadsheet", "question paper or worksheet"].includes(otherType ?? "");
  const overwhelming = nFam >= 4 && dates >= 2 && edu >= 3 && job >= 3 && verbs >= 2;
  if (otherType !== null && !((overridable && nFam >= 3 && (dates >= 1 || years >= 3) && edu >= 2 && (job >= 3 || (job >= 2 && verbs >= 4))) || (!fixedType && overwhelming))) isResume = false;

  const metrics = { headings: nFam, dates, years, prose: phpRound(proseShare, 2), edu, jobs: job, verbs, skills };

  const reasons: string[] = [];
  if (!isResume) {
    if (otherType !== null) reasons.push("This looks like " + withArticle(otherType) + ", not a resume.");
    if (famCount === 0) reasons.push("No resume sections found (such as Education, Experience, Skills or Projects).");
    else if (famCount < 2) reasons.push("Only one resume section found. A resume normally has several.");
    if (sig.contact === 0) reasons.push("No email address, phone number or profile link found.");
    if (edu === 0 && job === 0) reasons.push("No education or work history found.");
    if (sig.prose < 0) reasons.push("The text is mostly long paragraphs; a resume uses short lines and bullet points.");
    if (sig.length < -20) reasons.push("The document is far longer than a resume.");
    if (!reasons.length) reasons.push("We could not find enough of the usual resume content.");
  }

  return result(
    isResume,
    score,
    isResume ? "resume" : otherType !== null ? "other" : "not_resume",
    isResume ? "This looks like a resume." : otherType !== null ? "This looks like " + withArticle(otherType) + ", not a resume." : "This does not look like a resume.",
    reasons,
    found,
    otherType,
    words,
    sig,
    metrics,
  );
}

/** Plain-language message to show a user whose document was refused. */
export function userMessage(g: Partial<GateResult>): string {
  if (g.label === "unreadable") {
    return "We could not read enough text from this file. It may be a scanned or image-only PDF. Paste the text instead, or upload a DOCX or text-based PDF.";
  }
  const head = g.other_type ? "This looks like " + withArticle(g.other_type) + ", not a resume." : "This does not look like a resume.";
  const why = (g.reasons ?? []).filter((r) => !r.startsWith("This looks like"));
  return head + " Please upload your own resume or CV: it should list sections such as Education, Experience, Skills or Projects, with your contact details." + (why.length ? " What we noticed: " + why.slice(0, 2).join(" ") : "");
}

function withArticle(noun: string): string {
  return (/^[aeiou]/i.test(noun) ? "an " : "a ") + noun;
}

function result(is: boolean, score: number, label: string, reason: string, reasons: string[], found: string[], other: string | null, words: number, signals: Record<string, number>, metrics: Record<string, number> = {}): GateResult {
  return { is_resume: is, score, label, reason, reasons, found, other_type: other, words, signals, metrics };
}
