import { z } from "zod";
import type { AiFacts, AiFeedback } from "./store";

/**
 * Optional AI-written feedback. OFF unless READING_AI_ENABLED=true and the site's OpenAI key is configured (the same OPENAI_API_KEY / OPENAI_MODEL
 * the rest of the portal uses). The AI only receives facts the scoring engine already computed; it cannot change a score, and anything it returns
 * must pass a strict schema and may not contain a number that is not in those facts. On any failure the studio shows its own deterministic wording
 * and nothing else changes.
 */
export const aiAvailable = (env: Record<string, string | undefined> = process.env): boolean => env.READING_AI_ENABLED === "true" && (env.OPENAI_API_KEY ?? "").length >= 20;

export const feedbackSchema = z.object({
  summary: z.string().min(10).max(420),
  focus: z.string().min(10).max(320),
  tips: z.array(z.string().min(5).max(200)).min(1).max(3),
}).strict();

/** Numbers that appear in the text, as digit strings. */
const numbersIn = (s: string): string[] => s.match(/\d+(?:\.\d+)?/g) ?? [];

/** Parse and check a model reply. Returns null for anything that is not valid structured output built only from the supplied facts. */
export function validateFeedback(raw: unknown, facts: AiFacts): AiFeedback | null {
  let obj: unknown = raw;
  if (typeof raw === "string") { try { obj = JSON.parse(raw); } catch { return null; } }
  const parsed = feedbackSchema.safeParse(obj);
  if (!parsed.success) return null;
  const allowed = new Set<string>();
  const add = (n: number | null) => { if (n !== null) { allowed.add(String(Math.round(n))); allowed.add(String(Math.round(n * 10) / 10)); } };
  add(facts.overall); add(facts.wpm);
  const text = [parsed.data.summary, parsed.data.focus, ...parsed.data.tips].join(" ");
  if (numbersIn(text).some((n) => !allowed.has(n))) return null; // an invented figure
  if (/\b(ielts|toefl|sat|gre|gmat|upsc|neet|jee)\b/i.test(text)) return null;
  return parsed.data;
}

export function buildMessages(f: AiFacts): Array<{ role: "system" | "user"; content: string }> {
  return [
    { role: "system", content: "You write brief, warm, specific feedback for a student who just did a reading assessment. You are given facts computed by a scoring engine. Use only those facts. Do not state any number except the overall score or words per minute if they are given. Do not mention exams. Do not criticise the student. Reply with JSON only: {\"summary\": string, \"focus\": string, \"tips\": string[1..3]}." },
    { role: "user", content: JSON.stringify(f) },
  ];
}

export async function aiFeedback(facts: AiFacts, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<AiFeedback | null> {
  if (!aiAvailable(env)) return null;
  try {
    const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-4.1", temperature: 0.4, max_tokens: 300, response_format: { type: "json_object" }, messages: buildMessages(facts) }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return validateFeedback(body.choices?.[0]?.message?.content ?? "", facts);
  } catch {
    return null;
  }
}
