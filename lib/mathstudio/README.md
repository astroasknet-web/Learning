# Mathematics Studio: design, operation and deployment

A central mathematics performance engine. Every maths test on the platform feeds it through one standardized contract, and it turns the results into topic mastery, evidence-based weaknesses, charts and a practice plan.

Student routes: `/math-studio` (public), `/math-studio/dashboard`, `/math-studio/topics`, `/math-studio/weaknesses`, `/math-studio/plan`, `/math-studio/history`, `/math-studio/attempt/[id]`.
Admin routes: `/console/math`, `/console/math/settings`, `/console/math/export`.
Code: `lib/mathstudio/` (engine, store, adapters, admin), `components/mathstudio/`, `app/(portal)/math-studio/`, `app/(portal)/console/math/`, `app/math-studio/`. Migration `db/migrations/20261227000001_math_studio.sql`. Tables `mx_*`. Backfill `scripts/mathstudio-backfill.ts`.

## 1. Audit (Phase 1): what feeds the engine

| Source | What it records | How it maps | Per-question time? |
|---|---|---|---|
| **GRE Quant mocks** (`lib/tests/gre.ts`, `test_attempts` where `exam='gre-quant'`) | raw/total/scaled, total test seconds, `answers_json` = {questionId: pickedIndex}. Per-question topic (26), difficulty (easy/medium/hard) and correctness are re-derived server-side by re-reading the bank. | `adapters/gre.ts` (26 topics → taxonomy, easy/medium/hard → difficulty 2/3/4) | **No** — the player records only the whole-test time, so these items carry `timeMs: null` and speed is honestly "not measured" for them. |
| **Mathematics Speed studio** (`lib/mathspeed`, `ms_attempts` via `ms_sessions`) | per-answer skill, difficulty `d` (1–10), correctness, `ms` (time), `allowed_ms`. | `adapters/mathspeed.ts` (156 skills → taxonomy by keyword, `d` → ceil(d/2)) | **Yes** — drives the speed and timing diagnostics. |
| **JEE Main (and other LMS mocks: NEET, UPSC, SSC)** (`content/lms/exams/*.json`, player `components/lms/MockTest`) | mixed-subject mock, each question with a `section` (subject) and a maths `topic`, `correct`, `marks`, `neg`. **Not persisted** before the Studio. | `adapters/exam.ts` — takes the **Mathematics** section only, maps its topics; NEET has no maths, UPSC/SSC contribute their quantitative questions. | **No** (whole-test timer only). |
| **IMO olympiad mocks** (`app/olympiad/imo`, `assembleImoMock`) | a full-syllabus mock across four sections (logical/mathematical reasoning, everyday maths, achievers), each question `correct`. **Not persisted** before the Studio. | `adapters/exam.ts` (all maths; section → taxonomy, section-level granularity). | **No**. |

**SAT**: the platform's SAT Math is *lesson* content (`content/lms/study/sat-math`), not an auto-gradable test — there are no per-question keys to grade — so there is **no SAT attempt data to ingest**, and the Studio does not fabricate any. It will show SAT the moment a gradable SAT Math test exists (one adapter call). Also not integrated: IELTS (not maths); CAT/GMAT maths tests do not exist on the platform yet. The contract means each connects later through a small adapter.

Reused, not rebuilt: the stack (Next.js 15, React 19, TS, Tailwind, zod, vitest, MySQL via `mysql2` with the `$1`/`ON CONFLICT`/`RETURNING` translator), auth (`currentUser`, role `student`/`admin`, `adminGate`), payments (one product through the existing catalogue and entitlements), the console shell, and the accessible-SVG chart approach.

## 2. Architecture (the central engine)

```
every maths test  ──adapter──▶  MathAttempt (contract.ts)  ──ingest()──▶  mx_attempts + mx_items
                                                                              │
                                                     engine.ts (pure) ◀───────┘  recompute
                                 overall score · Bayesian mastery · diagnosis · recommendations
                                                                              │
                              views.ts (free/premium) ──▶ pages + charts.ts ──▶ student UI
```

| Spec component | Where |
|---|---|
| Test integration layer / contract | `contract.ts` (`MathAttempt`, versioned, validated), `adapters/*`, `ingest.ts` (live hooks + backfill) |
| Assessment data processor | `ingest.ts` + `store.ingest` (normalise, idempotent on source+ref+user) |
| Skill classification | `taxonomy.ts` (6 areas, 37 topics, cognitive tags), adapters' mapping |
| Performance analysis | `engine.ts` (accuracy, robust speed, mastery, consistency, efficiency, overall) |
| Diagnostic | `diagnosis.ts` |
| Recommendation | `recommend.ts` |
| Analytics/visualisation | `charts.ts` (datasets), `components/mathstudio/Charts.tsx` |
| Progress | `progress.ts` |
| Subscription & entitlement | `access.ts` over `lib/pay/course-access.ts` |
| Reporting/admin | `admin.ts`, `app/(portal)/console/math/*` |

Engine files are pure (no I/O, no clock read — `now` is passed in), so the same items always give the same scores and history can be reprocessed when the algorithm version changes.

## 3. The integration contract

A finished attempt from any test is one `MathAttempt` (v1): `{ source, sourceRef, userId, label, startedAt, finishedAt, totalMs, items[] }`, each item `{ ref, topic (taxonomy id), cognitive, difficulty 1–5, format, credit, maxMarks, correct, skipped, timeMs|null, expectedSecs|null }`. It is **validated** (`attemptSchema`); an invalid attempt is rejected with its errors, never silently dropped. It is **idempotent**: `(source, sourceRef, userId)` is unique, so re-ingesting updates in place. To add a test: write an adapter returning a `MathAttempt` and call `ingest`. The engine never learns where it came from.

## 4. Algorithms (Phase 2, provisional)

Every number is in `config.ts` (`mx_config`, admin-editable, audited). Defaults are starting values, **not validated against real outcomes**; the UI says so.

- **Accuracy** = difficulty-weighted share of marks on attempted questions (partial credit via `credit/maxMarks`). Skipped is separate from wrong; the denominator is attempted, not total.
- **Speed** is robust: the **median** time (not the mean) so one long question does not distort it, and only where `timeMs` exists. GRE → "not measured".
- **Mastery** per topic is a **Beta posterior**: prior `Beta(priorStrength·priorMean, priorStrength·(1−priorMean))`, and each item adds weight = difficultyWeight × recency (`0.5^(ageDays/halfLife)`); `score = 100·posterior mean`, with a 68% credible band (so thin evidence shows as a wide band). Harder items weigh more, so mastery shown on hard questions beats the same count on easy ones, and stale perfect records are pulled back toward the prior. **Evidence levels**: Insufficient / Preliminary / Developing / Strong, from item count and distinct attempts.
- **Consistency** = 100·(1 − weighted mean per-topic spread of per-attempt accuracy).
- **Efficiency** = median speed-factor (capped at 1) × accuracy, only where ≥4 timed items.
- **Overall score** (weights mastery 45 / accuracy 25 / efficiency 15 / consistency 15): a component with no data is **left out and the rest rescaled**; the UI shows each component's score, weight, effective weight and contribution. It is never an exam score, percentile or admission chance.

## 5. Weakness detection (`diagnosis.ts`)

Patterns, each only with ≥ preliminary evidence and the configured minimum counts: low-mastery **topic** (a weak **prerequisite** that blocks other attempted topics ranks first, as foundational), **difficulty cliff** (fine on easy/medium, falls on hard), **multi-step gap** (multistep/applied much worse than routine), **slow-but-right** and **hurried** (fast wrong answers) — the last two only where time exists. Each weakness carries: the topic, what was observed, the evidence from the student's tests, why it matters, what to do, the practice difficulty, and how to measure improvement. Nothing is invented: a wrong answer is never called "careless" from being wrong, only from a fast-wrong pattern, and uncertain causes are hedged ("may indicate").

## 6. Recommendations (`recommend.ts`)

The Studio does not generate questions; it sends the student to **real** practice already on the platform — arithmetic topics to the Mathematics Speed studio, exam-style topics to the GRE Quant mocks, timing issues to review. Steps are grouped Priority 1–4 (foundational gaps, high-impact weaknesses, efficiency, advanced), with a question count, difficulty, target, revisit interval and mastery criterion.

## 7. Database

`mx_topics` (admin-editable taxonomy, seeded), `mx_config`, `mx_attempts` (one per ingested attempt, unique on source+ref+user, with its own overall score), `mx_items` (normalised questions, `at` denormalised for cheap history), `mx_mastery` (cached per-topic estimate, recomputed on every ingest so the dashboard reads one small table), `mx_enrolment` (study minutes), `mx_audit`, `mx_events`. Student rows cascade on account deletion; taxonomy and config stay. Migrations idempotent.

## 8. Integration & reliability

- **Live hooks** (non-throwing, so analytics can never corrupt or block a test submission): GRE in `app/practice-tests/actions.ts` after `attempts.save`; Mathematics Speed in `app/api/math-speed/submit/route.ts` after a session is submitted; the mixed-subject mocks (JEE, IMO, other LMS mocks) post their finished maths questions from `components/lms/MockTest` to `app/api/math-studio/mock`. These mocks were not persisted before — the Studio is now their record. Their answer key is already shown to the student at the end, so grading on the client is acceptable here (the same trust model the platform already uses for these self-study mocks); the contract still validates every item.
- **Backfill** (`scripts/mathstudio-backfill.ts`, or the admin "Reprocess all from source") ingests every historical attempt, idempotently, so the Studio is complete on day one. **Note:** a full reprocess is O(all attempts) and should be run off-peak; the per-student recompute is the fast path used after one student's data changes.
- **Reconciliation:** the admin integration view shows processed vs available per source, so a gap is visible.

## 9. Security & privacy

Every query is scoped by `user_id`; a student sees only their own analytics (tested). Scores, mastery and premium are all decided on the server; premium comes only from a verified-payment entitlement. Admin changes are audited. Aggregate reports withhold any group smaller than `minCohort` (default 5). Authoritative test results (`test_attempts`, `ms_attempts`) are separate from the derived `mx_*` analytics, so an analytics failure never touches the original record.

## 10. Free and premium

Free: the overall score, accuracy and counts, the three weakest topics, a basic trend, a plan preview. Premium (product `course-mathematics-studio`, **₹599 placeholder — set the real price in Payments**): all topic mastery, the full weakness diagnosis, the six charts, the full plan, question-level analysis, topic-movement and full history. Free fields are null on the server and never reach the page. Upgrade clicks go through `/math-studio/upgrade` (counted) to the existing checkout.

## 11. Testing

`npx vitest run lib/mathstudio` (41 tests): the contract validator; every scoring formula and boundary (accuracy, robust speed, Bayesian mastery with prior/difficulty/recency/credible-interval, evidence levels, consistency, efficiency, overall rescaling); weakness personas (foundational prerequisite, difficulty cliff, multi-step gap, slow, hurried, and that timing findings never come from no-timing data, and nothing from insufficient evidence); the plan priorities and practice links; progress trend and movement; config validation; and on a real database: ingest from both adapters, idempotency, cached mastery, cross-student isolation, backfill, admin config/taxonomy/reprocess and withheld reports. DB tests need `PORTAL_TEST_DATABASE_URL` and `DATABASE_SSL=disable`.

## 12. Deployment (Phase 8)

1. Migration `20261227000001_math_studio.sql` applies on start with `PORTAL_AUTO_MIGRATE=1` or `npm run portal:migrate`. The taxonomy seeds on first use (`ensureSeed`), never overwriting admin edits.
2. The product `course-mathematics-studio` is created by the catalogue seed at start (₹599 placeholder). **Set the real price** in Console → Payments → Catalogue; seeding never overwrites a changed price.
3. Run the backfill once so history appears: `DATABASE_URL=… DATABASE_SSL=disable npx tsx scripts/mathstudio-backfill.ts` (or the admin "Reprocess all", off-peak).
4. No new required env vars, no new dependencies.
5. Verify: `/math-studio` loads; a student with no tests sees the empty state; after a GRE mock or a Mathematics Speed session their dashboard fills; a test purchase unlocks premium only after the webhook; the console shows integration status and an audit trail; changing a weight is audited and a reprocess applies it.

Rollback: revert the merge; the `mx_*` tables are additive and can stay. To remove, drop `mx_items, mx_mastery, mx_attempts, mx_enrolment, mx_events, mx_audit, mx_config, mx_topics` and delete the `schema_meta` migration row.

## 13. Not built or not verified

- Wired today: GRE Quant, Mathematics Speed, JEE Main (maths section) and IMO mocks. **SAT Math is lesson content with no gradable test, so no SAT analytics exist** — the Studio will show it when a gradable SAT test is added. CAT/GMAT maths tests do not exist on the platform yet.
- IMO is mapped at **section** granularity (logical/mathematical reasoning, everyday maths, achievers), which is coarser than GRE's per-topic tagging; JEE uses the question's own topic. These are editorial mappings in `adapters/exam.ts`, not reviewed question by question.
- The JEE/IMO/other mocks are graded on the client (their key is already shown at the end); the server validates but does not independently re-grade them.
- GRE has no per-question time, so per-question speed/timing diagnostics apply to Mathematics Speed only; the UI states this.
- Overall-score weights and mastery parameters are provisional, not validated against real outcomes.
- Question statements and worked solutions stay in each test module (to keep answer keys in one place); the attempt view analyses performance, it does not re-show the question text.
- A full "reprocess all" runs inline; at large scale it should become a background job.
- The 156→taxonomy skill mapping is keyword-based (auditable, with a mental-calc fallback); it was spot-checked, not reviewed skill by skill.
- A downloadable per-student PDF report is not built (the admin aggregate CSV is).
- Load testing, and screen-reader testing with real assistive tech, were not done (accessibility is by construction: labels, roles, keyboard, a table behind every chart).
