import type { PassageDraft } from "../content-model";
import { DIAGNOSTIC } from "./diagnostic";
import { LEVELS_AE } from "./levels-1";
import { LEVELS_FJ } from "./levels-2";

export interface Lesson { objectives: string[]; lesson: string[]; tips: string[]; completion: string }
export interface LevelSeed { key: string; position: number; name: string; objective: string; lesson: Lesson; passPct: number; minQuestions: number; masterySize: number; timed: boolean }

/** The ten starting levels. Administrators can rename, reorder, add or change them in the console; the algorithm refers to a level only by key and the numbers stored with it. */
const L = (key: string, position: number, name: string, objective: string, lesson: Lesson, extra: Partial<LevelSeed> = {}): LevelSeed => ({ key, position, name, objective, lesson, passPct: 75, minQuestions: 4, masterySize: 6, timed: false, ...extra });

export const SEED_LEVELS: LevelSeed[] = [
  L("A", 1, "Reading Foundations", "Read short, clear texts accurately and find what they say.", {
    objectives: ["Read a short passage once, calmly, and keep track of who and what it is about", "Find facts that are stated directly", "Use the sentence around a word to understand it"],
    lesson: ["A good reader does not rush to the questions. Read the passage through once, at an easy pace, and ask yourself: who is this about, and what happens?", "When a question asks for a fact, go back to the passage and find the exact words. Your memory of a text is less reliable than the text itself.", "If a word is new, read the sentence before and after it. Nearby words usually tell you enough."],
    tips: ["Read with a finger or pencil only if it helps you keep your place", "Check every answer against the words on the page", "Do not choose an answer because it sounds familiar"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
  L("B", 2, "Understanding Main Ideas", "Say what a passage and each paragraph is mainly about, and how ideas connect.", {
    objectives: ["Put each paragraph into one sentence", "Separate the main idea from supporting detail", "Follow a cause to its effect"],
    lesson: ["The main idea is the point that every paragraph helps to make. If a sentence answers 'what is this passage mostly about?', it is probably a main idea. If it gives an example, it is probably a detail.", "Many paragraphs have a simple job: introduce, explain, give an example, or warn. Naming the job helps you see how the passage fits together.", "Look for linking words such as because, so, therefore and however. They show you how one idea leads to another."],
    tips: ["After each paragraph, say its point out loud in one sentence", "A good main idea covers the whole passage, not just one part", "Be wary of options that are true but only cover a detail"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
  L("C", 3, "Finding Important Information", "Locate exact facts, including in tables and short data, and handle questions with negative wording.", {
    objectives: ["Find specific facts quickly without rereading everything", "Read a small table and compare figures", "Answer questions that use NOT or EXCEPT"],
    lesson: ["Questions often use different words from the passage. Choose the key words in the question, then scan for them, or for words that mean the same.", "In a table, read the title and headings first, then find the row and the column before you compare. Check what the numbers measure.", "A question with NOT or EXCEPT asks you to find the one option that is false or missing. Check each option against the text one at a time."],
    tips: ["Underline NOT and EXCEPT before you look at the options", "Say the unit of a figure (minutes, pupils, per cent) before you compare", "When you compute something, check it against the passage's own figures"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
  L("D", 4, "Vocabulary in Context", "Work out word meaning from context, including idioms and figures of speech.", {
    objectives: ["Choose the meaning that fits the sentence when a word has several", "Understand common idioms and comparisons", "Tell a vocabulary problem from a comprehension problem"],
    lesson: ["Most common words have more than one meaning. 'Current' can be electricity, the present time or a flow of water. The sentence around the word chooses for you.", "To work out a word, cover it, guess a replacement from the sentence, then check which option is closest to your guess.", "An idiom means something different from its separate words. Ask what the writer is saying in plain language."],
    tips: ["Test your choice by putting it back into the sentence", "A figure of speech compares: ask what the two things share", "If you can answer other questions but not word questions, vocabulary is the thing to build"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
  L("E", 5, "Drawing Inferences", "Work out what is meant but not stated, and keep to what the text supports.", {
    objectives: ["Draw an inference and point to the words that support it", "Tell a supported conclusion from a merely plausible one", "Use details that a writer includes for a reason"],
    lesson: ["An inference is a conclusion the text makes reasonable without stating it. It must rest on something written, not on what you happen to believe.", "A tempting wrong answer is often plausible: it could be true, but nothing in the passage supports it. Ask for each option: where does the text back this up?", "Writers include details for a reason. When a detail seems odd, ask what it lets you work out."],
    tips: ["Say 'because the passage says...' before you choose", "Prefer the option that needs the fewest extra assumptions", "Beware of words like always, never, all and most when the text says 'some' or 'often'"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
  L("F", 6, "Understanding Arguments", "Separate claims from evidence, find assumptions, and tell fact from opinion.", {
    objectives: ["Pick out a writer's claim and the evidence for it", "Find the assumption an argument depends on", "Tell reported fact from opinion and judgement"],
    lesson: ["An argument has a claim and reasons. Ask: what is being asserted, and what is offered to support it?", "An assumption is something the writer treats as true without saying so. If the assumption fails, the argument weakens. Ask: what must be true for this evidence to prove this claim?", "Facts can be checked; opinions are judgements. Words like should, best and likely often signal opinion."],
    tips: ["Mark the claim, then underline the evidence", "Ask whether the evidence is enough, relevant and fairly described", "Notice who is speaking: the author, or someone the author is reporting"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
  L("G", 7, "Advanced Comprehension", "Follow a longer, more demanding passage and judge the author's purpose, tone and consistency.", {
    objectives: ["Follow a layered explanation across several paragraphs", "Judge the author's attitude and purpose", "Spot statements that conflict with the passage"],
    lesson: ["In demanding passages, the author often qualifies a claim: 'too simple', 'it is true that... but'. Read for the turn in the argument, not just the first claim.", "Tone shows in word choice. Ask whether the author is informing, persuading or warning, and how strongly.", "To test whether a statement contradicts the passage, find the sentence it would conflict with. If you cannot, it may simply be outside the passage."],
    tips: ["Mark the sentence where the author changes direction", "Distinguish 'the passage does not say' from 'the passage says the opposite'", "Check the extreme words in an option against the author's careful ones"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
  L("H", 8, "Reading Under Time Constraints", "Keep your accuracy while reading and answering to a clock.", {
    objectives: ["Read at a steady pace without losing meaning", "Decide quickly what each question needs", "Keep to a time plan without rushing"],
    lesson: ["Speed counts only together with understanding. A fast read followed by wrong answers is not progress; the studio never gives credit for speed alone.", "Plan your time: read once at a steady pace, then answer each question by going to the part of the passage that holds the answer.", "Your reading time is recorded as an estimate from when the passage is on the screen until you say you have finished. Skimming or leaving the page open will make the estimate unreliable."],
    tips: ["Read once, steadily, without going back every line", "Answer the questions you are sure of first", "If a question takes too long, mark it and return"], completion: "Complete the timed practice, then reach 75% on the mastery check.",
  }, { timed: true }),
  L("I", 9, "Complex Passage Analysis", "Analyse a dense passage: its argument, its evidence and its limits.", {
    objectives: ["Summarise a dense argument in a few lines", "Judge how far a finding supports a claim", "Notice what the author does not claim"],
    lesson: ["Dense passages often reverse an expectation: they present a common view, then complicate it. Track where each paragraph stands: view, evidence, limit, lesson.", "A careful author draws a narrow conclusion from limited evidence. A good answer is as narrow as the author's, not broader.", "When two options both seem right, the better one usually depends on fewer unstated assumptions."],
    tips: ["Write a four-line outline: view, evidence, limit, lesson", "Compare the strength of each option's words with the strength of the author's", "Ask what the evidence cannot show"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
  L("J", 10, "Advanced Reading Mastery", "Read critically and flexibly across any subject, keeping accuracy, pace and judgement together.", {
    objectives: ["Judge arguments, evidence and tone in one pass", "Choose the best-supported conclusion among close options", "Maintain accuracy and pace together"],
    lesson: ["At this level, the questions are close. Most options are partly true. Your task is to find the one that the passage supports most fully and most narrowly.", "Combine the skills: find the claim, check the evidence, notice the tone and test the conclusion against what the author actually says.", "Keep checking your pace. Mastery is being accurate at a comfortable speed, not being fast."],
    tips: ["Eliminate options for what they claim beyond the text", "Check every answer against a specific sentence", "Review your errors after every set: they teach more than your correct answers"], completion: "Complete the practice, then reach 75% on the mastery check.",
  }),
];

export const SEED_PASSAGES: PassageDraft[] = [...DIAGNOSTIC, ...LEVELS_AE, ...LEVELS_FJ];
