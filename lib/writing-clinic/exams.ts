/**
 * Writing Clinic: the exams it covers, their tasks, prompts and how a response is scored.
 * The prompts are original practice prompts written for this product; they are not copied from any test maker.
 */
export type ExamKey = "ielts" | "gre" | "gmat" | "sat" | "college";

export interface Task {
  key: string;
  name: string;
  minWords: number;
  minutes: number;
  /** Which scoring profile to use. "ielts-*" tasks use the IELTS band estimator. */
  kind: "ielts-task1" | "ielts-task2" | "issue" | "argument" | "analysis" | "personal";
  prompts: string[];
}

export interface Exam {
  key: ExamKey;
  name: string;
  short: string;
  scaleName: string;
  max: number;
  step: number;
  criteria: [string, string, string, string];
  blurb: string;
  tasks: Task[];
  tips: Array<{ title: string; points: string[] }>;
}

export const EXAMS: Exam[] = [
  {
    key: "ielts", name: "IELTS", short: "IELTS", scaleName: "Band", max: 9, step: 0.5,
    criteria: ["Task response", "Coherence and cohesion", "Lexical resource", "Grammar range and accuracy"],
    blurb: "Task 1 and Task 2, scored on the four official IELTS criteria.",
    tasks: [
      { key: "task2", name: "Task 2: essay", minWords: 250, minutes: 40, kind: "ielts-task2", prompts: [
        "Some people believe that unpaid community service should be a compulsory part of high school programmes. To what extent do you agree or disagree?",
        "In many countries, the amount of crime committed by teenagers is increasing. Discuss the causes of this problem and suggest some solutions.",
        "Some think governments should spend money on public services rather than the arts. Discuss both views and give your own opinion.",
        "More people now work from home. Do the advantages of this development outweigh the disadvantages?",
      ] },
      { key: "task1", name: "Task 1: report or letter", minWords: 150, minutes: 20, kind: "ielts-task1", prompts: [
        "The chart below shows the percentage of households with internet access in three countries between 2000 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
        "You recently stayed at a hotel and were unhappy with the service. Write a letter to the hotel manager. Explain why you were staying at the hotel, describe the problems, and say what you would like the manager to do.",
      ] },
    ],
    tips: [
      { title: "Task response", points: ["Underline every part of the question and check each one is answered.", "State a clear position in the introduction and keep it to the end.", "Develop each idea: claim, explanation, example."] },
      { title: "Coherence and cohesion", points: ["One central idea per paragraph, signalled in its first sentence.", "Use a range of linkers, but do not start every sentence with one."] },
      { title: "Lexical resource", points: ["Paraphrase the question instead of copying it.", "Swap vague words (good, bad, big) for precise ones."] },
      { title: "Grammar", points: ["Mix simple, compound and complex sentences.", "A correct simple sentence beats a broken complex one."] },
    ],
  },
  {
    key: "gre", name: "GRE Analytical Writing", short: "GRE", scaleName: "Score", max: 6, step: 0.5,
    criteria: ["Position and task", "Development and evidence", "Organisation", "Language and grammar"],
    blurb: "Analyse an Issue or an Argument, scored from 0 to 6.",
    tasks: [
      { key: "issue", name: "Analyse an Issue", minWords: 400, minutes: 30, kind: "issue", prompts: [
        "Governments should place more importance on long-term goals than on short-term needs. Discuss the extent to which you agree or disagree and explain your reasoning.",
        "Universities should require every student to study a foreign language, whatever their subject. Take a position and support it.",
        "Technological progress always makes life easier, but never makes it better. Write a response in which you discuss the extent to which you agree or disagree.",
        "Leaders are made by their circumstances, not born with special qualities. Discuss your view with reasons and examples.",
      ] },
      { key: "argument", name: "Analyse an Argument", minWords: 350, minutes: 30, kind: "argument", prompts: [
        "A town newspaper writes: 'Since the new bike lanes opened, shop sales on Main Street have fallen by ten per cent. To bring customers back, the council should remove the bike lanes.' Discuss how convincing you find this argument, and what would strengthen or weaken it.",
        "A company memo states: 'Employees who work four days a week were 15 per cent more productive last year than those who work five. So moving the whole company to a four-day week will raise productivity.' Examine the argument and its unstated assumptions.",
        "A health blog claims: 'People who drink green tea every day live longer. Therefore everyone should drink green tea daily to extend their lives.' Evaluate the reasoning.",
      ] },
    ],
    tips: [
      { title: "Position and task", points: ["Take a clear side in the first paragraph and say why in one sentence.", "For an Argument, do not give your own view: judge the reasoning."] },
      { title: "Development and evidence", points: ["Use specific examples, not general statements.", "Argument: name each assumption, say why it may be false, and what evidence would settle it."] },
      { title: "Organisation", points: ["Plan for three minutes: position, two or three points, order.", "Finish with a short conclusion that answers the task."] },
      { title: "Language and grammar", points: ["Vary sentence length and keep sentences controlled.", "Precise, formal vocabulary; proofread for agreement and articles."] },
    ],
  },
  {
    key: "gmat", name: "GMAT-style Argument Analysis", short: "GMAT", scaleName: "Score", max: 6, step: 0.5,
    criteria: ["Spotting flaws", "Support and evidence", "Organisation", "Language and grammar"],
    blurb: "Critique a business argument the way MBA and business-school applicants practise it.",
    tasks: [
      { key: "argument", name: "Critique an argument", minWords: 300, minutes: 30, kind: "argument", prompts: [
        "A retail chain's report says: 'Our stores in cities with a metro line earn 20 per cent more than stores elsewhere. To grow profit, we should open all new stores next to metro stations.' Analyse the reasoning and say what evidence would help judge it.",
        "A start-up founder argues: 'Our app's free users doubled after we added a leaderboard. If we add more game features, revenue will double too.' Discuss the flaws in this argument.",
        "A hotel manager writes: 'Guests who book through our own website rate their stay higher than guests who book through travel sites. So we should stop listing on travel sites to raise our ratings.' Critique the argument.",
      ] },
    ],
    tips: [
      { title: "Spotting flaws", points: ["Look for: correlation treated as cause, a small or unusual sample, a missing comparison, and an unstated assumption.", "Name the flaw in one clear sentence before you explain it."] },
      { title: "Support and evidence", points: ["For each flaw, give a plausible alternative explanation.", "Say what data you would ask for to test the claim."] },
      { title: "Organisation", points: ["Introduction: the conclusion in your own words. Body: one flaw per paragraph. Closing: what would make it stronger."] },
      { title: "Language and grammar", points: ["Write in a measured, professional tone.", "Avoid slang and long, tangled sentences."] },
    ],
  },
  {
    key: "sat", name: "SAT-style Analytical Essay", short: "SAT", scaleName: "Score", max: 4, step: 0.5,
    criteria: ["Reading the passage", "Analysis", "Organisation", "Language and grammar"],
    blurb: "Explain how an author builds an argument. Useful for SAT practice, school exams and college preparation.",
    tasks: [
      { key: "analysis", name: "Analyse how an author persuades", minWords: 300, minutes: 50, kind: "analysis", prompts: [
        "Read an opinion article of your choice (a newspaper editorial works well). Write an essay explaining how the author builds an argument to persuade the reader. Focus on evidence, reasoning and style, not on whether you agree.",
        "Choose a famous speech and explain how the speaker uses evidence, reasoning and persuasive devices such as repetition and emotional appeal to move the audience.",
        "Take a short science or health article. Explain how the writer uses facts, examples and word choice to make the case. Quote or refer to specific parts of the text.",
      ] },
    ],
    tips: [
      { title: "Reading the passage", points: ["Say what the author's main claim is in your first paragraph.", "Refer to exact parts of the text, not general impressions."] },
      { title: "Analysis", points: ["Explain how each device works on the reader, not only that it is there.", "Use verbs such as emphasises, builds, contrasts, appeals to."] },
      { title: "Organisation", points: ["Introduction, two or three body paragraphs on different techniques, short conclusion."] },
      { title: "Language and grammar", points: ["Clear, formal writing; vary sentence openings; proofread."] },
    ],
  },
  {
    key: "college", name: "College and SOP Essays", short: "College essays", scaleName: "Score", max: 4, step: 0.5,
    criteria: ["Personal voice", "Story and detail", "Organisation", "Language and grammar"],
    blurb: "Personal statements and statements of purpose for university and scholarship applications.",
    tasks: [
      { key: "personal", name: "Personal statement", minWords: 350, minutes: 45, kind: "personal", prompts: [
        "Describe a time you failed at something that mattered to you. What did you learn, and how did it change what you did next?",
        "Why do you want to study your chosen subject, and what have you already done to explore it?",
        "Tell the story of a person, place or object that shaped who you are today.",
        "Describe a problem you would like to help solve in your community or your field, and why you care about it.",
      ] },
    ],
    tips: [
      { title: "Personal voice", points: ["Write in the first person and sound like you, not like a brochure.", "Show what you thought and felt, not only what happened."] },
      { title: "Story and detail", points: ["One specific moment beats a list of achievements.", "Use concrete detail: names, numbers, places, small moments."] },
      { title: "Organisation", points: ["Open with the moment, not with a summary of your life.", "End by looking forward to what you will do next."] },
      { title: "Language and grammar", points: ["Plain, confident sentences. Cut filler and clichés."] },
    ],
  },
];

export const examByKey = (k: string): Exam => EXAMS.find((e) => e.key === k) ?? EXAMS[0];

/** Headline lines for the product. */
export const TAGLINES = {
  main: "Write better. Score higher.",
  sub: "The Writing Clinic for IELTS, GRE, GMAT, SAT and college essays. Practise on exam prompts, see your score on every criterion in seconds, and know exactly what to fix next.",
  more: [
    "Your essay, diagnosed in seconds.",
    "Stop guessing your score.",
    "Practise like it's test day. Improve like it's tomorrow.",
    "From first draft to top band.",
    "One clinic. Every exam essay.",
    "Find the one thing holding your score down.",
  ],
};
