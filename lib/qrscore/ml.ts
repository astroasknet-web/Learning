import { model as loadModel } from "./data";
import { phpRound } from "./php";
import type { Career, Domain } from "./career-stage";
import type { Profile } from "./profile";
import type { SectionResult } from "./score-engine";

/**
 * Runtime for the learned layer of the hybrid model (port of Ml\FeatureVector, Ml\Model and Trainer::predict). Loads the
 * model.json trained offline (ridge regression over the feature vector), standardises features, predicts an
 * expert-aligned 0-100 score. Optional: with no model the engine stays pure rule-based.
 */
export interface MlInput {
  sections: SectionResult[];
  profile?: Partial<Profile> | Record<string, never>;
  career?: Partial<Career>;
  domain?: Partial<Domain>;
}

export function featureVector(result: MlInput): Record<string, number> {
  const sec = (id: number): number => {
    for (const s of result.sections) if (s.id === id) return Number(s.section_score ?? 0);
    return 0;
  };
  const param = (id: number): number => {
    for (const s of result.sections) {
      for (const p of s.parameters ?? []) {
        if (p.id === id) return p.na_applied ? 2.5 : Number(p.raw_score ?? 0);
      }
    }
    return 2.5;
  };
  const profile = (result.profile ?? {}) as Partial<Profile>;
  const techCount = Array.isArray(profile.skills?.technical) ? profile.skills.technical.length : 0;
  const domainKey = result.domain?.key ?? "general";
  const tech = ["software", "data", "ai", "cloud", "cybersecurity", "blockchain"].includes(domainKey) ? 1 : 0;

  return {
    edu_score: sec(1),
    exp_score: sec(2),
    skills_score: sec(3),
    projects_score: sec(4),
    impact_score: sec(5),
    years_experience: Math.min(40, Number(result.career?.yearsExperience ?? 0)),
    num_degrees: (profile.education ?? []).length,
    num_experience: (profile.experience ?? []).length,
    num_skills: techCount,
    num_certifications: (profile.certifications ?? []).length,
    num_projects: (profile.projects ?? []).length,
    num_awards: (profile.awards ?? []).length,
    quantified_impact: param(501),
    action_verbs: param(210),
    progression: param(204),
    domain_is_tech: tech,
  };
}

export function isReady(): boolean {
  const m = loadModel();
  return !!(m && m.weights?.length && m.features?.length);
}

/** Blend weight for the learned score (0..1); the rest is the rule score. */
export function blend(): number {
  const b = Number(loadModel().blend ?? 0.5);
  return Math.max(0, Math.min(1, b));
}

export function predict(result: MlInput): number | null {
  if (!isReady()) return null;
  const m = loadModel();
  const f = featureVector(result);
  let pred = Number(m.intercept ?? 0);
  m.features.forEach((name, i) => {
    const mean = Number(m.mean[i] ?? 0);
    const std = Number(m.std[i] ?? 1);
    const x = Number(f[name] ?? mean);
    const z = std > 1e-9 ? (x - mean) / std : 0;
    pred += Number(m.weights[i] ?? 0) * z;
  });
  return phpRound(Math.max(0, Math.min(100, pred)), 1);
}
