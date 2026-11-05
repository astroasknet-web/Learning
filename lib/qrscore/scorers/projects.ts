import { dictionaries } from "../data";
import type { Career, Domain } from "../career-stage";
import type { Segmented } from "../segmenter";
import { containsAny, findAll, lines as textLines } from "../text";
import { bin, rx } from "../php";
import { domainRelevanceProxy } from "./skills";
import { rate, type RawScores } from "./types";

/** Section 4, Projects and Portfolio (port of Score\ProjectsScorer). The whole section is N/A for experienced people who list none. */
export function scoreProjects(seg: Segmented, fullText: string, domain: Domain): RawScores {
  const dict = dictionaries();
  const block = seg.sections["projects"] ?? "";
  const has = block !== "" || containsAny(fullText, ["project", "built", "developed a", "created a"]);
  const searchText = block !== "" ? block : fullText;

  const lines = textLines(block);
  const count = projectCount(lines, searchText);
  const contribution = contributionScore(searchText);
  const stack = containsAny(searchText, dict.field_specific_markers) || /\([A-Za-z].*\)/.test(searchText);
  const outcomes = outcomeScore(searchText);
  const links = findAll(searchText, dict.link_markers);
  const relevance = domainRelevanceProxy(searchText, domain);
  const ownSection = block !== "";

  const r: RawScores = {};
  r[401] = rate(presence(has, ownSection, count), { 0: "No projects.", 1: "Passing mention.", 2: "One vague project.", 3: "A project or two.", 4: "Dedicated projects section.", 5: "Strong, curated portfolio." });
  r[402] = rate(substance(count), { 0: "None.", 1: "Trivial.", 2: "One real project.", 3: "Two to three projects.", 4: "Several substantial projects.", 5: "Portfolio of distinct projects." });
  r[403] = rate(contribution, { 0: "Unclear role.", 1: "Team credit only.", 2: "Vague contribution.", 3: "Contribution stated.", 4: "Clear individual role.", 5: "Precise ownership and impact." });
  r[404] = rate(stack ? (outcomes >= 3 ? 5 : 4) : has ? 2 : 0, { 0: "No stack.", 1: "Vague.", 2: "A tool named.", 3: "Stack listed.", 4: "Stack and approach.", 5: "Stack, approach and rationale." });
  r[405] = rate(outcomes, { 0: "No outcome.", 1: '"Built X" only.', 2: "Basic result.", 3: "Clear result.", 4: "Quantified result.", 5: "Quantified impact (users/metrics)." });
  r[406] = rate(linkScore(links), { 0: "No links.", 1: "Mentioned, no link.", 2: "One link.", 3: "Live or repo link.", 4: "Repo and live links.", 5: "Repo, live and portfolio linked." });
  r[407] = rate(relevance, { 0: "Irrelevant.", 1: "Tangential.", 2: "Partly relevant.", 3: "Relevant.", 4: "Strongly relevant.", 5: "Directly showcases target-role skills." });
  return r;
}

export function projectsApplicable(seg: Segmented, fullText: string, career: Career): boolean {
  if ((seg.sections["projects"] ?? "") !== "") return true;
  if (containsAny(fullText, ["project", "projects", "built a", "developed a", "created an app"])) return true;
  // Freshers and students are expected to show projects (they score low if missing); seniors get an N/A pass.
  return career.stage === "student" || career.stage === "fresher";
}

// Runs on UTF-8 bytes like PHP without /u: the "{3,60}" counts bytes, and "–" is three of them.
const ENTRY_LINE = new RegExp("^[A-Z].{3,60}(\\(|" + bin("–") + "|-|:)");

function projectCount(lines: string[], text: string): number {
  let bullets = 0;
  for (const l of lines) {
    if (/^[-•*◦▪‣]/u.test(l) || ENTRY_LINE.test(bin(l))) bullets++;
  }
  if (bullets > 0) return bullets;
  return Math.min(5, (text.match(/\bproject\b/gi) ?? []).length);
}

function contributionScore(text: string): number {
  if (/\b(sole|single-handedly|independently|individually|solo)\b/i.test(text)) return 5;
  if (rx(String.raw`\bI\s+(built|designed|developed|created|led|architected)\b`).test(text)) return 4;
  if (/\b(built|designed|developed|created|implemented)\b/i.test(text)) return 3;
  if (/\b(team|we|our)\b/i.test(text)) return 2;
  return text === "" ? 0 : 1;
}

function outcomeScore(text: string): number {
  const hasPct = rx(String.raw`\d+\s*%`).test(text);
  const hasNum = /\b\d[\d,]{2,}\b/.test(text);
  const hasResultVerb = /\b(increased|reduced|improved|grew|saved|boosted|achieved|drove|delivered|reached)\b/i.test(text);
  if ((hasPct || hasNum) && hasResultVerb) return 5;
  if (hasPct || hasNum) return 4;
  if (hasResultVerb) return 3;
  if (/\b(built|created|developed)\b/i.test(text)) return 1;
  return text === "" ? 0 : 2;
}

function linkScore(links: string[]): number {
  let repo = false, live = false, portfolio = false;
  for (const l of links) {
    if (l.includes("github") || l.includes("gitlab") || l.includes("bitbucket")) repo = true;
    else if (l.includes("portfolio") || l.includes("behance") || l.includes("dribbble")) portfolio = true;
    else if (l.includes("http") || l.includes("live at") || l.includes("play.google") || l.includes("www.")) live = true;
  }
  const n = (repo ? 1 : 0) + (live ? 1 : 0) + (portfolio ? 1 : 0);
  if (!links.length) return 0;
  if (n === 0) return 1;
  if (n === 1) return repo || live ? 3 : 2;
  if (n === 2) return 4;
  return 5;
}

function presence(has: boolean, own: boolean, count: number): number {
  if (!has) return 0;
  if (own && count >= 3) return 5;
  if (own && count >= 1) return 4;
  if (count >= 2) return 3;
  if (count >= 1) return 2;
  return 1;
}

function substance(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 2;
  if (count <= 3) return 3;
  if (count <= 5) return 4;
  return 5;
}
