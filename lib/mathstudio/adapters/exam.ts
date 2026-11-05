import { item, type MathAttempt, type MathItem } from "../contract";
import { clampDifficulty, topicById, type Cognitive } from "../taxonomy";

/**
 * Adapter: the platform's full-length mock exams (JEE Main and the other `content/lms/exams` mocks) and the IMO olympiad mocks -> MathAttempt. These
 * mocks are mixed-subject and self-study (the answer key is shown at the end), so this adapter takes the MATHEMATICS questions only and builds the
 * attempt from the per-question outcome the mock player computed. A question whose subject or topic is not mathematics maps to null and is dropped,
 * so a JEE Physics question never pollutes a student's maths profile.
 */
export interface GradedQ {
  /** The mock's section/subject label (e.g. "Mathematics", "Physics", or an IMO section key). */
  section?: string;
  /** The question's topic label, where the mock has one. */
  topic?: string;
  difficulty?: number;
  correct: boolean;
  skipped: boolean;
  marks: number;
  maxMarks: number;
}

/** Subjects that are not mathematics; their questions are excluded from a maths profile. */
const NON_MATHS_SECTION = /physics|chemistry|biology|english|general\s*(studies|awareness|knowledge)|current affairs|reasoning\b(?!.*math)|science(?!.*math)/i;
/** Keywords that place a maths topic label into the universal taxonomy. First match wins. */
const TOPIC_RULES: Array<[RegExp, string]> = [
  [/trig|inverse trig/i, "trigonometry"],
  [/integrat/i, "integration"],
  [/different|derivative/i, "differentiation"],
  [/limit|continuit/i, "limits"],
  [/vector|three.?dimension|3.?d geometry/i, "vectors-3d"],
  [/hyperbola|parabola|ellipse|conic/i, "coordinate-geometry"],
  [/coordinate|straight line|distance formula|section formula/i, "coordinate-geometry"],
  [/circle/i, "circles"],
  [/triangle|pythag/i, "triangles"],
  [/quadrilateral|polygon|parallelogram|rectangle|square\b/i, "polygons"],
  [/solid|volume|surface area|mensurat|cone|cylinder|sphere/i, "solids"],
  [/angle|line/i, "lines-angles"],
  [/permutation|combinat|counting/i, "counting"],
  [/probab/i, "probability"],
  [/statistic|mean|median|mode|average|standard deviation|variance|data interpret/i, "descriptive-stats"],
  [/sequence|series|progression|a\.?p\.?|g\.?p\./i, "sequences"],
  [/matri|determinant|system of equation/i, "linear-equations"],
  [/quadratic|root|modulus|complex|nth root|unity/i, "quadratics"],
  [/inequalit/i, "inequalities"],
  [/logarithm|^log\b|exponent|power|radical|surd|indices/i, "exponents-roots"],
  [/function|relation|domain|range/i, "functions"],
  [/percent|profit|loss|interest|discount/i, "percentages"],
  [/ratio|proportion|mixture|partner/i, "ratio-proportion"],
  [/fraction|decimal/i, "fractions-decimals"],
  [/speed|time.*work|rate/i, "rates-work-speed"],
  [/divisib|factor|multiple|hcf|lcm/i, "divisibility"],
  [/prime/i, "primes"],
  [/remainder|modul/i, "remainders"],
  [/number|integer|digit|place value/i, "number-properties"],
  [/word problem|application/i, "word-problems"],
  [/estimat|approx/i, "estimation"],
];
/** IMO sections (all mathematics) map to a reasonable universal topic. */
const IMO_SECTION: Record<string, string> = {
  "logical-reasoning": "olympiad-reasoning", "mathematical-reasoning": "multistep-problems", "everyday-math": "word-problems", "achievers": "olympiad-reasoning",
};

export function mapExamTopic(section: string | undefined, topic: string | undefined, treatAllAsMaths: boolean): string | null {
  const sec = (section ?? "").toLowerCase();
  if (!treatAllAsMaths && NON_MATHS_SECTION.test(sec)) return null;
  if (IMO_SECTION[sec]) {
    // an IMO question: prefer its own topic words if it has them, else the section's default
    if (topic) for (const [re, t] of TOPIC_RULES) if (re.test(topic)) return t;
    return IMO_SECTION[sec];
  }
  const text = `${topic ?? ""} ${section ?? ""}`;
  for (const [re, t] of TOPIC_RULES) if (re.test(text)) return t;
  // a Mathematics-section question we could not place: keep it as a multi-step maths problem rather than dropping it
  if (treatAllAsMaths || /math|quant|numeric|arith|aptitude/i.test(sec)) return "multistep-problems";
  return null;
}

export function buildMockAttempt(userId: number, source: string, sourceRef: string, label: string, finishedAt: string, totalMs: number, graded: GradedQ[], opts: { allMaths?: boolean } = {}): MathAttempt {
  const items: MathItem[] = [];
  graded.forEach((g, i) => {
    const topic = mapExamTopic(g.section, g.topic, !!opts.allMaths);
    if (!topic) return;
    const cognitive: Cognitive = topicById(topic)?.cognitive ?? "application";
    items.push(item({ ref: `${sourceRef}:${i}`, topic, cognitive, difficulty: clampDifficulty(g.difficulty ?? 3), format: "mcq", correct: g.correct, skipped: g.skipped, credit: g.skipped ? 0 : Math.max(0, g.correct ? g.maxMarks : 0), maxMarks: Math.max(1, g.maxMarks || 1), timeMs: null, expectedSecs: null }));
  });
  return { v: 1, source, sourceRef, userId, label, startedAt: new Date(new Date(finishedAt).getTime() - Math.max(0, totalMs)).toISOString(), finishedAt: new Date(finishedAt).toISOString(), totalMs: Math.max(0, totalMs), items };
}
