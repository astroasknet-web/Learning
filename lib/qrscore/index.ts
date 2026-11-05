import { rubric } from "./data";
import { inferCareer, detectDomain, type Career, type Domain } from "./career-stage";
import { parseEducation } from "./education-parser";
import { assessExtraction, type Extraction, type GateResult } from "./resume-gate";
import { blend, isReady, predict } from "./ml";
import { byteLen, phpRound } from "./php";
import { extractProfile, type Profile } from "./profile";
import { recommend } from "./recommender";
import { scoreSection, type SectionDef, type SectionResult } from "./score-engine";
import { segment, type Segmented } from "./segmenter";
import { scoreEducation } from "./scorers/education";
import { experienceApplicable, scoreExperience } from "./scorers/experience";
import { scoreImpact } from "./scorers/impact";
import { projectsApplicable, scoreProjects } from "./scorers/projects";
import { scoreSkills } from "./scorers/skills";
import type { RawScores } from "./scorers/types";
import { normalize } from "./text";

/**
 * GrowQR RQ (Resume Quality) Score engine, TypeScript port of the PHP engine (qrscore/src/QrScore.php).
 *
 *   const result = scoreText(resumeText);
 *   if (isScored(result)) console.log(result.overall.score);   // 0-100
 *
 * Deterministic and dependency-free: no AI or LLM is used at runtime. Same rubric, dictionaries and model JSON as the PHP
 * version, and the test-suite checks both engines return identical results on the same resumes.
 */
export interface Overall {
  score: number;
  scale: number;
  mode: "rule" | "hybrid";
  basis: string;
  rule_score?: number;
  ml_score?: number;
  ml_blend?: number;
  raw_points_earned: number;
  raw_points_applicable: number;
  sections_applicable: number;
  sections_planned: number;
}

export interface ScoredResult {
  engine: string;
  version: string;
  gate: GateResult;
  extraction: { source: string; method: string; confidence: string; text_length: number; note: string | null; text: string };
  career: Career;
  domain: Domain;
  profile: Profile;
  sections: SectionResult[];
  overall: Overall;
  grade: string;
  not_resume?: undefined;
}

export interface RefusedResult {
  engine: string;
  version: string;
  not_resume: true;
  gate: GateResult;
  extraction: { source: string; method: string; confidence: string; text_length: number; note: string | null };
}

export type QrResult = ScoredResult | RefusedResult;

export interface ScoreOptions {
  /** Refuse documents that are not resumes (default true, like the PHP engine). */
  checkResume?: boolean;
  /** Use the learned model when one is available (default true). */
  useMl?: boolean;
}

export function isScored(r: QrResult): r is ScoredResult {
  return !r.not_resume;
}

/** Score resume text that has already been extracted (or pasted). */
export function scoreText(raw: string, options: ScoreOptions = {}): QrResult {
  const extraction: Extraction = { text: normalize(raw), source: "pasted", method: "raw", confidence: "high" };
  return run(extraction, options);
}

/** Score an extraction produced elsewhere (for example a PDF or DOCX reader). */
export function scoreExtraction(extraction: Extraction, options: ScoreOptions = {}): QrResult {
  return run({ ...extraction, text: normalize(extraction.text), layout_text: extraction.layout_text ? normalize(extraction.layout_text) : extraction.layout_text }, options);
}

function run(extraction: Extraction, options: ScoreOptions): QrResult {
  const checkResume = options.checkResume ?? true;
  const useMl = options.useMl ?? true;
  const text = extraction.text;
  const meta = rubric();

  const gate = assessExtraction(extraction);
  if (checkResume && !gate.is_resume) {
    return {
      engine: meta.engine ?? "rq_score_engine",
      version: meta.version ?? "1.0.0",
      not_resume: true,
      gate,
      extraction: { source: extraction.source, method: extraction.method, confidence: extraction.confidence, text_length: byteLen(text), note: extraction.note ?? null },
    };
  }

  const seg = segment(text);
  const career = inferCareer(seg, text);
  const domain = detectDomain(text);
  const pps = Math.trunc(meta.scoring_model.points_per_section ?? 20);
  const planned = Math.trunc(meta.scoring_model.total_sections_planned ?? 5);

  const sectionsOut: SectionResult[] = [];
  let applicableCount = 0;
  let overallEarned = 0;
  let recommendations: unknown[] = [];

  for (const def of meta.sections as unknown as SectionDef[]) {
    if (!def.implemented) {
      sectionsOut.push({ id: def.id, name: def.name, implemented: false, applicable: false, note: "Rubric defined; scorer not yet implemented." } as unknown as SectionResult);
      continue;
    }
    const [raw, applicable] = analyzeSection(def.id, seg, text, career, domain);
    const result = scoreSection(def, raw, career, pps);
    result.implemented = true;
    result.applicable = applicable;
    if (!applicable) result.na_note = "Not applicable to this candidate; its weight is redistributed across the other sections.";
    if (def.id === 1) recommendations = recommend(result, raw, career, result.section_score, domain);
    sectionsOut.push(result);
    if (applicable) {
      applicableCount++;
      overallEarned += result.section_score;
    }
  }
  for (const s of sectionsOut) if (s.id === 1) s.recommendations = recommendations;

  const maxApplicable = applicableCount * pps;
  const ruleScore = maxApplicable > 0 ? phpRound((overallEarned / maxApplicable) * 100, 1) : 0;
  const profile = extractProfile(seg, text, career, domain);

  const partial = { sections: sectionsOut, profile, career, domain };
  const mlScore = useMl && isReady() ? predict(partial) : null;
  let finalScore: number;
  let overall: Overall;
  if (mlScore !== null) {
    const b = blend();
    finalScore = phpRound(b * mlScore + (1 - b) * ruleScore, 1);
    overall = {
      score: finalScore,
      scale: 100,
      mode: "hybrid",
      rule_score: ruleScore,
      ml_score: mlScore,
      ml_blend: b,
      basis: `Hybrid: ${b} learned + ${phpRound(1 - b, 2)} rule (over ${applicableCount}/${planned} applicable sections).`,
      raw_points_earned: 0,
      raw_points_applicable: 0,
      sections_applicable: 0,
      sections_planned: 0,
    };
  } else {
    finalScore = ruleScore;
    overall = { score: ruleScore, scale: 100, mode: "rule", basis: `Weighted across ${applicableCount} applicable section(s) of ${planned}.`, raw_points_earned: 0, raw_points_applicable: 0, sections_applicable: 0, sections_planned: 0 };
  }
  overall.raw_points_earned = phpRound(overallEarned, 2);
  overall.raw_points_applicable = maxApplicable;
  overall.sections_applicable = applicableCount;
  overall.sections_planned = planned;

  return {
    engine: meta.engine ?? "rq_score_engine",
    version: meta.version ?? "1.0.0",
    gate,
    extraction: { source: extraction.source, method: extraction.method, confidence: extraction.confidence, text_length: byteLen(text), note: extraction.note ?? null, text },
    career,
    domain,
    profile,
    sections: sectionsOut,
    overall,
    grade: grade(finalScore),
  };
}

function analyzeSection(id: number, seg: Segmented, text: string, career: Career, domain: Domain): [RawScores, boolean] {
  switch (id) {
    case 1:
      return [scoreEducation(parseEducation(seg, text)), true];
    case 2:
      return [scoreExperience(seg, text, career), experienceApplicable(seg, text, career)];
    case 3:
      return [scoreSkills(seg, text, domain), true];
    case 4:
      return [scoreProjects(seg, text, domain), projectsApplicable(seg, text, career)];
    case 5:
      return [scoreImpact(seg, text, career), true];
    default:
      return [{}, false];
  }
}

function grade(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Good";
  if (score >= 40) return "Needs work";
  return "Weak";
}

export { adviceFromAreas, adviceFromResult } from "./advice";
export { userMessage as gateMessage } from "./resume-gate";
export { setNowYear } from "./php";
