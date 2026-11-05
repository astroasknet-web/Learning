import { dictionaries, type Dictionaries } from "./data";
import type { Career, Domain } from "./career-stage";
import type { Segmented } from "./segmenter";
import { containsAny, findAll, lines as textLines } from "./text";
import { bin, escapeRe, ltrimBytes, mbHead, mbLen, orNull, phpTrim, rtrimChars, rx, trimBytes, ucwords, unbin } from "./php";

/**
 * Turns resume text into a clean structured profile: personal, summary, education, experience, skills, certifications,
 * projects, awards, publications and languages (port of Extract\ProfileExtractor). Every field is best-effort: missing
 * data yields empty arrays or nulls, never errors.
 */
const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
const BULLET_TRIM = "-•*◦▪‣· ";

export interface Profile {
  personal: { name: string | null; email: string | null; phone: string | null; location: string | null; links: string[] };
  summary: string | null;
  meta: { career_stage: string | null; years_experience: number | null; domain: string | null };
  education: Array<{ degree: string | null; field: string | null; institution: string | null; location: string | null; year: number | null; score: string | null }>;
  experience: Array<{ title: string | null; company: string | null; dates: string | null; current: boolean; bullets: string[] }>;
  skills: { technical: string[]; soft: string[] };
  certifications: Array<{ name: string; year: number | null }>;
  projects: Array<{ name: string | null; description: string; tech: string[]; link: string | null }>;
  awards: string[];
  publications: string[];
  languages: string[];
}

export function extractProfile(seg: Segmented, fullText: string, career: Career, domain: Domain): Profile {
  const dict = dictionaries();
  return {
    personal: personal(fullText, dict),
    summary: summary(seg),
    meta: { career_stage: career.stage ?? null, years_experience: career.yearsExperience ?? null, domain: domain.key ?? null },
    education: education(seg, dict),
    experience: experience(seg),
    skills: skills(seg, dict),
    certifications: certifications(seg, dict),
    projects: projects(seg),
    awards: listFromSection(seg, ["awards"], 8),
    publications: publications(seg, fullText, dict),
    languages: languages(fullText),
  };
}

function personal(text: string, dict: Dictionaries): Profile["personal"] {
  const lines = textLines(text);
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  let phone: string | null = null;
  const mp = text.match(rx(String.raw`(\+?\d[\d\s().-]{8,}\d)`));
  if (mp) {
    phone = phpTrim(mp[1].replace(/[()]+/g, ""));
    phone = phone.replace(rx(String.raw`\s{2,}`, "g"), " ");
  }

  // Name: first plausible line (1-5 words, mostly letters, no @ or digits).
  let name: string | null = null;
  for (const l of lines.slice(0, 6)) {
    const clean = phpTrim(l);
    if (clean === "" || clean.includes("@") || /\d/.test(clean)) continue;
    const words = clean.split(rx(String.raw`\s+`));
    if (words.length >= 1 && words.length <= 5 && /^[A-Za-z][A-Za-z .'-]+$/.test(clean) && mbLen(clean) <= 45) {
      name = clean;
      break;
    }
  }

  // Location: prefer a "..., City [pincode], Country" cluster near the top.
  let location: string | null = null;
  const head = lines.slice(0, 12).join("\n");
  const lm = head.match(/([A-Z][A-Za-z .'-]+(?:,\s*[A-Za-z .'0-9-]+){1,4},?\s*(?:India|United Kingdom|UK|United States|USA|Canada|Australia|Germany|France|Singapore|UAE|Ireland))/u);
  if (lm) {
    location = phpTrim(lm[1]);
  } else {
    const places = [...dict.international_country_markers, "india", "delhi", "mumbai", "bengaluru", "bangalore", "hyderabad", "pune", "chennai", "kolkata", "noida", "gurugram", "jaipur", "ahmedabad"];
    for (const l of textLines(head)) {
      if (containsAny(l, places) && mbLen(l) < 60) {
        location = cleanupContactLine(l);
        break;
      }
    }
  }

  const links: string[] = [];
  const found = text.match(rx(String.raw`(https?:\/\/[^\s|,]+|(?:www|github\.com|linkedin\.com|gitlab\.com|behance\.net|kaggle\.com)[^\s|,]+)`, "gi"));
  if (found) for (const u of Array.from(new Set(found))) links.push(rtrimChars(u, ".),"));

  return { name, email, phone, location, links: links.slice(0, 8) };
}

function cleanupContactLine(l: string): string {
  return phpTrim(l.replace(/^[^\p{L}\p{N}+]+/u, "")); // drop leading icon glyphs and bullets that survive extraction
}

function summary(seg: Segmented): string | null {
  const s = phpTrim(seg.sections["objective"] ?? "");
  if (s === "") return null;
  return mbHead(s.replace(/[ \t\n\x0B\f\r]+/g, " "), 600);
}

/** Split bullet-joined text ("• A • B") that some PDF extractors emit onto one line. */
function normalizeBullets(b: string): string {
  return b.replace(/\s*[•∙◦▪‣]\s*/gu, "\n");
}

function education(seg: Segmented, dict: Dictionaries): Profile["education"] {
  const block = seg.sections["education"] ?? "";
  if (block === "") return [];
  const degreeMarkers = [...Object.values(dict.degree_full_names).flat(), ...Object.values(dict.degree_abbreviations).flat()];
  const out: Profile["education"] = [];
  for (const raw of textLines(normalizeBullets(block))) {
    const line = phpTrim(raw.replace(/\*/g, "").replace(/[ \t\n\x0B\f\r]+/g, " "));
    if (!containsAny(line, degreeMarkers)) continue; // only lines that actually name a degree
    let degree: string;
    let rest = "";
    const mm = line.match(/^(.*?)\s*[–-]\s*(.*)$/u);
    if (mm) {
      degree = phpTrim(mm[1]);
      rest = phpTrim(mm[2]);
    } else {
      degree = line;
    }
    const y = line.match(/(?:19|20)\d{2}/);
    const year = y ? parseInt(y[0], 10) : null;
    const g = line.match(rx(String.raw`(\d\.\d{1,2})\s*\/\s*\d(?:\.\d)?`));
    const p = line.match(rx(String.raw`(\d{1,3}(?:\.\d{1,2})?)\s*%`));
    const gpa = g ? g[0] : p ? p[0] : null;

    let institution: string | null = null;
    const loc: string[] = [];
    if (rest !== "") {
      const parts = rest.split(",").map(phpTrim);
      institution = parts[0] !== "" ? parts[0] : null;
      for (const pp of parts.slice(1)) {
        if (pp !== "" && !rx(String.raw`(19|20)\d{2}|\d+\s*%|\(`).test(pp)) loc.push(pp);
      }
    }
    out.push({ degree: degree !== "" ? degree : null, field: fieldFrom(degree, dict), institution, location: loc.length ? loc.join(", ") : null, year, score: gpa });
    if (out.length >= 12) break;
  }
  return out;
}

function fieldFrom(degree: string, dict: Dictionaries): string | null {
  const hits = findAll(degree, dict.field_specific_markers);
  if (hits.length) return ucwords(hits[0]);
  const m = degree.match(rx(String.raw`\bin\s+([A-Z][A-Za-z &]+)`));
  return m ? phpTrim(m[1]) : null;
}

function experience(seg: Segmented): Profile["experience"] {
  const block = seg.sections["experience"] ?? "";
  if (block === "") return [];
  const lines = textLines(block);
  // PHP ran this without /u, so the dash class is a set of bytes; keep that by matching on the byte string.
  const rangeSrc = "((?:" + MONTHS + ")[a-z]*\\.?\\s*)?((?:19|20)\\d{2})\\s*[-" + bin("–—") + "to]+\\s*((?:present|current|now)|(?:(?:" + MONTHS + ")[a-z]*\\.?\\s*)?(?:19|20)\\d{2})";
  const rangeRe = new RegExp(rangeSrc, "i");
  const rangeReG = new RegExp(rangeSrc, "gi");

  const entries: Profile["experience"] = [];
  let current: Profile["experience"][number] | null = null;
  const titleRe = /\b(engineer|manager|analyst|developer|lead|director|executive|consultant|designer|officer|head|founder|intern|specialist|associate|architect|scientist|accountant|teacher|coordinator)\b/i;

  for (const l of lines) {
    const bl = bin(l);
    const isBullet = /^[-•*◦▪‣·]/u.test(l);
    const hasRange = rangeRe.test(bl);
    const looksHeader = titleRe.test(l) && !isBullet;

    if ((looksHeader || hasRange) && !isBullet) {
      if (current !== null) entries.push(current);
      current = { title: null, company: null, dates: null, current: false, bullets: [] };
      const head = phpTrim(unbin(bl.replace(rangeReG, "")));
      const mm = head.match(/^(.*?)(?:,| at | \| |–| - )(.*)$/u);
      if (mm) {
        current.title = orNull(phpTrim(mm[1]));
        current.company = orNull(phpTrim(mm[2]));
      } else {
        current.title = orNull(phpTrim(head));
      }
      const dr = bl.match(rangeRe);
      if (dr) {
        current.dates = phpTrim(unbin(dr[0]));
        current.current = /present|current|now/i.test(dr[3]);
      }
    } else if (current !== null) {
      if (isBullet) {
        current.bullets.push(ltrimBytes(l, BULLET_TRIM));
      } else if (current.dates === null && hasRange) {
        const dr = bl.match(rangeRe);
        if (dr) {
          current.dates = phpTrim(unbin(dr[0]));
          current.current = /present|current|now/i.test(dr[3]);
        }
      } else if (current.company === null && mbLen(l) < 60 && !isBullet) {
        current.company = cleanupContactLine(l);
      }
    }
  }
  if (current !== null) entries.push(current);
  for (const e of entries) e.bullets = e.bullets.slice(0, 8);
  return entries.slice(0, 12);
}

function skills(seg: Segmented, dict: Dictionaries): Profile["skills"] {
  const block = seg.sections["skills"] ?? "";
  let items: string[] = [];
  if (block !== "") {
    for (const part of block.split(/[,;\n•|·]+/u)) {
      const p = phpTrim(part);
      if (mbLen(p) > 1 && mbLen(p) < 40 && !/^[A-Z][a-z ]{2,20}:$/.test(p)) items.push(p);
    }
  }
  items = Array.from(new Set(items));
  const soft: string[] = [];
  const technical: string[] = [];
  for (const it of items) {
    if (containsAny(it, dict.soft_skills) || containsAny(it, dict.buzzwords_cliches)) soft.push(it);
    else technical.push(it);
  }
  return { technical: technical.slice(0, 40), soft: soft.slice(0, 20) };
}

function certifications(seg: Segmented, dict: Dictionaries): Profile["certifications"] {
  const block = seg.sections["certifications"] ?? "";
  // Prefer a dedicated section, else the education block (certs often live there), never the whole resume (too noisy).
  const source = block !== "" ? block : seg.sections["education"] ?? "";
  if (source === "") return [];
  const providers = ["google", "coursera", "udemy", "edx", "aws", "amazon web services", "microsoft", "cisco", "pmi", "oracle", "ibm", "linkedin learning", "hubspot", "salesforce", "tableau", "scrum", "comptia", "icai", "acca"];
  const out = new Map<string, { name: string; year: number | null }>();
  for (const l of textLines(normalizeBullets(source))) {
    if (/\b(unable|cannot|provide|not available)\b/i.test(l)) continue;
    const m = l.match(rx(String.raw`certifications?\s*[:-]\s*(.+)`, "i"));
    if (m) {
      for (const item of m[1].split(/,(?![^()]*\))/)) addCert(out, item);
    } else if ((containsAny(l, dict.professional_qual_bodies) || containsAny(l, providers)) && /\b(certified|certificate|certification|analytics|specialist|associate|professional|nanodegree)\b/i.test(l)) {
      addCert(out, l);
    }
    if (out.size >= 12) break;
  }
  return Array.from(out.values());
}

function addCert(out: Map<string, { name: string; year: number | null }>, rawItem: string): void {
  const item = phpTrim(rawItem);
  const y = item.match(rx(String.raw`((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(19|20)\d{2}`, "i"));
  const year = y ? parseInt(y[0].replace(/\D/g, ""), 10) : null;
  let name = phpTrim(cleanupContactLine(item.replace(/\(.*?\)/g, "")));
  name = trimBytes(name, " -–—:");
  if (name !== "" && mbLen(name) >= 3 && mbLen(name) < 90) out.set(name.toLowerCase(), { name, year });
}

function projects(seg: Segmented): Profile["projects"] {
  const block = seg.sections["projects"] ?? "";
  if (block === "") return [];
  const out: Profile["projects"] = [];
  for (const l of textLines(normalizeBullets(block))) {
    if (mbLen(phpTrim(l)) < 8) continue;
    const clean = ltrimBytes(l, BULLET_TRIM);
    const lm = clean.match(rx(String.raw`(https?:\/\/\S+|github\.com\/\S+|play\.google\.com\/\S+|www\.\S+)`, "i"));
    const link = lm ? rtrimChars(lm[0], ".),") : null;
    const tm = clean.match(/\(([^)]+)\)/);
    const tech = tm ? tm[1].split(",").map(phpTrim) : [];
    const name = phpTrim(clean.split(/[–:(-]/u)[0] ?? clean);
    out.push({ name: orNull(mbHead(name, 80)), description: mbHead(clean, 300), tech: tech.slice(0, 10), link });
    if (out.length >= 10) break;
  }
  return out;
}

function publications(seg: Segmented, text: string, dict: Dictionaries): string[] {
  const block = seg.sections["research"] ?? "";
  const source = block !== "" ? normalizeBullets(block) : text;
  if (!containsAny(source, dict.publication_markers)) return [];
  const out: string[] = [];
  for (const l of textLines(source)) {
    if (containsAny(l, dict.publication_markers) && mbLen(l) > 15) out.push(mbHead(cleanupContactLine(l), 200));
    if (out.length >= 6) break;
  }
  return Array.from(new Set(out));
}

function languages(text: string): string[] {
  // Only read languages from an explicit "Languages" context (PHP ran this on bytes, so ".{3,120}" counts bytes).
  const m = bin(text).match(/\blanguages?\b\s*[:-]?\s*(.{3,120})/i);
  if (!m) return [];
  const scope = m[1];
  const known = ["English", "Hindi", "Punjabi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada", "Malayalam", "Urdu", "Spanish", "French", "German", "Mandarin", "Japanese", "Arabic"];
  return known.filter((lang) => new RegExp("\\b" + escapeRe(lang) + "\\b", "i").test(scope)).slice(0, 8);
}

function listFromSection(seg: Segmented, keys: string[], cap: number): string[] {
  for (const k of keys) {
    const block = seg.sections[k] ?? "";
    if (block !== "") {
      const out: string[] = [];
      for (const l of textLines(normalizeBullets(block))) {
        const clean = ltrimBytes(l, BULLET_TRIM);
        if (mbLen(clean) > 3) out.push(mbHead(clean, 200));
        if (out.length >= cap) break;
      }
      return out;
    }
  }
  return [];
}
