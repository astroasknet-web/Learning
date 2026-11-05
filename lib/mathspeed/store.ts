import "server-only";
import { randomBytes } from "node:crypto";
import { exec, first, pool, rows, tx, type Db } from "../pay/db";
import { ACHIEVEMENT_INFO, accuracyMaster, consistency, levelCompleted, speedImprovers, XP_LEVEL, XP_MODULE, xpForAnswers, type Earned } from "./achievements";
import { COURSE_TITLE, LEVELS, MAX_LEVEL, level, moduleByKey, skillsOfLevel, type Module } from "./curriculum";
import { applyOutcome, afterReview, dueSkills, newSkillState, scheduleNow, type SkillState } from "./mastery";
import { AGE_BANDS, COUNTRIES, LANGUAGES, PACES, localDay } from "./personalise";
import { markPlan, planBenchmark, planDiagnosticStage, planDrill, planFoundationCheck, planLevelAssessment, planMasteryAssessment, planPractice, planProgressAssessment, planReview, planRevision, type Answered, type Plan, type Response, type SessionKind } from "./plan";
import { frontier, isPlaced, levelAssessmentGate, masteryAssessmentGate, moduleOpen, modulePassed, nextProbe, progressAssessmentGate, recordProbe, startDiagnostic, verdict, type DiagState, type Progress, type Verdict } from "./rules";
import { skill } from "./skills";
import { courseAccess, freeSession } from "./access";

/** Everything the studio keeps about a student, and the one place that marks a session and applies its effects. All writes for a submission happen in one transaction. */
export interface Enrolment { userId: number; language: string; country: string; ageBand: string; pace: string; startLevel: number; diagnosticDone: boolean; xp: number; createdAt: string }
export interface LevelRow { level: number; completedAt: string | null; bestPct: number; attempts: number; revisionPending: boolean; weak: string[] }
export interface ModuleRow { key: string; readAt: string | null; bestPct: number; attempts: number; completedAt: string | null }

export interface Snapshot {
  enrolment: Enrolment;
  progress: Progress;
  levels: Map<number, LevelRow>;
  modules: Map<string, ModuleRow>;
  states: Map<string, SkillState>;
}

const iso = (s: string | null | undefined): string | null => (s ? new Date(String(s).replace(" ", "T") + "Z").toISOString() : null);
const dbTime = (d: Date | string): string => new Date(d).toISOString().slice(0, 19).replace("T", " ");

// ---- enrolment ------------------------------------------------------------------------------------------------------------

export async function getEnrolment(userId: number, db: Db = pool): Promise<Enrolment | null> {
  const r = await first(db, "SELECT * FROM ms_enrolments WHERE user_id = $1", [userId]);
  return r ? { userId, language: r.language, country: r.country, ageBand: r.age_band, pace: r.pace, startLevel: Number(r.start_level), diagnosticDone: Number(r.diagnostic_done) === 1, xp: Number(r.xp), createdAt: String(r.created_at) } : null;
}

export interface EnrolInput { language?: string; country?: string; ageBand?: string; pace?: string }

/** Enrol (or change the answers). Anything unrecognised falls back to a safe default, so a tampered form can store nothing odd. */
export async function enrol(userId: number, input: EnrolInput, db: Db = pool): Promise<Enrolment> {
  const language = LANGUAGES.find((l) => l.id === input.language && l.available)?.id ?? "en";
  const country = COUNTRIES.find((c) => c.code === String(input.country ?? "").toUpperCase())?.code ?? "XX";
  const ageBand = AGE_BANDS.find((a) => a.id === input.ageBand)?.id ?? "12-15";
  const pace = PACES.find((p) => p.id === input.pace)?.id ?? "regular";
  await exec(db, "INSERT INTO ms_enrolments (user_id, language, country, age_band, pace) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO UPDATE SET language = EXCLUDED.language, country = EXCLUDED.country, age_band = EXCLUDED.age_band, pace = EXCLUDED.pace", [userId, language, country, ageBand, pace]);
  return (await getEnrolment(userId, db))!;
}

// ---- reading a student's state ----------------------------------------------------------------------------------------------

export async function loadStates(userId: number, db: Db = pool): Promise<Map<string, SkillState>> {
  const out = new Map<string, SkillState>();
  for (const r of await rows(db, "SELECT skill, state_json FROM ms_skill_state WHERE user_id = $1", [userId])) {
    try { out.set(r.skill, { ...newSkillState(), ...(JSON.parse(r.state_json) as Partial<SkillState>) }); } catch { /* an unreadable row is treated as not started */ }
  }
  return out;
}

export async function snapshot(userId: number, db: Db = pool): Promise<Snapshot | null> {
  const enrolment = await getEnrolment(userId, db);
  if (!enrolment) return null;
  const levels = new Map<number, LevelRow>();
  for (const r of await rows(db, "SELECT * FROM ms_level_progress WHERE user_id = $1", [userId])) {
    let weak: string[] = [];
    try { weak = JSON.parse(r.weak_json) as string[]; } catch { /* none */ }
    levels.set(Number(r.level), { level: Number(r.level), completedAt: iso(r.completed_at), bestPct: Number(r.best_pct), attempts: Number(r.attempts), revisionPending: Number(r.revision_pending) === 1, weak });
  }
  const modules = new Map<string, ModuleRow>();
  for (const r of await rows(db, "SELECT * FROM ms_module_progress WHERE user_id = $1", [userId])) modules.set(r.module_key, { key: r.module_key, readAt: iso(r.read_at), bestPct: Number(r.best_pct), attempts: Number(r.attempts), completedAt: iso(r.completed_at) });
  const progress: Progress = {
    startLevel: enrolment.startLevel,
    completed: new Set([...levels.values()].filter((l) => l.completedAt).map((l) => l.level)),
    doneModules: new Set([...modules.values()].filter((m) => m.completedAt).map((m) => m.key)),
    revisionPending: new Set([...levels.values()].filter((l) => l.revisionPending).map((l) => l.level)),
  };
  return { enrolment, progress, levels, modules, states: await loadStates(userId, db) };
}

/** The number of levels, counted from A without a gap, that have all their lessons written: the levels a student can actually be placed into. */
export const playableLevels = (): number => { let n = 0; while (n < MAX_LEVEL && LEVELS[n].authored) n++; return n; };

/** Mark Learn and Understand as read for a module (needed before its Practise set can finish the module). */
export async function markRead(userId: number, key: string, db: Db = pool): Promise<void> {
  await exec(db, "INSERT INTO ms_module_progress (user_id, module_key, read_at) VALUES ($1,$2,NOW()) ON CONFLICT (user_id, module_key) DO UPDATE SET read_at = COALESCE(ms_module_progress.read_at, VALUES(read_at))", [userId, key]);
}

// ---- diagnostic ---------------------------------------------------------------------------------------------------------------

export async function getDiagnostic(userId: number, db: Db = pool): Promise<DiagState | null> {
  const r = await first(db, "SELECT state_json FROM ms_diagnostic WHERE user_id = $1", [userId]);
  if (!r) return null;
  try { return JSON.parse(r.state_json) as DiagState; } catch { return null; }
}

export async function beginDiagnostic(userId: number, db: Db = pool): Promise<DiagState> {
  const state = startDiagnostic(playableLevels());
  await exec(db, "INSERT INTO ms_diagnostic (user_id, state_json) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET state_json = EXCLUDED.state_json, recommended = NULL, started_at = NOW(), finished_at = NULL", [userId, JSON.stringify(state)]);
  return state;
}

/** Take the recommended level, or a lower one: a student may always begin earlier than advised, never later than the diagnostic supports. */
export async function chooseStart(userId: number, wanted: number, db: Db = pool): Promise<boolean> {
  const d = await getDiagnostic(userId, db);
  if (!d?.done || d.recommended === null) return false;
  const lv = Math.max(1, Math.min(d.recommended, Math.trunc(wanted)));
  await exec(db, "UPDATE ms_enrolments SET start_level = $1 WHERE user_id = $2", [lv, userId]);
  return true;
}

// ---- starting a session --------------------------------------------------------------------------------------------------------

export type StartResult = { ok: true; id: string } | { ok: false; code: "enrol" | "pay" | "gate" | "bad" | "coming"; error: string };
const fail = (code: Extract<StartResult, { ok: false }>["code"], error: string): StartResult => ({ ok: false, code, error });
const newSeed = (): number => randomBytes(4).readUInt32BE(0);

async function insertSession(userId: number, plan: Plan, db: Db): Promise<string> {
  const publicId = randomBytes(12).toString("hex");
  await exec(db, "DELETE FROM ms_sessions WHERE user_id = $1 AND status = 'open' AND created_at < NOW() - INTERVAL 2 DAY", [userId]);
  await exec(db, "INSERT INTO ms_sessions (public_id, user_id, kind, ref, plan_json) VALUES ($1,$2,$3,$4,$5)", [publicId, userId, plan.kind, plan.ref.slice(0, 12), JSON.stringify(plan)]);
  return publicId;
}

export async function startSession(userId: number, kind: SessionKind, ref: string, db: Db = pool, now = new Date()): Promise<StartResult> {
  const snap = await snapshot(userId, db);
  if (!snap) return fail("enrol", "Enrol first to start.");
  if (!freeSession(kind, ref) && (await courseAccess(userId)) === null) return fail("pay", "This part of the course needs the full course. Level A, Module 1 is free to try.");
  const { enrolment: en, progress, states } = snap;
  const seed = newSeed();
  const c = en.country, a = en.ageBand;
  let plan: Plan;
  switch (kind) {
    case "practice":
    case "drill": {
      const m: Module | null = moduleByKey(ref);
      if (!m) return fail("bad", "That module does not exist.");
      if (!LEVELS[m.level - 1].authored) return fail("coming", `Level ${LEVELS[m.level - 1].letter} is not open yet.`);
      if (!moduleOpen(m.level, m.n, progress)) return fail("gate", "Finish the module before this one first.");
      plan = kind === "practice" ? planPractice(m, states, seed, c, a) : planDrill(m, states, seed, c, a);
      break;
    }
    case "level": {
      const n = Number(ref);
      const lv = level(n);
      if (!lv) return fail("bad", "That level does not exist.");
      if (!lv.authored) return fail("coming", `Level ${lv.letter} is not open yet.`);
      const gate = levelAssessmentGate(n, progress);
      if (!gate.ok) return fail("gate", gate.reason ?? "Not open yet.");
      plan = planLevelAssessment(n, states, seed, c, a, undefined, snap.levels.get(n)?.weak ?? []);
      break;
    }
    case "progress": {
      const n = Number(ref);
      const lv = level(n);
      if (!lv || !lv.authored) return fail("coming", "That level is not open yet.");
      const gate = progressAssessmentGate(n, progress);
      if (!gate.ok) return fail("gate", gate.reason ?? "Not open yet.");
      plan = planProgressAssessment(n, [...progress.doneModules], states, seed, c, a);
      break;
    }
    case "mastery": {
      const n = Number(ref);
      const gate = masteryAssessmentGate(n, progress);
      if (!gate.ok) return fail("gate", gate.reason ?? "Not open yet.");
      plan = planMasteryAssessment(n, seed, c, a);
      break;
    }
    case "foundation": {
      const placed = LEVELS.map((l) => l.n).filter((n) => isPlaced(n, progress));
      if (!placed.length) return fail("gate", "You have no placed levels to check.");
      plan = planFoundationCheck(placed, seed, c, a);
      break;
    }
    case "revision": {
      const n = Number(ref);
      const row = snap.levels.get(n);
      if (!level(n)) return fail("bad", "That level does not exist.");
      const weak = row?.weak.length ? row.weak : skillsOfLevel(n).sort((x, y) => (states.get(x)?.mastery ?? 0) - (states.get(y)?.mastery ?? 0)).slice(0, 3);
      plan = planRevision(weak, states, seed, c, a, String(n));
      break;
    }
    case "review": {
      const due = dueSkills(states, now);
      if (!due.length) return fail("gate", "Nothing is due for review today.");
      plan = planReview(due, states, seed, c, a);
      break;
    }
    case "diagnostic": {
      let st = await getDiagnostic(userId, db);
      if (!st || st.done) {
        if (st?.done && en.diagnosticDone) return fail("gate", "You have already completed the placement check.");
        st = await beginDiagnostic(userId, db);
      }
      const lv = nextProbe(st);
      if (lv === null) return fail("gate", "The placement check is finished.");
      plan = planDiagnosticStage(lv, seed, c, a);
      break;
    }
    case "benchmark": {
      if (frontier(progress) < MAX_LEVEL && !progress.completed.has(MAX_LEVEL)) return fail("gate", "The benchmark opens when you reach Level O.");
      plan = planBenchmark(seed, c, a);
      break;
    }
    default:
      return fail("bad", "Unknown kind of session.");
  }
  return { ok: true, id: await insertSession(userId, plan, db) };
}

export interface StoredSession { id: string; plan: Plan; status: "open" | "submitted"; result: SessionResult | null; createdAt: string }

export async function getSession(userId: number, publicId: string, db: Db = pool): Promise<StoredSession | null> {
  if (!/^[0-9a-f]{24}$/.test(publicId)) return null;
  const r = await first(db, "SELECT public_id, plan_json, status, result_json, created_at FROM ms_sessions WHERE public_id = $1 AND user_id = $2", [publicId, userId]);
  if (!r) return null;
  try { return { id: r.public_id, plan: JSON.parse(r.plan_json) as Plan, status: r.status === "submitted" ? "submitted" : "open", result: r.result_json ? (JSON.parse(r.result_json) as SessionResult) : null, createdAt: String(r.created_at) }; } catch { return null; }
}

// ---- submitting and marking ------------------------------------------------------------------------------------------------------

export type SessionEvent =
  | { type: "module"; key: string; title: string }
  | { type: "level"; level: number; title: string }
  | { type: "achievement"; code: string; title: string; detail: string }
  | { type: "mastered"; skill: string; title: string }
  | { type: "placement"; level: number }
  | { type: "revision-done"; level: number }
  | { type: "note"; text: string };

export interface SessionResult {
  id: string; kind: SessionKind; ref: string;
  total: number; correct: number; accuracy: number; medianMs: number | null; inTime: number;
  passed: boolean | null; passMark: number | null;
  perSkill: Verdict["perSkill"]; weak: string[];
  answers: Array<{ skill: string; d: number; correct: boolean; ms: number; response: string }>;
  xp: number; seconds: number;
  events: SessionEvent[];
}

const passMarkOf = (kind: SessionKind, ref: string): number | null => {
  switch (kind) {
    case "practice": return 80;
    case "level": return level(Number(ref))?.pass ?? 80;
    case "mastery": return 85;
    case "diagnostic": return 80;
    case "revision": return 70;
    default: return null;
  }
};

/** Write learning states (the JSON is the truth; mastery and next review are copied to columns for queries). */
export async function putStates(userId: number, changed: Map<string, SkillState>, db: Db = pool): Promise<void> {
  for (const [id, s] of changed) {
    await exec(db, "INSERT INTO ms_skill_state (user_id, skill, state_json, mastery, attempts, next_review_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id, skill) DO UPDATE SET state_json = EXCLUDED.state_json, mastery = EXCLUDED.mastery, attempts = EXCLUDED.attempts, next_review_at = EXCLUDED.next_review_at", [userId, id, JSON.stringify(s), s.mastery, s.attempts, s.nextReviewAt ? dbTime(s.nextReviewAt) : null]);
  }
}

async function award(userId: number, e: Earned, db: Db, events: SessionEvent[]): Promise<boolean> {
  const n = await exec(db, "INSERT INTO ms_achievements (user_id, code, ref, detail) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, code, ref) DO NOTHING", [userId, e.code, e.ref.slice(0, 40), e.detail.slice(0, 200)]);
  if (n > 0) events.push({ type: "achievement", code: e.code, title: e.title, detail: e.detail });
  return n > 0;
}

/**
 * Mark a submitted session and apply everything it changes, once. A second submission of the same session returns the stored result.
 * The responses are only text and times: whether an answer is right is decided here, from the plan.
 */
export async function submitSession(userId: number, publicId: string, responses: Response[], now = new Date()): Promise<SessionResult | null> {
  if (!/^[0-9a-f]{24}$/.test(publicId)) return null;
  return tx(async (db) => {
    const row = await first(db, "SELECT id, plan_json, status, result_json, kind, ref FROM ms_sessions WHERE public_id = $1 AND user_id = $2 FOR UPDATE", [publicId, userId]);
    if (!row) return null;
    if (row.status === "submitted" && row.result_json) return JSON.parse(row.result_json) as SessionResult;
    const plan = JSON.parse(row.plan_json) as Plan;
    const snap = await snapshot(userId, db);
    if (!snap) return null;
    const answers = markPlan(plan, Array.isArray(responses) ? responses.slice(0, 200) : []);
    const events: SessionEvent[] = [];
    const states = new Map(snap.states);
    const changed = new Map<string, SkillState>();
    const per = new Map<string, { asked: number; right: number }>();

    // 1. skill learning state, answer by answer
    for (const a of answers) {
      const sk = skill(a.skill);
      if (!sk) continue;
      const before = states.get(a.skill) ?? newSkillState();
      const r = applyOutcome(before, { correct: a.correct, ms: a.ms, allowedMs: a.allowedMs, d: a.d }, sk.target, now);
      let next = r.state;
      if (plan.kind === "diagnostic" && a.correct) next = { ...next, d: Math.max(next.d, Math.min(10, a.d - 1)) }; // placement evidence raises where practice starts
      states.set(a.skill, next);
      changed.set(a.skill, next);
      if (r.becameMastered) events.push({ type: "mastered", skill: a.skill, title: sk.title });
      const e = per.get(a.skill) ?? { asked: 0, right: 0 };
      e.asked += 1;
      if (a.correct) e.right += 1;
      per.set(a.skill, e);
    }

    const passMark = passMarkOf(plan.kind, plan.ref);
    const v = verdict(answers, passMark ?? 0);
    const passed: boolean | null = passMark === null ? null : v.passed;
    let xp = xpForAnswers(answers);

    // 2. what this kind of session changes
    switch (plan.kind) {
      case "practice": {
        const m = moduleByKey(plan.ref);
        if (m) {
          const prev = snap.modules.get(m.key);
          const finish = modulePassed(v);
          await exec(db, "INSERT INTO ms_module_progress (user_id, module_key, best_pct, attempts) VALUES ($1,$2,$3,1) ON CONFLICT (user_id, module_key) DO UPDATE SET best_pct = GREATEST(ms_module_progress.best_pct, VALUES(best_pct)), attempts = ms_module_progress.attempts + 1", [userId, m.key, v.accuracy]);
          if (finish && !prev?.completedAt) {
            if (prev?.readAt) {
              await exec(db, "UPDATE ms_module_progress SET completed_at = NOW() WHERE user_id = $1 AND module_key = $2 AND completed_at IS NULL", [userId, m.key]);
              events.push({ type: "module", key: m.key, title: m.title });
              xp += XP_MODULE;
            } else events.push({ type: "note", text: "You passed the practice. Read Learn and Understand for this module to finish it." });
          }
        }
        break;
      }
      case "level": {
        const n = Number(plan.ref);
        const lv = level(n);
        const prev = snap.levels.get(n);
        if (lv) {
          if (passed) {
            await exec(db, "INSERT INTO ms_level_progress (user_id, level, completed_at, best_pct, attempts, revision_pending, weak_json) VALUES ($1,$2,NOW(),$3,1,0,'[]') ON CONFLICT (user_id, level) DO UPDATE SET completed_at = COALESCE(ms_level_progress.completed_at, NOW()), best_pct = GREATEST(ms_level_progress.best_pct, VALUES(best_pct)), attempts = ms_level_progress.attempts + 1, revision_pending = 0, weak_json = '[]'", [userId, n, v.accuracy]);
            if (!prev?.completedAt) {
              events.push({ type: "level", level: n, title: lv.title });
              xp += XP_LEVEL;
              await award(userId, levelCompleted(n), db, events);
            }
          } else {
            await exec(db, "INSERT INTO ms_level_progress (user_id, level, best_pct, attempts, revision_pending, weak_json) VALUES ($1,$2,$3,1,1,$4) ON CONFLICT (user_id, level) DO UPDATE SET best_pct = GREATEST(ms_level_progress.best_pct, VALUES(best_pct)), attempts = ms_level_progress.attempts + 1, revision_pending = IF(ms_level_progress.completed_at IS NULL, 1, 0), weak_json = VALUES(weak_json)", [userId, n, v.accuracy, JSON.stringify(v.weak)]);
          }
        }
        break;
      }
      case "revision": {
        const n = Number(plan.ref);
        if (passed && level(n)) {
          const n0 = await exec(db, "UPDATE ms_level_progress SET revision_pending = 0 WHERE user_id = $1 AND level = $2 AND revision_pending = 1", [userId, n]);
          if (n0 > 0) events.push({ type: "revision-done", level: n });
        }
        break;
      }
      case "diagnostic": {
        const st = (await getDiagnostic(userId, db)) ?? startDiagnostic(playableLevels());
        const lvl = Number(plan.ref);
        const next = recordProbe(st, lvl, v.correct, v.total);
        await exec(db, "INSERT INTO ms_diagnostic (user_id, state_json, recommended, finished_at) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO UPDATE SET state_json = EXCLUDED.state_json, recommended = EXCLUDED.recommended, finished_at = EXCLUDED.finished_at", [userId, JSON.stringify(next), next.recommended, next.done ? dbTime(now) : null]);
        if (next.done && next.recommended !== null) {
          await exec(db, "UPDATE ms_enrolments SET start_level = $1, diagnostic_done = 1 WHERE user_id = $2", [next.recommended, userId]);
          events.push({ type: "placement", level: next.recommended });
        }
        break;
      }
      case "review":
      case "mastery":
      case "foundation":
      case "progress": {
        for (const [id, e] of per) {
          const s = states.get(id);
          if (!s) continue;
          const acc = e.right / e.asked;
          let nextState = s;
          if (plan.kind === "review" || plan.kind === "mastery") nextState = afterReview(s, e.asked, e.right, now);
          else if (e.asked >= 2 && acc < 0.7) nextState = scheduleNow(s, now); // a gap: bring the skill back into the daily review straight away
          if (nextState !== s) { states.set(id, nextState); changed.set(id, nextState); }
        }
        if (plan.kind === "mastery" && passed) events.push({ type: "note", text: "Mastery Assessment passed. Your earlier skills are fresh again." });
        break;
      }
      default:
        break;
    }

    // 3. rows, state, activity, xp, achievements
    await putStates(userId, changed, db);
    for (let i = 0; i < answers.length; i += 40) {
      const chunk = answers.slice(i, i + 40);
      const vals: unknown[] = [];
      const ph = chunk.map((a, k) => { const b = vals.length; vals.push(Number(row.id), i + k, a.skill, a.d, a.response.slice(0, 64), a.correct ? 1 : 0, a.ms, a.allowedMs); return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`; });
      await exec(db, `INSERT INTO ms_attempts (session_id, idx, skill, d, response, correct, ms, allowed_ms) VALUES ${ph.join(",")}`, vals);
    }
    const day = localDay(snap.enrolment.country, now);
    if (answers.length) await exec(db, "INSERT INTO ms_activity_days (user_id, day, questions) VALUES ($1,$2,$3) ON CONFLICT (user_id, day) DO UPDATE SET questions = ms_activity_days.questions + VALUES(questions)", [userId, day, answers.length]);
    await exec(db, "UPDATE ms_enrolments SET xp = xp + $1 WHERE user_id = $2", [xp, userId]);

    if (plan.kind !== "diagnostic") {
      const am = accuracyMaster(answers);
      if (am) await award(userId, am, db, events);
      for (const s of speedImprovers(states)) if (changed.has(s.ref)) await award(userId, s, db, events);
      const days = (await rows(db, "SELECT day FROM ms_activity_days WHERE user_id = $1 ORDER BY day DESC LIMIT 120", [userId])).map((r) => String(r.day).slice(0, 10));
      for (const c of consistency(days, day)) await award(userId, c, db, events);
    }

    const result: SessionResult = {
      id: publicId, kind: plan.kind, ref: plan.ref,
      total: v.total, correct: v.correct, accuracy: v.accuracy, medianMs: v.medianMs, inTime: v.inTime,
      passed, passMark, perSkill: v.perSkill, weak: v.weak,
      answers: answers.map((a) => ({ skill: a.skill, d: a.d, correct: a.correct, ms: a.ms, response: a.response })),
      xp, seconds: plan.seconds, events,
    };
    await exec(db, "UPDATE ms_sessions SET status = 'submitted', submitted_at = NOW(), total = $1, correct = $2, accuracy = $3, median_ms = $4, passed = $5, result_json = $6 WHERE id = $7", [v.total, v.correct, v.accuracy, v.medianMs, passed === null ? null : passed ? 1 : 0, JSON.stringify(result), Number(row.id)]);
    return result;
  });
}

// ---- reading history --------------------------------------------------------------------------------------------------------------

export async function achievementsOf(userId: number, db: Db = pool): Promise<Array<{ code: string; title: string; detail: string; earnedAt: string }>> {
  return (await rows(db, "SELECT code, detail, earned_at FROM ms_achievements WHERE user_id = $1 ORDER BY earned_at DESC, id DESC", [userId])).map((r) => ({ code: r.code, title: ACHIEVEMENT_INFO[r.code as keyof typeof ACHIEVEMENT_INFO]?.title ?? r.code, detail: r.detail, earnedAt: String(r.earned_at) }));
}

export async function practiceDays(userId: number, db: Db = pool): Promise<string[]> {
  return (await rows(db, "SELECT day FROM ms_activity_days WHERE user_id = $1 ORDER BY day DESC LIMIT 120", [userId])).map((r) => String(r.day).slice(0, 10));
}

export interface HistoryPoint { at: string; kind: string; ref: string; accuracy: number; medianMs: number | null; total: number }
export async function recentSessions(userId: number, limit = 12, db: Db = pool): Promise<HistoryPoint[]> {
  return (await rows(db, "SELECT kind, ref, accuracy, median_ms, total, submitted_at FROM ms_sessions WHERE user_id = $1 AND status = 'submitted' AND total > 0 ORDER BY submitted_at DESC, id DESC LIMIT $2", [userId, limit])).map((r) => ({ at: String(r.submitted_at), kind: r.kind, ref: r.ref, accuracy: Number(r.accuracy), medianMs: r.median_ms === null ? null : Number(r.median_ms), total: Number(r.total) }));
}

export async function benchmarks(userId: number, db: Db = pool): Promise<HistoryPoint[]> {
  return (await rows(db, "SELECT kind, ref, accuracy, median_ms, total, submitted_at FROM ms_sessions WHERE user_id = $1 AND kind = 'benchmark' AND status = 'submitted' ORDER BY submitted_at ASC, id ASC LIMIT 50", [userId])).map((r) => ({ at: String(r.submitted_at), kind: r.kind, ref: r.ref, accuracy: Number(r.accuracy), medianMs: r.median_ms === null ? null : Number(r.median_ms), total: Number(r.total) }));
}

export { COURSE_TITLE };
export type { Answered };
