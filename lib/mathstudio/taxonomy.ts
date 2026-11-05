/**
 * The universal mathematics skill taxonomy for the Mathematics Studio. Every question from every test on the platform is mapped to one of these
 * TOPICS, grouped into AREAS for charts. The taxonomy is the one shared vocabulary that lets a weakness seen in a GRE mock and the same weakness
 * seen in the Mathematics Speed studio become ONE diagnosis.
 *
 * It is deliberately flat (area -> topic) rather than a deep tree, because the two live sources (GRE Quant, Mathematics Speed) tag at that grain and
 * a deeper tree would invent precision the data does not support. Administrators can rename, re-area, add, merge and deactivate topics in the console
 * (stored in `mx_topics`, seeded from here); the engine only ever refers to a topic by its stable `id`.
 */
export interface Area { id: string; name: string; hue: string }
export const AREAS: Area[] = [
  { id: "number", name: "Number & Arithmetic", hue: "#1F4E79" },
  { id: "algebra", name: "Algebra", hue: "#6B3FA0" },
  { id: "geometry", name: "Geometry & Measurement", hue: "#B4530F" },
  { id: "stats", name: "Statistics & Probability", hue: "#0F766E" },
  { id: "calculus", name: "Calculus & Advanced", hue: "#9C2F4A" },
  { id: "reasoning", name: "Reasoning & Problem Solving", hue: "#2F7D32" },
];
export const isArea = (s: string): boolean => AREAS.some((a) => a.id === s);

/** A cognitive skill the question draws on, separate from its topic. Used by the diagnosis engine to tell "does not know the topic" from "makes execution slips". */
export type Cognitive = "recall" | "procedure" | "concept" | "application" | "multistep" | "reasoning";
export const COGNITIVE_LABEL: Record<Cognitive, string> = {
  recall: "Fact recall", procedure: "Routine procedure", concept: "Conceptual understanding", application: "Applying to a new situation", multistep: "Multi-step problem solving", reasoning: "Abstract reasoning and proof",
};

export interface TopicDef { id: string; name: string; area: string; cognitive: Cognitive; prereq: string[] }
const t = (id: string, name: string, area: string, cognitive: Cognitive, prereq: string[] = []): TopicDef => ({ id, name, area, cognitive, prereq });

/**
 * The seed topics. Chosen to cover the universal areas in the specification AND to be the mapping targets for the two live sources. `prereq` names
 * the topics a student usually needs first; the diagnosis engine uses it to rank a foundational gap above a surface one.
 */
export const SEED_TOPICS: TopicDef[] = [
  // number & arithmetic
  t("mental-calc", "Mental calculation & speed", "number", "procedure"),
  t("number-properties", "Integers & number properties", "number", "concept"),
  t("divisibility", "Divisibility, factors & multiples", "number", "concept", ["number-properties"]),
  t("primes", "Primes & prime factorisation", "number", "concept", ["divisibility"]),
  t("remainders", "Remainders & modular reasoning", "number", "reasoning", ["divisibility"]),
  t("fractions-decimals", "Fractions & decimals", "number", "procedure", ["mental-calc"]),
  t("ratio-proportion", "Ratio, proportion & mixtures", "number", "application", ["fractions-decimals"]),
  t("percentages", "Percentages, profit, loss & interest", "number", "application", ["fractions-decimals"]),
  t("exponents-roots", "Exponents & roots", "number", "procedure", ["number-properties"]),
  t("rates-work-speed", "Rates, work & speed", "number", "multistep", ["ratio-proportion"]),
  // algebra
  t("algebra-basics", "Algebraic manipulation", "algebra", "procedure", ["exponents-roots"]),
  t("linear-equations", "Linear equations & systems", "algebra", "procedure", ["algebra-basics"]),
  t("quadratics", "Quadratic equations", "algebra", "procedure", ["linear-equations"]),
  t("inequalities", "Inequalities", "algebra", "reasoning", ["linear-equations"]),
  t("functions", "Functions & graphs", "algebra", "concept", ["linear-equations"]),
  t("sequences", "Sequences & series", "algebra", "concept", ["functions"]),
  t("word-problems", "Word problems & translation", "algebra", "multistep", ["linear-equations"]),
  // geometry & measurement
  t("lines-angles", "Lines & angles", "geometry", "concept"),
  t("triangles", "Triangles", "geometry", "concept", ["lines-angles"]),
  t("polygons", "Quadrilaterals & polygons", "geometry", "concept", ["triangles"]),
  t("circles", "Circles", "geometry", "concept", ["lines-angles"]),
  t("solids", "3-D figures & mensuration", "geometry", "application", ["polygons"]),
  t("coordinate-geometry", "Coordinate geometry", "geometry", "application", ["linear-equations"]),
  t("trigonometry", "Trigonometry", "geometry", "application", ["triangles"]),
  // statistics & probability
  t("descriptive-stats", "Descriptive statistics", "stats", "concept"),
  t("spread-stats", "Standard deviation, quartiles & percentiles", "stats", "concept", ["descriptive-stats"]),
  t("data-interpretation", "Data interpretation", "stats", "application", ["descriptive-stats"]),
  t("distributions", "Distributions & the normal curve", "stats", "concept", ["spread-stats"]),
  t("counting", "Counting methods", "stats", "reasoning"),
  t("probability", "Probability", "stats", "reasoning", ["counting"]),
  // calculus & advanced
  t("limits", "Limits & continuity", "calculus", "concept", ["functions"]),
  t("differentiation", "Differentiation", "calculus", "procedure", ["limits"]),
  t("integration", "Integration", "calculus", "procedure", ["differentiation"]),
  t("vectors-3d", "Vectors & 3-D geometry", "calculus", "application", ["coordinate-geometry"]),
  // reasoning & problem solving
  t("quant-comparison", "Quantitative comparison", "reasoning", "reasoning"),
  t("estimation", "Estimation & approximation", "reasoning", "application", ["mental-calc"]),
  t("multistep-problems", "Multi-step problem solving", "reasoning", "multistep", ["word-problems"]),
  t("olympiad-reasoning", "Advanced reasoning & proof", "reasoning", "reasoning", ["multistep-problems"]),
];

export const SEED_TOPIC_IDS = SEED_TOPICS.map((t) => t.id);
export const topicById = (id: string): TopicDef | undefined => SEED_TOPICS.find((t) => t.id === id);

/** Difficulty is normalised to 1..5 across all sources so a GRE "hard" and a Mathematics Speed level-9 item are comparable. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Foundational", 2: "Easy", 3: "Medium", 4: "Hard", 5: "Advanced" };
export const clampDifficulty = (n: number): Difficulty => (Math.min(5, Math.max(1, Math.round(n))) as Difficulty);

export type Format = "mcq" | "multi-select" | "numeric" | "quant-comparison" | "short" | "constructed";
/** The evidence label attached to every diagnostic, from how much relevant data stands behind it. */
export type Evidence = "insufficient" | "preliminary" | "developing" | "strong";
export const EVIDENCE_LABEL: Record<Evidence, string> = { insufficient: "Insufficient data", preliminary: "Preliminary insight", developing: "Developing evidence", strong: "Strong evidence" };

export const areaOf = (topicId: string): string => topicById(topicId)?.area ?? "reasoning";
