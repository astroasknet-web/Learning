import { containsAny } from "../text";
import { rx } from "../php";
import type { EduFeatures } from "../education-parser";
import type { RawScore, RawScores } from "./types";

/**
 * Maps education features onto the 0-5 rubric for each of the 15 parameters in Section 1 (port of Score\EducationScorer).
 * Deterministic and versioned; calibrate against labelled resumes to raise accuracy.
 */
export function scoreEducation(f: EduFeatures): RawScores {
  return {
    1: p1(f), 2: p2(f), 3: p3(f), 4: p4(f), 5: p5(f), 6: p6(f), 7: p7(f), 8: p8(f),
    9: p9(f), 10: p10(f), 11: p11(f), 12: p12(f), 13: p13(f), 14: p14(f), 15: p15(f),
  };
}

const r = (score: number, reason: string): RawScore => ({ score: Math.max(0, Math.min(5, Math.trunc(score))), reason });

function bestEntry(f: EduFeatures, fn: (e: EduFeatures["entries"][number]) => number): number {
  let best = 0;
  for (const e of f.entries) best = Math.max(best, fn(e));
  return best;
}

function p1(f: EduFeatures): RawScore {
  if (!f.hasEducationSection) return r(0, "No qualifications detected.");
  const own = f.educationIsOwnSection;
  const first = f.highestFirst;
  const pres = f.presentation.score;
  if (own && first && f.presentation.bullets && pres >= 4) return r(5, "Highest qualification is in its own section, listed first and visually prioritised.");
  if (own && first) return r(4, "Highest qualification is clear and prioritised in a dedicated section.");
  if (first && !own) return r(3, "Highest qualification identifiable but not in a clearly separated section.");
  if (!first) return r(2, "Highest qualification is present but buried below lesser/older degrees.");
  return r(1, "Qualifications present but lack clear hierarchy.");
}

function p2(f: EduFeatures): RawScore {
  let score = bestEntry(f, (e) => {
    if (e.degreeFull && e.classification) return 5;
    if (e.degreeFull) return 4;
    if (e.abbrevOnly) return 3;
    if (e.informal) return 1;
    return 0;
  });
  if (score <= 1 && containsAny(f.educationBlock, ["college degree", "uni", "university degree"])) score = Math.max(score, 2);
  const labels: Record<number, string> = { 0: "Degree name unstated.", 1: 'Degree highly ambiguous (e.g. "Graduated").', 2: "Generic/informal degree naming.", 3: "Standard but abbreviated degree name.", 4: "Clear standard degree naming.", 5: "Full official nomenclature with classification." };
  return r(score, labels[score]);
}

function p3(f: EduFeatures): RawScore {
  const score = bestEntry(f, (e) => {
    if (e.institutionVague) return 1; // vague descriptors take precedence even though they contain an institution keyword
    if (e.institution && e.institutionLocation) return 5;
    if (e.institution) return 4;
    if (rx(String.raw`\b[A-Z][a-z]+\s+[A-Z][a-z]+`).test(e.raw)) return 3; // proper-noun name without an institution keyword
    if (/\b[A-Z]{2,5}\b/.test(e.raw)) return 2; // bare acronym
    return 0;
  });
  const labels: Record<number, string> = { 0: "Institution unstated.", 1: 'Vague institution ("local college").', 2: "Acronym-only institution.", 3: "Common name, lacks location/campus.", 4: "Full formal institution name.", 5: "Full institution name with city/country/campus." };
  return r(score, labels[score]);
}

function p4(f: EduFeatures): RawScore {
  let score = bestEntry(f, (e) => {
    if (e.fieldSpecific && e.minor) return 4;
    if (e.fieldSpecific) return 3;
    if (e.broadOnly) return 1;
    return 0;
  });
  if (score >= 4 && containsAny(f.educationBlock, ["specialization", "specialisation", "concentration", "focus"])) score = 5;
  if (score === 1 && containsAny(f.educationBlock, ["management", "administration"])) score = 2;
  const labels: Record<number, string> = { 0: "Field/specialisation unstated.", 1: 'Overly broad field ("Business").', 2: "General field stated.", 3: "Specific major stated.", 4: "Major and minor/concentration defined.", 5: "Exact specialisation with focus areas." };
  return r(score, labels[score]);
}

function p5(f: EduFeatures): RawScore {
  const d = f.dates;
  if (!d.anyDate) return r(0, "No education dates provided.");
  if ((d.ongoing && d.expectedGraduation) || (d.anyMonths && d.allStartEnd)) return r(5, "Precise timeline with months and/or expected graduation.");
  if (d.anyMonths && d.allStartEnd) return r(4, "Start and end months/years provided.");
  if (d.allStartEnd) return r(3, "Start and end years provided.");
  if (d.anyYearOnly) return r(2, "Graduation year provided clearly.");
  return r(1, "Only a vague graduation year provided.");
}

function p6(f: EduFeatures): RawScore {
  const labels: Record<number, string> = { 1: "Chronological (oldest first).", 2: "Mostly reverse-chronological with errors.", 3: "Reverse-chronological order.", 4: "Reverse-chronological with clear separation.", 5: "Perfect reverse-chronology." };
  return r(f.reverseChrono.score, labels[f.reverseChrono.score] ?? "Chronology assessed.");
}

function p14(f: EduFeatures): RawScore {
  const labels: Record<number, string> = { 1: "Overlapping/conflicting timelines.", 2: "Formatting varies between entries.", 3: "Consistent formatting, minor ambiguity.", 4: "Logical progression, consistent structure.", 5: "Flawless structural consistency across all entries." };
  return r(f.consistency.score, labels[f.consistency.score] ?? "Consistency assessed.");
}

function p15(f: EduFeatures): RawScore {
  const labels: Record<number, string> = { 0: "Unreadable block text.", 1: "Poorly spaced, hard to parse.", 2: "Basic lists, weak typographic hierarchy.", 3: "Clean, standard layout.", 4: "Strong white space, bullets, contrast.", 5: "Optimal ATS-friendly layout with clear hierarchy." };
  return r(f.presentation.score, labels[f.presentation.score] ?? "Presentation assessed.");
}

function p7(f: EduFeatures): RawScore {
  const a = f.academic;
  if (containsAny(f.educationBlock, ["good grades", "good marks", "excellent grades"]) && !a.hasGpa) return r(1, "Vague academic claims without metrics.");
  if (!a.hasGpa && !a.rankPercentile) return r(0, "No academic achievements listed.");
  if (a.rankPercentile && (f.honors.hasSelectivity || containsAny(f.educationBlock, ["summa cum laude", "magna cum laude"]))) return r(5, "Quantified academic superiority (rank + distinction).");
  if (a.rankPercentile) return r(4, "Strong metrics including rank/percentile.");
  if (a.hasGpa && a.gpaHasScale) return r(3, "GPA/grade with scale context.");
  return r(2, "Basic GPA/grade without scale context.");
}

function p8(f: EduFeatures): RawScore {
  const h = f.honors;
  if (!h.found) return r(0, "No academic honours listed.");
  if (h.hasSelectivity) return r(5, "High-level award with selectivity context.");
  if (h.hasScholarship) return r(4, "Prestigious scholarships/awards detailed.");
  if (h.hasDatedContext) return r(3, "Honours listed with dates/semesters.");
  if (h.count >= 1) return r(2, "Basic listing of honours/societies.");
  return r(1, "Honours mentioned without context.");
}

function p9(f: EduFeatures): RawScore {
  const c = f.coursework;
  if (!c.found) return r(0, "No relevant coursework listed.");
  if (c.projectMapped) return r(5, "Coursework mapped to specific project applications.");
  if (c.contextualized) return r(4, "Coursework contextualised with skills learned.");
  if (c.dataDump) return r(1, "Exhaustive data-dump of all classes.");
  if (c.count >= 3 && c.count <= 8) return r(3, "Curated list of relevant advanced courses.");
  return r(2, "Basic list of major-related courses.");
}

function p10(f: EduFeatures): RawScore {
  const t = f.thesis;
  if (!t.found) return r(0, "No thesis/research information listed.");
  if (t.hasPublicationOrFunding) return r(5, "Research scope with funding/published outcomes.");
  if (t.hasMethodOrFindings) return r(4, "Clear methodology and core findings.");
  if (t.hasAdvisor) return r(3, "Title, topic and advisor/committee mentioned.");
  if ((t.detailCount ?? 0) >= 1) return r(2, "Title and basic topic provided.");
  return r(1, "Thesis title only, vaguely stated.");
}

function p11(f: EduFeatures): RawScore {
  const p = f.professional;
  if (!p.found) return r(0, "No professional qualifications listed.");
  if (p.hasLicense) return r(p.hasDates ? 5 : 4, "Includes active status/licence details.");
  if (p.hasIssuingBody && p.hasDates) return r(3, "Name, issuing body and dates provided.");
  if (p.hasIssuingBody) return r(2, "Full name provided, no dates/issuing body.");
  return r(1, "Acronyms only, no context.");
}

function p12(f: EduFeatures): RawScore {
  const v = f.vocational;
  if (!v.found) return r(0, "No vocational/technical training listed.");
  if (v.hasHours) return r(v.hasInstitutionDate ? 5 : 4, "Includes hours/competencies gained.");
  if (v.hasInstitutionDate) return r(3, "Certificate, institution and date clear.");
  return r(2, "Certificate name provided.");
}

function p13(f: EduFeatures): RawScore {
  const i = f.international;
  if (!i.found) return r(0, "Domestic qualifications only.");
  if (i.credentialEval && i.gradingScale) return r(5, "Original degree, accredited equivalency and translated grading scale.");
  if (i.credentialEval) return r(4, "Formal credential evaluation mentioned (e.g. WES).");
  if (i.equivalencyLoose) return r(3, "Equivalency loosely stated.");
  if (i.translated) return r(2, "Translated name, grading scale unclear.");
  return r(1, "Foreign degree with no context/translation.");
}

