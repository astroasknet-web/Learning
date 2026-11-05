import { COURSE_TITLE, LEVELS, MAX_LEVEL, totalModules, type Level } from "./curriculum";
import { frontier, isPlaced, levelAssessmentGate, levelStatus, type LevelStatus, type Progress } from "./rules";

/** The "My Learning Journey" view model: built from plain data so it can be tested without a database. */
export interface LevelCard {
  n: number; letter: string; title: string; summary: string;
  status: LevelStatus;
  /** True when the student began past this level: it counts as Completed but has not been assessed, and stays open to study. */
  placed: boolean;
  authored: boolean;
  modulesDone: number; modulesTotal: number;
  bestPct: number | null;
  assessmentReady: boolean;
}

export interface Journey {
  courseName: string;
  currentLevel: Level | null;
  /** Percent of the working level's modules finished. */
  moduleProgress: number;
  /** Percent of every module in the course finished. */
  overallProgress: number;
  modulesDone: number;
  modulesTotal: number;
  levels: LevelCard[];
  next: { label: string; href: string | null; note?: string };
}

export interface JourneyInput {
  enrolled: boolean;
  diagnosticDone: boolean;
  progress: Progress;
  bestPct: ReadonlyMap<number, number>;
  /** Any practice at all yet (to decide whether to suggest the placement check). */
  startedAnything: boolean;
}

export function buildJourney(i: JourneyInput): Journey {
  const f = frontier(i.progress);
  const levels: LevelCard[] = LEVELS.map((l) => {
    const status = levelStatus(l.n, i.progress);
    return {
      n: l.n, letter: l.letter, title: l.title, summary: l.summary, status, placed: isPlaced(l.n, i.progress), authored: l.authored,
      modulesDone: l.modules.filter((m) => i.progress.doneModules.has(m.key)).length, modulesTotal: l.modules.length,
      bestPct: i.bestPct.get(l.n) ?? null, assessmentReady: levelAssessmentGate(l.n, i.progress).ok,
    };
  });
  const current = f <= MAX_LEVEL ? LEVELS[f - 1] : null;
  const curDone = current ? current.modules.filter((m) => i.progress.doneModules.has(m.key)).length : 0;
  const total = totalModules();
  const done = [...i.progress.doneModules].length;
  return {
    courseName: COURSE_TITLE,
    currentLevel: current,
    moduleProgress: current ? Math.round((curDone / current.modules.length) * 100) : 100,
    overallProgress: Math.round((done / total) * 100),
    modulesDone: done,
    modulesTotal: total,
    levels,
    next: nextStep(i, f, current, curDone),
  };
}

function nextStep(i: JourneyInput, f: number, current: Level | null, curDone: number): Journey["next"] {
  if (!i.enrolled) return { label: "Start the course", href: "/math-speed/enrol" };
  if (!i.diagnosticDone && !i.startedAnything) return { label: "Take the placement check", href: "/math-speed/diagnostic", note: "About ten minutes. It finds the right level to begin at." };
  if (!current) return { label: "See your results", href: "/math-speed/progress", note: "You have completed every level." };
  if (!current.authored) return { label: `Level ${current.letter} opens soon`, href: null, note: "The lessons for this level are still being written." };
  const nextMod = current.modules.find((m) => !i.progress.doneModules.has(m.key));
  if (nextMod) return { label: curDone === 0 && !i.startedAnything ? "Start learning" : "Continue learning", href: `/math-speed/module/${nextMod.key}`, note: `Level ${current.letter}, Module ${nextMod.n}: ${nextMod.title}` };
  const gate = levelAssessmentGate(f, i.progress);
  return gate.ok ? { label: "Take the Level Assessment", href: `/math-speed/level/${current.letter}#assessment`, note: `Show what you know in Level ${current.letter} to unlock the next level.` } : { label: "Do your revision", href: `/math-speed/level/${current.letter}#assessment`, note: gate.reason };
}
