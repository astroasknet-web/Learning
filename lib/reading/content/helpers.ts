import type { QuestionDraft } from "../content-model";
import type { Difficulty, Format, Mode, QType, SkillId } from "../taxonomy";

/** Compact authoring helpers for the seed bank. Every question carries its key and an explanation of why the key is supported and why a tempting option is not. */
export const TF_OPTIONS = ["True", "False", "The passage does not say"];

export function mc(ref: string, mode: Mode, skill: SkillId, qtype: QType, difficulty: Difficulty, expectedSecs: number, stem: string, options: string[], answer: number, explanation: string, format: Format = "mcq"): QuestionDraft {
  return { ref, mode, format, stem, options, answer, explanation, skill, qtype, difficulty, expectedSecs };
}

export function tf(ref: string, mode: Mode, skill: SkillId, qtype: QType, difficulty: Difficulty, expectedSecs: number, stem: string, answer: 0 | 1 | 2, explanation: string): QuestionDraft {
  return { ref, mode, format: "tf", stem, options: TF_OPTIONS, answer, explanation, skill, qtype, difficulty, expectedSecs };
}

export function match(ref: string, mode: Mode, skill: SkillId, qtype: QType, difficulty: Difficulty, expectedSecs: number, stem: string, left: string[], right: string[], answer: number[], explanation: string): QuestionDraft {
  return { ref, mode, format: "match", stem, options: { left, right }, answer, explanation, skill, qtype, difficulty, expectedSecs };
}

export function short(ref: string, mode: Mode, skill: SkillId, qtype: QType, difficulty: Difficulty, expectedSecs: number, stem: string, accepted: string[], explanation: string): QuestionDraft {
  return { ref, mode, format: "short", stem, options: [], answer: accepted, explanation, skill, qtype, difficulty, expectedSecs };
}
