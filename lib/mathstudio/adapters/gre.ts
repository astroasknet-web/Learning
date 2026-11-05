import * as gre from "../../tests/gre";
import { item, type MathAttempt } from "../contract";
import { topicById, type Cognitive } from "../taxonomy";

/**
 * Adapter: a finished GRE Quant mock -> the standardized MathAttempt. It re-reads the server-side question bank for mock `n` (topic id, difficulty,
 * correct answer) and the student's stored answers, so correctness and topic are authoritative and not trusted from the browser. The GRE player
 * records only the whole-test time, so each item carries `timeMs: null` and the engine honestly reports that per-question speed is not measured here.
 */
const TOPIC_MAP: Record<string, string> = {
  "number-properties": "number-properties", "divisibility-factors-multiples": "divisibility", "prime-factorization": "primes",
  "remainders": "remainders", "fractions-decimals": "fractions-decimals", "rates-work-speed": "rates-work-speed",
  "exponents-and-roots": "exponents-roots", "ratios-mixtures": "ratio-proportion", "systems-of-equations": "linear-equations",
  "inequalities": "inequalities", "functions": "functions", "coordinate-geometry": "coordinate-geometry", "word-problems": "word-problems",
  "lines-and-angles": "lines-angles", "triangles": "triangles", "quadrilaterals-polygons": "polygons", "circles": "circles", "solids": "solids",
  "descriptive-statistics": "descriptive-stats", "standard-deviation": "spread-stats", "counting-methods": "counting", "probability": "probability",
  "distributions": "distributions", "data-interpretation": "data-interpretation", "quantitative-comparison": "quant-comparison",
  "numeric-entry-multi-answer": "multistep-problems",
};
const DIFF: Record<string, number> = { easy: 2, medium: 3, hard: 4 };
export const GRE_SOURCE = "gre-quant";

/** Build the attempt from the stored row. `answers` is the decoded {questionId: pickedIndex}; `seconds` and `finishedAt` come from test_attempts. */
export function greAttempt(userId: number, testNo: number, answers: Record<string, number>, seconds: number, finishedAt: string): MathAttempt {
  const qs = gre.mock(testNo);
  const items = qs.map((q, i) => {
    const picked = answers[String(q.id)];
    const skipped = picked === undefined || picked === null || Number.isNaN(picked);
    const topic = TOPIC_MAP[q.topic] ?? "multistep-problems";
    const cognitive: Cognitive = topicById(topic)?.cognitive ?? "application";
    const format = q.topic === "quantitative-comparison" ? "quant-comparison" : q.topic === "numeric-entry-multi-answer" ? "numeric" : "mcq";
    return item({ ref: String(q.id ?? i), topic, cognitive, difficulty: DIFF[q.difficulty] ?? 3, format, correct: !skipped && picked === q.correct, skipped, timeMs: null, expectedSecs: null });
  });
  const total = Math.max(1, items.length);
  const finIso = new Date(finishedAt).toISOString();
  const started = new Date(new Date(finishedAt).getTime() - Math.max(0, seconds) * 1000).toISOString();
  return { v: 1, source: GRE_SOURCE, sourceRef: String(testNo), userId, label: `GRE Quant mock ${testNo}`, startedAt: started, finishedAt: finIso, totalMs: Math.max(0, seconds) * 1000, items: total ? items : [] };
}
