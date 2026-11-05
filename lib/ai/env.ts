/**
 * Environment contract for the AI fallback layer.
 *
 * Shared by three callers so configuration resolves from ONE definition
 * instead of drifting copies: the debug route (app/api/debug/openai), the
 * health script (scripts/ai-health.ts), and lib/ai/answer.ts — the actual
 * request-path caller, live per docs/salesiq-bot/AI_FALLBACK_DESIGN.md
 * (STATUS: LIVE, SCOPE-LIMITED, revised 2026-08-02).
 */
import { z } from "zod";

/**
 * Design default, per AI_FALLBACK_DESIGN.md §2: a non-reasoning model, because
 * reasoning tokens add latency VARIANCE and the SalesIQ webhook has a hard
 * 5-second cap. Overridable via OPENAI_MODEL so a model change is config, not a
 * deploy of new code.
 *
 * Upgraded from gpt-4.1-mini to gpt-4.1 (2026-08-03): live conversations showed
 * the mini model declining questions it had enough context to answer (e.g.
 * "is it live in USA?" with market status already in the prompt) rather than
 * following the grounding rules precisely. Same non-reasoning family, so the
 * latency profile this budget depends on is unchanged.
 */
export const DEFAULT_MODEL = "gpt-4.1";

/** Hard ceiling for any verification call. See §2's 2,200ms production budget. */
export const TIMEOUT_MS = 5_000;

const schema = z.object({
  // Length rather than a `sk-` prefix check: OpenAI has changed key prefixes
  // before (sk-, sk-proj-, sk-svcacct-), and a format assertion that ages badly
  // fails closed on a perfectly good key. Length catches the real error case —
  // an empty or placeholder value.
  OPENAI_API_KEY: z
    .string()
    .min(20, "OPENAI_API_KEY is set but implausibly short — placeholder value?"),
  OPENAI_MODEL: z.string().min(1).default(DEFAULT_MODEL),
  // Tri-state on purpose: absent is meaningfully different from "false", and
  // this reports which it was rather than collapsing both to falsy.
  BOT_AI_ENABLED: z.enum(["true", "false"]).optional(),
});

export interface AiConfig {
  apiKey: string;
  model: string;
  /** True only when explicitly "true". Absent or malformed reads as disabled. */
  aiEnabled: boolean;
  /** Did OPENAI_MODEL supply the model, or did DEFAULT_MODEL? */
  modelSource: "env" | "default";
  /** Was BOT_AI_ENABLED actually present? Absent is a config gap worth naming. */
  aiEnabledSource: "env" | "unset";
}

export class AiConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join("; "));
    this.name = "AiConfigError";
  }
}

/**
 * Fail fast: throws AiConfigError listing EVERY problem at once, rather than
 * surfacing them one deploy at a time.
 */
export function loadAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const parsed = schema.safeParse({
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_MODEL: env.OPENAI_MODEL,
    BOT_AI_ENABLED: env.BOT_AI_ENABLED,
  });

  if (!parsed.success) {
    throw new AiConfigError(
      parsed.error.issues.map((i) => {
        const name = i.path.join(".") || "env";
        return i.code === "invalid_type" && i.message.includes("undefined")
          ? `${name} is missing`
          : `${name}: ${i.message}`;
      }),
    );
  }

  return {
    apiKey: parsed.data.OPENAI_API_KEY,
    model: parsed.data.OPENAI_MODEL,
    aiEnabled: parsed.data.BOT_AI_ENABLED === "true",
    modelSource: env.OPENAI_MODEL ? "env" : "default",
    aiEnabledSource: parsed.data.BOT_AI_ENABLED === undefined ? "unset" : "env",
  };
}

/**
 * The structured log line. Deliberately never includes the key itself — only
 * whether one is present — so this is safe in any log sink.
 */
export interface AiConfigLog {
  hasKey: boolean;
  model: string;
  aiEnabled: boolean;
}

export function configLog(config: AiConfig): AiConfigLog {
  return { hasKey: Boolean(config.apiKey), model: config.model, aiEnabled: config.aiEnabled };
}
