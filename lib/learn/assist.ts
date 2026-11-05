import { plainText } from "./doc";
import { bullets, type Deck } from "./slides";
import { Calculator, formatValue, type SheetState } from "./sheet/engine";
import type { Activity, ActivityState } from "./types";

/**
 * The optional AI learning assistant. It is OFF unless LEARN_AI_ENABLED=true and an OpenAI key is configured (it reuses the site's
 * existing OPENAI_API_KEY / OPENAI_MODEL), and every lesson works without it. It can only talk about what the student chose to send:
 * the system prompt makes it say so when it has not seen their work, and the work text is built here, on the server, from what the
 * client sent, then cut to a fixed size.
 */
export const aiAvailable = (env: Record<string, string | undefined> = process.env): boolean => env.LEARN_AI_ENABLED === "true" && (env.OPENAI_API_KEY ?? "").length >= 20;

export const MAX_QUESTION = 400;
export const MAX_WORK_CHARS = 2800;

/** A plain-text view of the student's work, for the assistant. Formulas and their results are both shown. */
export function describeWork(state: ActivityState): string {
  let out = "";
  if (state.kind === "word") out = plainText(state.html);
  else if (state.kind === "slides") {
    const d: Deck = state.deck;
    out = d.slides.map((s, i) => `Slide ${i + 1} (${s.layout}): ${s.title || "(no title)"} | ${bullets(s.body).join("; ")}${s.body2 ? " | " + bullets(s.body2).join("; ") : ""}`).join("\n");
  } else if (state.kind === "sheet") {
    const sh: SheetState = state.sheet;
    const calc = new Calculator(sh.cells);
    out = Object.keys(sh.cells).sort((a, b) => (parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)) || a.localeCompare(b)).slice(0, 200).map((k) => {
      const raw = sh.cells[k];
      return raw.startsWith("=") ? `${k}: ${raw} -> ${formatValue(calc.value(k))}` : `${k}: ${raw}`;
    }).join("\n");
  } else if (state.kind === "sql") out = state.query;
  else if (state.kind === "dax") out = state.code;
  else if (state.kind === "viz") out = JSON.stringify({ view: state.spec, calculatedFields: state.calcs });
  else out = Object.entries(state.answers).map(([k, v]) => `${k}: ${v}`).join("\n");
  return out.slice(0, MAX_WORK_CHARS);
}

export interface AssistInput { activity: Activity | null; question: string; level: "beginner" | "intermediate"; work: string | null }

export function buildMessages(i: AssistInput): Array<{ role: "system" | "user"; content: string }> {
  const sys = [
    "You are a patient, friendly tutor on a free learning platform, helping beginners build everyday computer skills (computers, documents, spreadsheets, presentations, the internet, online safety, cloud tools and responsible AI).",
    `Explain for a ${i.level} learner in simple words and short sentences. Prefer a small example over a long lecture. Keep answers under 150 words.`,
    "Only help with the course topic and the current exercise. If asked about anything else, say you can only help with the course.",
    "Give hints first. Do not give the complete answer to the graded exercise unless the student explicitly asks for it, and then explain why it works.",
    i.work === null
      ? "The student has NOT shared their work with you. You cannot see their document, sheet or slides. Never say or imply that you checked, reviewed, opened or edited anything of theirs. If they ask you to check their work, tell them to press 'Check my work' for the official feedback or to tick 'Share my current work with the assistant'."
      : "The student chose to share a text copy of their current work (below). You can comment on it, but you cannot edit it and you do not mark it: only the 'Check my work' button gives official results. Do not claim to have seen anything beyond the text provided.",
    "Never ask for or repeat personal details such as full names, phone numbers, addresses, passwords or ID numbers; if the student shares any, tell them not to.",
  ].join("\n");
  const ctx = i.activity ? `Current exercise: "${i.activity.title}". Goal: ${i.activity.objective}\nSteps: ${i.activity.steps.join(" / ")}` : "No exercise is open; answer general questions about the course topics.";
  const work = i.work === null ? "" : `\n\nThe student's current work (text only):\n"""\n${i.work}\n"""`;
  return [{ role: "system", content: sys }, { role: "user", content: `${ctx}${work}\n\nQuestion: ${i.question.slice(0, MAX_QUESTION)}` }];
}
