import { NEWLINE } from "./diff";
import { mbHead, mbLen, phpTrim, rx } from "../qrscore/php";

/**
 * The structured resume behind Resume Studio, and the plain text form of it (port of PHP Studio\ResumeData).
 *
 * normalize() is the only door for browser input: it trims, strips control characters, caps every length and count,
 * and validates dates and links, so the renderer and the database only ever see a safe, bounded structure.
 * toText() produces the canonical text that is scored and exported, using the section headings the scoring engine
 * understands, so what you see scored is exactly what is exported.
 */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export interface Link { label: string; url: string }
export interface Personal { name: string; headline: string; email: string; phone: string; location: string; links: Link[]; dob: string; nationality: string; marital: string; visa: string }
export interface Experience { title: string; company: string; location: string; start: string; end: string; current: boolean; bullets: string[]; hours: string; salary: string; supervisor: string }
export interface Education { degree: string; field: string; institution: string; location: string; year: string; score: string }
export interface Project { name: string; link: string; bullets: string[] }
export interface Certification { name: string; issuer: string; year: string }
export interface Language { name: string; level: string }
export interface ResumeData {
  personal: Personal;
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  projects: Project[];
  certifications: Certification[];
  awards: string[];
  publications: string[];
  languages: Language[];
}

type Rec = Record<string, unknown>;

export function blank(): ResumeData {
  return {
    personal: { name: "", headline: "", email: "", phone: "", location: "", links: [], dob: "", nationality: "", marital: "", visa: "" },
    summary: "",
    experience: [], education: [], skills: [], projects: [], certifications: [], awards: [], publications: [], languages: [],
  };
}

// ---------------------------------------------------------------- sanitising

/** PHP is_array(): a JSON list or an object (PHP decodes both to arrays). */
const isArr = (v: unknown): v is unknown[] | Rec => typeof v === "object" && v !== null;
const asRec = (v: unknown): Rec => (Array.isArray(v) ? Object.fromEntries(v.map((x, i) => [String(i), x])) : isArr(v) ? (v as Rec) : {});
const vals = (v: unknown): unknown[] => (Array.isArray(v) ? v : isArr(v) ? Object.values(v) : []);
/** PHP empty(): "", "0", 0, null, false, [] are all empty. */
const phpEmpty = (v: unknown): boolean =>
  v === undefined || v === null || v === false || v === "" || v === "0" || v === 0 || (isArr(v) && Object.keys(v).length === 0);
/** PHP truthiness for array_filter() without a callback. */
const truthy = (s: string): boolean => s !== "" && s !== "0";

function str(v: unknown, max: number): string {
  if (typeof v !== "string" && typeof v !== "number") return "";
  const s = String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return mbHead(phpTrim(s), max);
}

function month(v: unknown): string {
  const s = str(v, 12);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : "";
}

function year(v: unknown): string {
  const s = str(v, 12);
  return /^\d{4}$/.test(s) ? s : str(s, 12);
}

/** Best-effort stand-in for PHP's FILTER_VALIDATE_URL on an http(s) URL: a real host, no stray characters. */
function validUrl(s: string): boolean {
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/.test(u.hostname) || /^\[[0-9a-f:.]+\]$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function url(v: unknown): string {
  let s = str(v, 200);
  if (s === "") return "";
  if (!/^[a-z][a-z0-9+.\-]*:/i.test(s)) s = "https://" + s;
  return rx(String.raw`^https?://[^\s<>"']+$`, "i").test(s) && validUrl(s) ? s : "";
}

/** Best-effort stand-in for FILTER_VALIDATE_EMAIL. */
function validEmail(s: string): boolean {
  return (
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(s) &&
    !s.includes("..") && !s.startsWith(".") && !s.includes(".@")
  );
}

function list(v: unknown, maxItems: number, maxLen: number): string[] {
  let arr: unknown[];
  if (typeof v === "string") arr = v.split(/\r?\n/);
  else if (isArr(v)) arr = vals(v);
  else return [];
  const out: string[] = [];
  for (const item of arr) {
    const s = str(item, maxLen);
    if (s !== "") out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

function rows(v: unknown, max: number): Rec[] {
  return isArr(v) ? vals(v).filter((x) => isArr(x)).map(asRec).slice(0, max) : [];
}

/** Accept anything the browser sends and return the canonical, bounded structure. */
export function normalize(raw: unknown): ResumeData {
  const d = blank();
  const r = isArr(raw) ? asRec(raw) : {};
  const p = isArr(r.personal) ? asRec(r.personal) : {};
  const links: Link[] = [];
  for (const l of rows(p.links ?? [], 6)) {
    const u = url(l.url ?? "");
    if (u !== "") links.push({ label: str(l.label ?? "", 40), url: u });
  }
  const email = str(p.email ?? "", 190);
  const dob = str(p.dob ?? "", 10);
  d.personal = {
    name: str(p.name ?? "", 100), headline: str(p.headline ?? "", 120),
    email: validEmail(email) ? email : "",
    phone: str(p.phone ?? "", 30), location: str(p.location ?? "", 100), links,
    dob: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : "",
    nationality: str(p.nationality ?? "", 60), marital: str(p.marital ?? "", 30), visa: str(p.visa ?? "", 80),
  };
  d.summary = str(r.summary ?? "", 1200);

  for (const e of rows(r.experience ?? [], 12)) {
    const cur = !phpEmpty(e.current);
    d.experience.push({
      title: str(e.title ?? "", 100), company: str(e.company ?? "", 100), location: str(e.location ?? "", 80),
      start: month(e.start ?? ""), end: cur ? "" : month(e.end ?? ""), current: cur,
      bullets: list(e.bullets ?? [], 10, 320),
      hours: str(e.hours ?? "", 6), salary: str(e.salary ?? "", 40), supervisor: str(e.supervisor ?? "", 100),
    });
  }
  for (const e of rows(r.education ?? [], 6)) {
    d.education.push({ degree: str(e.degree ?? "", 120), field: str(e.field ?? "", 100), institution: str(e.institution ?? "", 140), location: str(e.location ?? "", 80), year: year(e.year ?? ""), score: str(e.score ?? "", 30) });
  }
  d.skills = list(r.skills ?? [], 40, 40);
  for (const e of rows(r.projects ?? [], 8)) d.projects.push({ name: str(e.name ?? "", 120), link: url(e.link ?? ""), bullets: list(e.bullets ?? [], 6, 320) });
  for (const e of rows(r.certifications ?? [], 12)) d.certifications.push({ name: str(e.name ?? "", 140), issuer: str(e.issuer ?? "", 100), year: year(e.year ?? "") });
  d.awards = list(r.awards ?? [], 12, 220);
  d.publications = list(r.publications ?? [], 20, 320);
  for (const e of rows(r.languages ?? [], 8)) d.languages.push({ name: str(e.name ?? "", 40), level: str(e.level ?? "", 40) });
  // Drop completely empty entries.
  d.experience = d.experience.filter((e) => e.title !== "" || e.company !== "" || e.bullets.length > 0);
  d.education = d.education.filter((e) => e.degree !== "" || e.institution !== "");
  d.projects = d.projects.filter((e) => e.name !== "" || e.bullets.length > 0);
  d.certifications = d.certifications.filter((e) => e.name !== "");
  d.languages = d.languages.filter((e) => e.name !== "");
  return d;
}

// ---------------------------------------------------------------- dates

export function fmtMonth(ym: string, style = "my"): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  if (style === "slash") return `${m[2]}/${m[1]}`;
  if (style === "jp") return `${m[1]}/${m[2]}`;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function fmtDob(iso: string, region: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  if (region === "de") return `${m[3]}.${m[2]}.${m[1]}`;
  if (region === "jp") return `${m[1]}/${m[2]}/${m[3]}`;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function period(e: { start: string; end: string; current?: boolean }, style = "my"): string {
  const from = fmtMonth(e.start, style);
  const to = e.current ? "Present" : fmtMonth(e.end, style);
  return from !== "" && to !== "" ? `${from} - ${to}` : from !== "" ? from : to;
}

const ym = (y: number, m: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;

/** "July 2023 - Present" or "2019 - 2022" to [start, end, current] (YYYY-MM). Best effort. */
export function parseRange(input: string): [string, string, boolean] {
  const s = input.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const cur = /present|current|now|ongoing|till date/.test(s);
  const found: string[] = [];
  const re = rx(
    String.raw`\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z]*\.?,?\s+(\d{4})\b|\b(\d{1,2})[\/\-](\d{4})\b|\b(\d{4})\b`,
    "g",
  );
  for (const x of s.matchAll(re)) {
    if (x[1]) found.push(ym(parseInt(x[2], 10), MONTH_FULL[x[1]] ?? MONTH_FULL[x[1].slice(0, 3)] ?? 1));
    else if (x[3] && parseInt(x[3], 10) >= 1 && parseInt(x[3], 10) <= 12) found.push(ym(parseInt(x[4], 10), parseInt(x[3], 10)));
    else if (x[5]) found.push(ym(parseInt(x[5], 10), 1));
  }
  return [found[0] ?? "", cur ? "" : found[1] ?? "", cur];
}

// ---------------------------------------------------------------- import

const lst = (v: unknown): unknown[] => (v === undefined || v === null ? [] : isArr(v) ? vals(v) : [v]);

/**
 * Start a studio resume from what the scoring engine already parsed. The engine's parse is best-effort (it can split one
 * job in two or miss an institution), so the student reviews it in the editor.
 */
export function fromProfile(rq: unknown, user: { name?: string; email?: string }, resumeText = ""): ResumeData {
  const d = blank();
  const prof = asRec(asRec(rq).profile);
  const per = asRec(prof.personal);
  d.personal.name = str(per.name ?? user.name ?? "", 100) || str(user.name ?? "", 100);
  d.personal.email = str(per.email ?? user.email ?? "", 190) || str(user.email ?? "", 190);
  d.personal.phone = str(per.phone ?? "", 30);
  d.personal.location = str(per.location ?? "", 100);
  for (const l of lst(per.links)) {
    const u = url(isArr(l) ? asRec(l).url ?? "" : l);
    if (u !== "") d.personal.links.push({ label: "", url: u });
  }
  d.summary = str(prof.summary ?? "", 1200);

  const exp: Experience[] = [];
  for (const raw of lst(prof.experience)) {
    if (!isArr(raw)) continue;
    const e = asRec(raw);
    const [start, end, cur] = parseRange(String(e.dates ?? ""));
    const row: Experience = {
      title: str(e.title ?? "", 100), company: str(e.company ?? "", 100), location: "", start, end, current: cur || !phpEmpty(e.current),
      bullets: list(e.bullets ?? [], 10, 320), hours: "", salary: "", supervisor: "",
    };
    // The parser sometimes emits the dates and bullets of a job as a second, untitled entry: fold it back in.
    if (exp.length > 0 && row.title === "" && row.company === "") {
      const last = exp[exp.length - 1];
      last.start = last.start || row.start;
      last.end = last.end || row.end;
      last.current = last.current || row.current;
      last.bullets = [...last.bullets, ...row.bullets];
      continue;
    }
    exp.push(row);
  }
  d.experience = exp;
  for (const raw of lst(prof.education)) {
    if (!isArr(raw)) continue;
    const e = asRec(raw);
    d.education.push({ degree: str(e.degree ?? "", 120), field: str(e.field ?? "", 100), institution: str(e.institution ?? "", 140), location: str(e.location ?? "", 80), year: year(e.year ?? ""), score: str(e.score ?? "", 30) });
  }
  if (resumeText !== "") d.education = recoverEducation(d.education, resumeText);
  const sk = asRec(prof.skills);
  d.skills = list([...lst(sk.technical), ...lst(sk.soft)], 40, 40);
  for (const c of lst(prof.certifications)) {
    const cr = isArr(c) ? asRec(c) : null;
    const name = cr ? cr.name ?? cr.title ?? "" : c;
    if (str(name, 140) !== "") d.certifications.push({ name: str(name, 140), issuer: str(cr ? cr.issuer ?? "" : "", 100), year: year(cr ? cr.year ?? "" : "") });
  }
  for (const p of lst(prof.projects)) {
    const pr = isArr(p) ? asRec(p) : null;
    const name = pr ? pr.name ?? pr.title ?? "" : p;
    if (str(name, 120) !== "") d.projects.push({ name: str(name, 120), link: "", bullets: list(pr ? pr.bullets ?? pr.description ?? [] : [], 6, 320) });
  }
  d.awards = list(lst(prof.awards).map((a) => (isArr(a) ? asRec(a).name ?? asRec(a).title ?? "" : a)), 12, 220);
  d.publications = list(lst(prof.publications).map((a) => (isArr(a) ? asRec(a).title ?? asRec(a).name ?? "" : a)), 20, 320);
  for (const l of lst(prof.languages)) {
    const lr = isArr(l) ? asRec(l) : null;
    const name = lr ? lr.name ?? lr.language ?? "" : l;
    if (str(name, 40) !== "") d.languages.push({ name: str(name, 40), level: str(lr ? lr.level ?? lr.proficiency ?? "" : "", 40) });
  }
  return normalize(d);
}

/**
 * The parser often finds a degree but not the institution or year printed under it. Look at the original text: the line
 * after the degree is usually "Institution, City", and the next one "Graduated 2023 | CGPA: 7.5/10".
 */
function recoverEducation(edu: Education[], text: string): Education[] {
  const lines = text.split(NEWLINE).map(phpTrim);
  for (const e of edu) {
    if (e.institution !== "" || e.degree === "") continue;
    const deg = e.degree.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i].toLowerCase();
      if (ln !== deg && !ln.startsWith(deg)) continue;
      const next = lines[i + 1] ?? "";
      let tail: string;
      if (next !== "" && mbLen(next) <= 140 && !/^[A-Z][A-Z &/]{3,}$/.test(next) && !/\b(graduated|cgpa|gpa|\d{4})\b/i.test(next)) {
        const k = next.indexOf(",");
        e.institution = str(phpTrim(k < 0 ? next : next.slice(0, k)), 140);
        e.location = str(k < 0 ? "" : phpTrim(next.slice(k + 1)), 80);
        tail = lines[i + 2] ?? "";
      } else {
        tail = next;
      }
      const y = /\b(19|20)\d{2}\b/.exec(tail);
      if (e.year === "" && y) e.year = y[0];
      const sc = rx(String.raw`(?:cgpa|gpa|percentage|grade)\s*[:\-]?\s*([0-9.]+(?:\s*\/\s*[0-9.]+|%)?)`, "i").exec(tail);
      if (e.score === "" && sc) e.score = str(sc[1], 30);
      break;
    }
  }
  return edu;
}

/** A fictional example, used for template thumbnails when the student has no data yet. */
export function sample(): ResumeData {
  return normalize({
    personal: { name: "Alex Morgan", headline: "Marketing Analyst", email: "alex.morgan@example.com", phone: "+1 555 0100", location: "Austin, TX", links: [{ label: "LinkedIn", url: "https://linkedin.com/in/alexmorgan" }] },
    summary: "Analytical marketing professional with four years of experience turning campaign data into measurable growth.",
    experience: [
      { title: "Marketing Analyst", company: "Brightline Media", location: "Austin, TX", start: "2022-03", current: true, bullets: ["Grew qualified leads 38% by redesigning the paid search funnel.", "Built weekly dashboards used by a team of 12."] },
      { title: "Marketing Associate", company: "Northwind Retail", location: "Dallas, TX", start: "2020-06", end: "2022-02", bullets: ["Managed a $120K annual campaign budget.", "Cut cost per acquisition by 21%."] },
    ],
    education: [{ degree: "B.Sc. Marketing", institution: "University of Texas", location: "Austin, TX", year: "2020", score: "3.7/4.0" }],
    skills: ["SEO", "Google Analytics", "SQL", "A/B testing", "Copywriting", "Excel"],
    certifications: [{ name: "Google Analytics Certification", issuer: "Google", year: "2023" }],
    languages: [{ name: "English", level: "Native" }, { name: "Spanish", level: "Intermediate" }],
  });
}

// ---------------------------------------------------------------- plain text (scored and exported)

export function toText(d: ResumeData, region: string | null = null): string {
  const p = d.personal;
  const L: string[] = [];
  if (p.name !== "") L.push(p.name);
  if (p.headline !== "") L.push(p.headline);
  const contact = [p.email, p.phone, p.location].filter(truthy);
  for (const l of p.links) contact.push((l.label !== "" ? l.label + ": " : "") + l.url);
  if (contact.length) L.push(contact.join(" | "));
  const extra = [
    p.dob !== "" ? "Date of birth: " + fmtDob(p.dob, region) : "",
    p.nationality !== "" ? "Nationality: " + p.nationality : "",
    p.marital !== "" ? "Marital status: " + p.marital : "",
    p.visa !== "" ? "Visa status: " + p.visa : "",
  ].filter(truthy);
  if (extra.length) L.push(extra.join(" | "));
  const sec = (title: string, lines: string[]) => {
    if (lines.length) {
      L.push("", title);
      for (const x of lines) L.push(x);
    }
  };
  sec("PROFESSIONAL SUMMARY", d.summary !== "" ? [d.summary] : []);
  let x: string[] = [];
  for (const e of d.experience) {
    x.push([e.title, e.company, e.location].filter(truthy).join(", "));
    const per = period(e);
    if (per !== "") x.push(per);
    for (const b of e.bullets) x.push("- " + b);
    if (e.hours !== "" || e.salary !== "" || e.supervisor !== "") {
      x.push([e.hours !== "" ? "Hours per week: " + e.hours : "", e.salary !== "" ? "Salary: " + e.salary : "", e.supervisor !== "" ? "Supervisor: " + e.supervisor : ""].filter(truthy).join(" | "));
    }
    x.push("");
  }
  sec("WORK EXPERIENCE", x.slice(0, Math.max(0, x.length - 1)));
  x = [];
  for (const e of d.education) {
    x.push(e.degree + (e.field !== "" && !e.degree.toLowerCase().includes(e.field.toLowerCase()) ? " in " + e.field : ""));
    const inst = [e.institution, e.location].filter(truthy).join(", ");
    if (inst !== "") x.push(inst);
    const tail = [e.year !== "" ? "Graduated " + e.year : "", e.score !== "" ? (region === "in" ? "CGPA: " : "GPA: ") + e.score : ""].filter(truthy);
    if (tail.length) x.push(tail.join(" | "));
    x.push("");
  }
  sec("EDUCATION", x.slice(0, Math.max(0, x.length - 1)));
  sec("SKILLS", d.skills.length ? [d.skills.join(", ")] : []);
  x = [];
  for (const e of d.projects) {
    x.push(e.name + (e.link !== "" ? ` (${e.link})` : ""));
    for (const b of e.bullets) x.push("- " + b);
  }
  sec("PROJECTS", x);
  sec("CERTIFICATIONS", d.certifications.map((c) => [c.name, c.issuer].filter(truthy).join(" - ") + (c.year !== "" ? ` (${c.year})` : "")));
  sec("AWARDS", d.awards.map((a) => "- " + a));
  sec("PUBLICATIONS", d.publications.map((a) => "- " + a));
  sec("LANGUAGES", d.languages.length ? [d.languages.map((l) => l.name + (l.level !== "" ? ` (${l.level})` : "")).join(", ")] : []);
  return phpTrim(L.join("\n")) + "\n";
}

export function wordCount(text: string): number {
  return phpTrim(text).split(rx(String.raw`\s+`)).filter((w) => w !== "").length;
}
