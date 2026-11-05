import { z } from "zod";
import { clampDifficulty, SEED_TOPIC_IDS, type Cognitive, type Difficulty, type Format } from "./taxonomy";

/**
 * The standardized assessment-completion contract. EVERY online test on the platform — the GRE Quant mocks, the Mathematics Speed studio, and any
 * future module — describes a finished attempt in this one shape, and the Mathematics Studio engine knows nothing else about where it came from.
 * This is the single integration point the specification asks for: add a new test by writing an adapter that returns a `MathAttempt`, not by
 * touching the engine.
 *
 * Versioned (`v`) so the stored normalisation can be reprocessed when the contract changes. Idempotent: `source` + `sourceRef` identify an attempt,
 * so re-ingesting the same attempt updates in place and never double-counts.
 */
export const CONTRACT_VERSION = 1;

/** One answered (or skipped) question, already mapped to the universal taxonomy by the adapter. */
export interface MathItem {
  /** Stable reference within the source attempt (a question id or index), for idempotent per-item storage. */
  ref: string;
  /** A seed taxonomy topic id. The adapter is responsible for the mapping; an unknown id is rejected by the validator. */
  topic: string;
  cognitive: Cognitive;
  difficulty: Difficulty;
  format: Format;
  /** Marks awarded and the maximum, so partial credit and multi-mark questions are first-class (not every question is worth 1). */
  credit: number;
  maxMarks: number;
  correct: boolean;
  skipped: boolean;
  /** Milliseconds spent, or null when the source does not record per-question time (e.g. the GRE mocks record only the whole-test time). */
  timeMs: number | null;
  /** A reasonable solving time for this item, if the source knows one; used for the speed benchmark. */
  expectedSecs: number | null;
}

export interface MathAttempt {
  v: number;
  source: string;
  sourceRef: string;
  userId: number;
  /** A human label for the test, shown in the studio ("GRE Quant mock 4", "Mathematics Speed: Level C assessment"). */
  label: string;
  startedAt: string;
  finishedAt: string;
  /** Whole-attempt duration in ms from the source clock. */
  totalMs: number;
  items: MathItem[];
}

export const itemSchema = z.object({
  ref: z.string().min(1).max(64),
  topic: z.string().refine((s) => SEED_TOPIC_IDS.includes(s), "unknown taxonomy topic"),
  cognitive: z.enum(["recall", "procedure", "concept", "application", "multistep", "reasoning"]),
  difficulty: z.number().int().min(1).max(5),
  format: z.enum(["mcq", "multi-select", "numeric", "quant-comparison", "short", "constructed"]),
  credit: z.number().min(0),
  maxMarks: z.number().min(0),
  correct: z.boolean(),
  skipped: z.boolean(),
  timeMs: z.number().int().min(0).max(3 * 3600_000).nullable(),
  expectedSecs: z.number().min(1).max(3600).nullable(),
}).refine((i) => i.credit <= i.maxMarks + 1e-9, "credit cannot exceed the maximum marks");

export const attemptSchema = z.object({
  v: z.literal(CONTRACT_VERSION),
  source: z.string().min(1).max(40),
  sourceRef: z.string().min(1).max(64),
  userId: z.number().int().positive(),
  label: z.string().min(1).max(120),
  startedAt: z.string(),
  finishedAt: z.string(),
  totalMs: z.number().int().min(0).max(24 * 3600_000),
  items: z.array(itemSchema).min(1).max(500),
});

export type ValidatedAttempt = z.infer<typeof attemptSchema>;

/** Validate an adapter's output. Returns the attempt or a list of problems; the ingest layer rejects (never silently drops) an invalid attempt. */
export function validateAttempt(a: unknown): { ok: true; attempt: ValidatedAttempt } | { ok: false; errors: string[] } {
  const r = attemptSchema.safeParse(a);
  if (r.success) return { ok: true, attempt: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
}

/** A small helper for adapters: build an item, clamping difficulty and defaulting the marks to a right/wrong question worth one mark. */
export function item(p: { ref: string; topic: string; cognitive: Cognitive; difficulty: number; format?: Format; correct: boolean; skipped?: boolean; timeMs?: number | null; expectedSecs?: number | null; credit?: number; maxMarks?: number }): MathItem {
  const maxMarks = p.maxMarks ?? 1;
  const correct = p.correct;
  return {
    ref: p.ref, topic: p.topic, cognitive: p.cognitive, difficulty: clampDifficulty(p.difficulty), format: p.format ?? "mcq",
    credit: p.credit ?? (p.skipped ? 0 : correct ? maxMarks : 0), maxMarks, correct, skipped: p.skipped ?? false,
    timeMs: p.timeMs ?? null, expectedSecs: p.expectedSecs ?? null,
  };
}
