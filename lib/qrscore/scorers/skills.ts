import { dictionaries, recommendations } from "../data";
import type { Domain } from "../career-stage";
import type { Segmented } from "../segmenter";
import { containsAny, findAll, lines as textLines } from "../text";
import { asciiLower, mbLen, phpTrim, rx } from "../php";
import { rate, type RawScores } from "./types";

/** Section 3, Skills and Competencies (port of Score\SkillsScorer): coverage, relevance, organisation, buzzword avoidance, evidence. */
export function scoreSkills(seg: Segmented, fullText: string, domain: Domain): RawScores {
  const dict = dictionaries();
  const block = seg.sections["skills"] ?? "";
  const searchText = block !== "" ? block : fullText;

  const items = skillItems(block);
  const hard = hardSkills(searchText);
  const soft = findAll(searchText, dict.soft_skills);
  const buzz = findAll(searchText, dict.buzzwords_cliches);
  const genericTools = findAll(searchText, dict.tech_tools_generic);
  const grouped = isGrouped(block);
  const proficiency = containsAny(searchText, dict.proficiency_markers);
  const certs = containsAny(fullText, dict.professional_qual_bodies) || containsAny(fullText, ["certified", "certification", "certificate"]);
  const relevance = domainRelevance(searchText, domain);

  const r: RawScores = {};
  r[301] = rate(presence(block, items, grouped), { 0: "No skills listed.", 1: "One or two scattered.", 2: "Short unstructured list.", 3: "Clear skills list.", 4: "Dedicated, organised section.", 5: "Comprehensive, well-organised competencies." });
  r[302] = rate(byCount(hard.length, [1, 2, 4, 7, 10]), { 0: "No technical skills.", 1: "One generic skill.", 2: "Few technical skills.", 3: "Solid technical set.", 4: "Broad, specific technical set.", 5: "Deep, in-demand technical stack." });
  r[303] = rate(toolsScore(hard, genericTools), { 0: "No tools.", 1: 'Vague ("MS Office").', 2: "Some named tools.", 3: "Several specific tools.", 4: "Precise, relevant tooling.", 5: "Named tools with context." });
  r[304] = rate(softScore(soft, buzz), { 0: "No soft skills.", 1: "Only clichés.", 2: "Generic soft skills.", 3: "Relevant soft skills.", 4: "Soft skills with context.", 5: "Balanced soft skills evidenced by achievements." });
  r[305] = rate(relevance, { 0: "Irrelevant to field.", 1: "Barely aligned.", 2: "Partly aligned.", 3: "Aligned to field.", 4: "Strongly aligned.", 5: "Precisely aligned to target roles." });
  r[306] = rate(orgScore(block, grouped, items), { 0: "Random dump.", 1: "Long unbroken list.", 2: "Flat list.", 3: "Some grouping.", 4: "Grouped by category.", 5: "Cleanly grouped competencies." });
  r[307] = rate(buzzScore(buzz.length, genericTools.length), { 0: "All clichés.", 1: "Mostly clichés.", 2: "Several clichés.", 3: "Few clichés.", 4: "Largely concrete.", 5: "No filler; concrete throughout." });
  r[308] = rate(proficiency ? 4 : hard.length > 0 ? 2 : 0, { 0: "No proficiency shown.", 1: "Unqualified list.", 2: "Vague levels.", 3: "Some proficiency indicated.", 4: "Clear levels or years.", 5: "Proficiency evidenced by work." });
  r[309] = rate(certs ? (relevance >= 3 ? 4 : 3) : 0, { 0: "No certifications.", 1: "Unrelated.", 2: "Loosely related.", 3: "Relevant certs/keywords.", 4: "Strong, current certifications.", 5: "Recognised certifications aligned to roles." });
  return r;
}

function skillItems(block: string): string[] {
  if (block === "") return [];
  return block.split(/[,;\n•|·]+/u).map(phpTrim).filter((p) => mbLen(p) > 1);
}

function hardSkills(text: string): string[] {
  const dict = dictionaries();
  // PHP keeps an insertion-ordered map; first occurrence of each value (lower-cased) wins.
  const found = new Map<string, string>();
  findAll(text, dict.field_specific_markers).forEach((k, i) => found.set("#" + i, k));
  const stop = ["I", "The", "A", "An", "And", "Or", "With", "For", "To", "In", "On", "Of", "My", "We"];
  for (const m of text.matchAll(/\b([A-Z][A-Za-z0-9+.#]{1,}(?:\.[A-Za-z]+)?)\b/g)) {
    const tok = m[1];
    if (!stop.includes(tok) && mbLen(tok) >= 2 && mbLen(tok) <= 20) found.set(tok, tok);
  }
  return Array.from(new Set(Array.from(found.values()).map(asciiLower)));
}

function isGrouped(block: string): boolean {
  return rx(String.raw`^[A-Z][A-Za-z &/]{2,20}\s*:`, "m").test(block); // "Languages: ...", "Tools: ..." labels
}

function domainRelevance(text: string, domain: Domain): number {
  const domains = recommendations().domains as unknown as Record<string, { keywords?: string[] }>;
  const keywords = domains[domain.key]?.keywords ?? [];
  if (domain.key === "general" || !keywords.length) return 3;
  const hits = findAll(text, keywords).length;
  if (hits >= 4) return 5;
  if (hits >= 2) return 4;
  if (hits >= 1) return 3;
  return 1;
}

/** Relevance proxy reused by Projects (same heuristic with different cut-offs). */
export function domainRelevanceProxy(text: string, domain: Domain): number {
  const domains = recommendations().domains as unknown as Record<string, { keywords?: string[] }>;
  const keywords = domains[domain.key]?.keywords ?? [];
  if (domain.key === "general" || !keywords.length) return 3;
  const hits = findAll(text, keywords).length;
  if (hits >= 3) return 5;
  if (hits >= 2) return 4;
  if (hits >= 1) return 3;
  return 1;
}

function presence(block: string, items: string[], grouped: boolean): number {
  if (block === "" && !items.length) return 0;
  const n = items.length;
  if (block !== "" && n >= 8 && grouped) return 5;
  if (block !== "" && n >= 6) return 4;
  if (n >= 3) return 3;
  if (n >= 1) return 2;
  return 1;
}

function toolsScore(hard: string[], generic: string[]): number {
  const specific = hard.length - generic.length;
  if (hard.length === 0) return 0;
  if (specific <= 0) return 1;
  if (specific >= 6) return 5;
  if (specific >= 4) return 4;
  if (specific >= 2) return 3;
  return 2;
}

function softScore(soft: string[], buzz: string[]): number {
  if (!soft.length && !buzz.length) return 0;
  if (!soft.length && buzz.length) return 1;
  if (buzz.length > soft.length) return 2;
  return soft.length >= 3 ? 4 : 3;
}

function orgScore(block: string, grouped: boolean, items: string[]): number {
  if (block === "") return 0;
  if (grouped) return items.length >= 6 ? 5 : 4;
  if (textLines(block).length >= 3) return 3;
  if (items.length > 15) return 1; // one giant dump
  return 2;
}

function buzzScore(buzz: number, generic: number): number {
  const bad = buzz + generic;
  if (bad === 0) return 5;
  if (bad === 1) return 4;
  if (bad <= 3) return 3;
  if (bad <= 5) return 2;
  return 1;
}

function byCount(n: number, thresholds: number[]): number {
  let score = 0;
  thresholds.forEach((t, i) => {
    if (n >= t) score = i + 1;
  });
  return score;
}
