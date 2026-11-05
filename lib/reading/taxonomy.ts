/**
 * The Reading Studio's vocabulary: skills, question types, difficulty and the scoring dimensions they roll up into.
 * Student-facing words are neutral reading skills and levels. No exam names appear anywhere (a test scans every string a student can see).
 */
export type Group = "comprehension" | "inference" | "vocabulary" | "retention";
/** The six scored dimensions of the overall Reading Performance Score. */
export type Dimension = "comprehension" | "qa" | "inference" | "efficiency" | "vocabulary" | "retention";

export interface SkillInfo { label: string; group: Group; why: string; practice: string }

export const SKILLS = {
  main_idea: { label: "Main idea and theme", group: "comprehension", why: "Knowing what a passage is mostly about lets you decide quickly which details deserve attention.", practice: "After each paragraph, say its point in one sentence, then say what the whole passage is about." },
  details: { label: "Important facts and details", group: "comprehension", why: "Many questions in study and work depend on picking out exactly what a text states, not what you expect it to state.", practice: "Underline the who, what, when and how many in a passage, then answer without guessing." },
  fact_opinion: { label: "Fact versus opinion", group: "comprehension", why: "Telling what can be checked from what is believed protects you from accepting weak claims.", practice: "Mark each sentence F (can be checked) or O (a judgement) and look for the words that signal opinion." },
  relationships: { label: "Cause, effect and links between ideas", group: "comprehension", why: "Understanding why things happen, and how paragraphs connect, is what turns reading into understanding.", practice: "Draw an arrow between a cause and its effect each time a passage gives one, and note the linking words." },
  purpose_tone: { label: "Author's purpose and tone", group: "comprehension", why: "The same facts read differently depending on why they were written and how the author feels about them.", practice: "Ask: is the writer informing, persuading or warning, and which words show their attitude?" },
  data: { label: "Tables and short data", group: "comprehension", why: "Numbers in a table or a short data summary often hold the answer that the prose only hints at.", practice: "Read the title and headings first, then find the exact cell before comparing figures." },
  inference: { label: "Drawing inferences", group: "inference", why: "Writers rarely state everything. Inference is how you understand what is meant but not said.", practice: "For each conclusion you draw, point to the words in the passage that support it." },
  conclusion: { label: "Logical conclusions", group: "inference", why: "Choosing the conclusion that the text actually supports is the core of careful reading.", practice: "Test each possible conclusion by asking what in the passage would have to be true for it to hold." },
  assumptions: { label: "Assumptions and evidence", group: "inference", why: "Every argument rests on assumptions. Spotting them shows you where an argument is weak.", practice: "Ask: what must the writer believe for this evidence to prove this claim?" },
  arguments: { label: "Strength of arguments and unsupported claims", group: "inference", why: "Judging how well a claim is supported is what separates persuasive writing from sound writing.", practice: "Separate the claim from its evidence and ask whether the evidence is enough, relevant and fairly described." },
  contradiction: { label: "Spotting contradictions and inconsistency", group: "inference", why: "Noticing when two statements cannot both be true keeps you from absorbing muddled information.", practice: "When two statements seem to disagree, reread both and decide whether they really conflict or only differ in scope." },
  vocab_context: { label: "Word meaning in context", group: "vocabulary", why: "Most words have several meanings. Context tells you which one the writer intends.", practice: "Cover the word, predict a replacement from the sentence, then check which choice fits." },
  figurative: { label: "Idioms and figurative language", group: "vocabulary", why: "Idioms and figures of speech carry meaning that the literal words do not.", practice: "Ask what the phrase means if it is not literal, and what the sentence would say in plain words." },
  recall_details: { label: "Recalling details", group: "retention", why: "Remembering the specifics of what you read means you do not have to reread everything.", practice: "Close the text and write three facts you remember, then check what you missed." },
  recall_links: { label: "Recalling arguments and connections", group: "retention", why: "Retaining how ideas fit together is stronger than retaining a list of facts.", practice: "Retell the passage as a short chain: first this, because of that, so this." },
} as const satisfies Record<string, SkillInfo>;

export type SkillId = keyof typeof SKILLS;
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
export const isSkill = (s: string): s is SkillId => Object.prototype.hasOwnProperty.call(SKILLS, s);

export const QTYPES = {
  locate: "Finding what is directly stated",
  interpret: "Interpreting meaning",
  infer: "Inference",
  conclude: "Choosing the most appropriate conclusion",
  eliminate: "Eliminating incorrect options",
  negation: "Negative wording (NOT, EXCEPT)",
  multi_evidence: "Combining several pieces of evidence",
  supported: "Telling what sounds right from what is supported",
} as const;
export type QType = keyof typeof QTYPES;
export const isQType = (s: string): s is QType => Object.prototype.hasOwnProperty.call(QTYPES, s);

export type Difficulty = 1 | 2 | 3;
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: "Easy", 2: "Medium", 3: "Difficult" };

export type Format = "mcq" | "tf" | "conclusion" | "match" | "short";
export const FORMATS: Format[] = ["mcq", "tf", "conclusion", "match", "short"];
export type Mode = "diagnostic" | "practice" | "mastery" | "recall";
export const MODES: Mode[] = ["diagnostic", "practice", "mastery", "recall"];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  comprehension: "Reading comprehension",
  qa: "Question-answering accuracy",
  inference: "Inference and critical reading",
  efficiency: "Reading efficiency",
  vocabulary: "Vocabulary and context",
  retention: "Information retention",
};

/** Short labels for chart axes. */
export const DIMENSION_SHORT: Record<Dimension, string> = { comprehension: "Comprehension", qa: "Accuracy", inference: "Inference", efficiency: "Efficiency", vocabulary: "Vocabulary", retention: "Memory" };

export const GROUP_DIMENSION: Record<Group, Dimension> = { comprehension: "comprehension", inference: "inference", vocabulary: "vocabulary", retention: "retention" };

export type Kind = "diagnostic" | "practice" | "mastery" | "recall" | "timed" | "fresh" | "essay";
export const KIND_LABEL: Record<Kind, string> = { diagnostic: "Starting assessment", practice: "Level practice", mastery: "Mastery check", recall: "Delayed recall", timed: "Timed reading", fresh: "Fresh assessment", essay: "Essay reading test" };
