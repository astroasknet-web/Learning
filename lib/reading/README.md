# English Reading Studio: design, operation and deployment

Student routes: `/reading-studio` (public page), `/reading-studio/dashboard`, `/reading-studio/assessment/[id]`, `/reading-studio/results/[id]`, `/reading-studio/progress`, `/reading-studio/levels/[key]`, `/reading-studio/plan`, `/reading-studio/practice`.
Administrator routes: `/console/reading` (overview, audit), `/console/reading/content`, `/console/reading/content/[id]`, `/console/reading/settings`, `/console/reading/export`.
Code: `lib/reading/` (engine, store, admin), `components/reading/`, `app/(portal)/reading-studio/`, `app/(portal)/console/reading/`, `app/api/reading-studio/`. Migration: `db/migrations/20261224000001_reading_studio.sql`. Tables `rd_*`.

## 1. What was found in the audit (Phase 1) and what was reused

| Area | Finding | Decision |
|---|---|---|
| Stack | Next.js 15, React 19, TypeScript, Tailwind, zod, vitest, MySQL through `mysql2` with a small PostgreSQL-flavoured SQL translator (`$1`, `ON CONFLICT`, `RETURNING`) | Same stack, same `lib/pay/db.ts` helpers |
| Auth | Cookie sessions, `currentUser()`, role `student`, CSRF token in the session, `studentJson` guard for JSON endpoints, rate limit helper | Reused unchanged (`lib/studio/api.ts`) |
| Payments | Existing product/price catalogue, orders, checkout, webhooks, entitlements; `accessFor(userId, slug)` decides course access (purchase, plan pick or plan-included studio) | One new product `course-ai-reading-studio` added to `STUDIO_COURSES` (₹599, **placeholder price: set the real one in Payments > Catalogue**). No parallel payment system. Premium = `accessFor(...) !== null` |
| Closest precedent | Mathematics Speed Enhancement Studio: levels, server-side marking, free sample plus one paid course product, `ms_*` tables, studio pages | Copied its conventions (portal shell, server actions, API shape, DB test pattern, design note) |
| Charts | No chart library in the project | Accessible hand-written SVG charts (no new dependency) |
| Admin | `/console` (role admin, `adminGate`, MFA for staff, flash messages via session data) | New tab `Reading Studio` under the same shell and gate |
| AI | Optional OpenAI use elsewhere, flagged by an env switch | `READING_AI_ENABLED=true` plus the existing `OPENAI_API_KEY`; off by default |
| IELTS practice tests in the repo | Licensed third-party exam material; the studio must not show exam labels | **Not reused.** All passages and questions were written for this studio |
| Existing exam-prep / IELTS reading product | Separate product | Untouched |

Assumptions made instead of asking: ten levels A to J as in the specification; the package is one product (monthly/annual subscriptions are not configured in this codebase, so only the one-time package exists; the existing plan system could include the studio through `PLAN_STUDIOS` in `lib/pay/plans.ts`, which I deliberately did **not** change because the home-page plan redesign is in flight); price ₹599; the free tier is the starting assessment (2 per student, configurable), the overall score, basic speed, strongest/weakest summary and the Level A lesson.

## 2. Architecture (modules)

| Specification module | Where |
|---|---|
| Passage management, question bank | `lib/reading/content-model.ts` (shape, validator), `lib/reading/admin.ts`, `rd_passages`, `rd_questions` |
| Assessment delivery, reading-time tracking | `lib/reading/store.ts` (`startAssessment`, `runnerState`, `markPhase`, `submitAnswer`), `components/reading/AssessmentRunner.tsx`, `app/api/reading-studio/*` |
| Answer evaluation | `lib/reading/scoring.ts` `markResponse` |
| Skill classification | `lib/reading/taxonomy.ts` (15 skills in 4 groups, 8 question types, 3 difficulties) |
| Performance scoring | `lib/reading/scoring.ts` `scoreAssessment`, `lib/reading/config.ts` |
| Weakness diagnosis | `lib/reading/diagnosis.ts` |
| Recommendations | `lib/reading/recommend.ts` |
| Analytics and visualisation | `lib/reading/charts.ts` (datasets), `components/reading/Charts.tsx` |
| Learning levels | `rd_levels`, `lib/reading/progress.ts` `levelStates`, `lib/reading/content/levels.ts` (seed) |
| Progress tracking | `lib/reading/progress.ts`, `lib/reading/views.ts` |
| Subscription and entitlement | `lib/reading/access.ts` over `lib/pay/course-access.ts` |
| Administrative reporting | `lib/reading/admin.ts`, `app/(portal)/console/reading/*` |

Pure engine files (`scoring`, `diagnosis`, `progress`, `recommend`, `charts`, `config`, `content-model`, `taxonomy`) do no I/O and read no clock; all of them are unit tested.

## 3. Algorithms (Phase 2)

All numbers below are the **provisional starting values**. They are stored in `rd_config`, validated by `configSchema`, changeable by an administrator, and every change is audited. They are not validated against real student data and the interface says so.

**Marking.** Single-answer: exact key. True/false: three options (true, false, the passage does not say). Short answer: case, punctuation, spacing and a leading article ignored; matches any accepted answer. Match: credit = share of pairs right; "correct" only if all are.

**Accuracy** is difficulty-weighted: points earned / points available, with weights easy 1, medium 1.25, difficult 1.5. Plain counts ("7 of 10") are shown separately.

**Dimensions and weights** (default 30 / 25 / 15 / 15 / 10 / 5):
- Reading comprehension: accuracy on main idea, details, fact/opinion, relationships, purpose/tone, data questions.
- Question-answering accuracy: accuracy over every question.
- Inference and critical reading: inference, conclusion, assumptions, arguments, contradiction.
- Reading efficiency: `speedFactor x accuracy`, where `speedFactor = clamp(wpm / targetWpm, 0.25, 1)` (target 220/200/180/160/140 by passage difficulty 1 to 5). No bonus above the target, and the product can never exceed accuracy, so speed cannot make up for poor understanding. A reading time implying more than 900 wpm (skimming), less than 25 wpm or more than 25 minutes (interrupted) is **not scored** and the dimension is left out.
- Vocabulary and context: word-meaning and figurative-language questions.
- Information retention: recall questions answered without the passage (separate session).

A dimension needs at least 2 questions (QA accuracy: 4) to count. **A dimension that is not assessed is removed from the denominator** and the rest rescaled; the results page shows each dimension's score, nominal weight, effective weight and points added. **Comprehension safeguard:** if comprehension is under 50%, the overall score is capped at 55. The overall score is labelled provisional and carries `scoring_version` and `content_version`.

**Reading speed** = words read / minutes between the server noting the passage opened and the student pressing "I have finished reading". It is labelled an **estimate**; nothing claims to measure eye movement, subvocalisation or how the student read.

**Diagnosis** (`diagnoseSkill`): per skill, questions attempted, credit, accuracy, mean response time, accuracy by easy/medium/difficult, accuracy in each of the last five assessments, change from the previous assessment, distinct passages, confidence (none under 1 question; low under 4; medium from 4; high from 8 questions in at least 2 passages), and band (under 50 significant support may be needed, 50 to 69 developing, 70 to 84 progressing, 85 and over strong on assessed material). **Under the minimum sample no band is given** and the text is "More practice needed to assess this skill reliably." A skill that is at least 70% on easy and medium questions but under 50% on difficult ones is a **stretch area, not a weakness**. A repeated error means misses in two or more passages. Response time is never a weakness by itself; it is only used with a wrong answer (hurried answers) or praised (correct but slow on difficult questions).

**Causes** (`causesOf`): pace (comprehension at least 70% but speed under 80% of the target), understanding, vocabulary (word meaning low while the rest is sound), inference (inference low while direct questions are sound), memory, question interpretation (negative wording and plausible-but-unsupported low while direct fact questions are sound), hurried answers (at least 3 and at least half of the wrong answers given in under 35% of the guide time). A cause appears only with its evidence sentence.

**Comparison** (`compareToPrevious`, `trendOf`): only complete assessments of the same family, same scoring version, passage difficulty within one step. A repeat of the same passages is called a repeat; a higher-difficulty passage with a drop is reported as "harder, not a like-for-like drop". A trend line needs at least three comparable points.

**Levels** (`levelStates`): a level is mastered when a complete Mastery check on it reaches the level's pass mark (default 75%) with at least the minimum number of questions (default 4), the student has completed practice for the level, and practice plus checks together are within five points of the mark. The next level opens only then. Pass marks, sizes, names and order are database values; adding a level needs no code change.

**Delayed recall.** Offered only a configurable number of hours (default 20) after the passage was read, without the passage in view, and reported as a snapshot, not as long-term memory.

## 4. Database (Phase 3)

`rd_passages`, `rd_questions` (content, status draft/approved/archived, source authored/ai, review_state, version), `rd_levels`, `rd_config`, `rd_enrolments` (study minutes), `rd_level_progress`, `rd_assessments` (one row per assessment, with `plan_json`, reading/answering/total ms, wpm, scores, scoring and content version, provisional flag, `repeat_of`, `result_json`), `rd_answers` (one row per question: selection, credit, correctness, server-checked response time, tags as at the time), `rd_audit` (append-only change log), `rd_events` (upgrade-click funnel). Student rows cascade with the account; content rows stay. Migrations are idempotent like the rest.

## 5. API and validation

All POST endpoints are student-only, CSRF-checked JSON, size-limited and rate-limited (`lib/studio/api.ts`).

| Endpoint | Purpose | Server checks |
|---|---|---|
| `POST /api/reading-studio/phase` | note start/end of reading | assessment belongs to the student and is open; server clock |
| `POST /api/reading-studio/answer` | save an answer | question is part of this assessment; answer cut to the question's shape; time clamped to the server clock; in practice rounds the first answer is final and the key and explanation come back only then |
| `POST /api/reading-studio/finish` | hand in | marks and scores on the server; idempotent; optional AI note afterwards |
| `GET /reading-studio/upgrade?from=` | counted upgrade click, redirect to the existing checkout | grants nothing |
| `GET /reading-studio/results/[id]/report` | CSV of the student's own report | premium checked on the server |
| `GET /console/reading/export` | aggregate CSV | admin only, not demo users, audited, groups under the minimum cohort left out |

## 6. Security and privacy

- Keys, explanations and scoring inputs never leave the server before the student has committed an answer in a practice round; assessments return nothing until handed in. The page payload for a student without the package contains no premium fields (tested by serialising the view model).
- A student can read only their own assessments (every query includes `user_id`); another student's id returns nothing.
- Scores, times and premium status cannot be set by the browser: marking, timing and entitlement are all decided on the server; premium comes only from the payment system's entitlement row.
- Audit log for content approval, edits, imports, reviews, scoring configuration, levels and exports.
- Aggregate reports withhold any group smaller than `minCohort` (default 5).
- Retention: assessment rows follow the account (deleted with it). A scheduled purge of old open/partial assessments is not built; see "Not done".
- AI keys stay server-side; nothing is sent to the AI except counts the engine produced (no names, no passage text).

## 7. AI use

Off unless `READING_AI_ENABLED=true` and `OPENAI_API_KEY` is set (model `OPENAI_MODEL`, default `gpt-4.1`). It writes a short note from facts the engine computed. The reply must match a strict schema, may contain no number that is not the overall score or words per minute, and may not name an exam; otherwise it is discarded and the deterministic text stands. It can never change a score. AI-**drafted content** can be imported only as a draft and cannot be approved until a person marks it reviewed. The studio does not call an AI to generate questions itself: the import path accepts AI-drafted JSON from an external tool.

## 8. Content: what is seeded and what is not

Seeded: 2 passages for the free starting assessment (8 scored questions each, 1 recall question each), and one passage for each of levels A to J, each with 4 practice, 3 to 5 mastery and 2 recall questions: **12 passages and 121 questions**, all written for this studio (no third-party text), all four question formats used (multiple choice, true/false/does not say, match, short answer). Every question has a key, skill tag, question-type tag, difficulty, guide time and an explanation. All pass the structural validator. **They have not been reviewed by an educator** (the console says so: "Not reviewed") and keys are my own judgement.

Not done / honest limits of the bank:
- Levels have a **single passage each**, so a mastery check uses questions from the same passage as the practice (different questions, not a fresh passage). Add passages (import) for fresh-passage reassessment; the engine already prefers unseen questions.
- **Answer-pattern bias.** In the level bank the correct option is also the longest in about 84% of multiple-choice questions, and keys sit in positions A/B more often than C/D. The free starting assessment was rebalanced (key is the longest in 1 of 20), but the level bank was not. A test-wise student can therefore score above chance without reading. The console shows this measurement (Question quality check). An editorial pass is required before scores are relied on.
- Passage text is capped at about 340 words; topics are general.
- The "answerable from the passage" check is human work; no automated check can do it.

## 9. Free and premium

| | Free | Package |
|---|---|---|
| Starting assessment (2 by default) | yes | unlimited |
| Overall score and how it was calculated | yes | yes |
| Speed estimate, comprehension %, accuracy, counts, comparison | yes | yes |
| Strongest/weakest skill summary and why it matters | yes (from this result) | yes |
| Level A lesson | yes | all lessons |
| Skill-by-skill analysis, error examples, answer explanations, charts, 7-day plan, history, report CSV | locked preview | yes |
| Practice, mastery checks, recall, timed, fresh assessments, targeted practice | locked | yes |

Locked previews use only true counts (questions missed, skills assessed, charts that could be drawn). No countdowns, scarcity or invented scores. Every call to action goes through `/reading-studio/upgrade?from=...` to the existing checkout; the click is counted for the conversion view.

## 10. Testing

`npx vitest run lib/reading` (84 tests): content validity and answer-key distribution, the question validator, marking, every scoring formula and boundary, efficiency rules, safeguard, diagnosis rules and personas (fast reader with many wrong answers, slow reader with excellent comprehension, good on easy but weak on difficult, strong vocabulary with weak inference, correct but slow on complex questions, partial completion, repeat of the same assessment, improvement over comparable assessments, insufficient data, harder passage), progress and trend rules, level mastery rules, chart dataset rules, configuration validation, AI validation and failure; and on a real MySQL database: free limit, locked features, server marking and time clamping, tamper attempts, cross-student access, verified purchase unlocking, revoked package closing premium again, level progression, delayed recall, admin approval and review rules, imports, audit log, withheld small-group reports.

Database tests need `PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test DATABASE_SSL=disable`.

## 11. Deployment (Phase 8)

1. Merge the branch. The migration `20261224000001_reading_studio.sql` is applied by `npm run portal:migrate` or at server start with `PORTAL_AUTO_MIGRATE=1`. The seed content and levels are inserted on first use (`ensureSeed`), never overwriting administrator edits.
2. Payments: the product `course-ai-reading-studio` is created by the catalogue seed at start (`seedCatalogue`). **Set the real price** in Console > Payments > Catalogue (seeding never overwrites a changed price). Provider keys are the existing ones.
3. Optional AI feedback: set `READING_AI_ENABLED=true` (and keep `OPENAI_API_KEY`, `OPENAI_MODEL`).
4. No new required environment variables. No new dependencies.
5. Signed-in test: take the starting assessment, check the result, buy the package on the test provider, confirm premium unlocks after the webhook, run a level practice and mastery check.

Rollback: remove the nav entry and routes by reverting the merge. The tables are additive and can be left in place; to remove them, drop `rd_answers`, `rd_assessments`, `rd_level_progress`, `rd_enrolments`, `rd_events`, `rd_audit`, `rd_config`, `rd_levels`, `rd_questions`, `rd_passages` in that order and delete the `schema_meta` row `migration:20261224000001_reading_studio.sql`. The product row can be set inactive in the catalogue; existing buyers keep their entitlement record.

Final verification checklist: migration applied; `/reading-studio` loads; free student completes the starting assessment and sees the score, speed estimate, strongest/weakest and locked previews; a free student gets "part of the package" for practice, mastery, recall, timed, fresh and the CSV; a test purchase completes and premium appears only after the webhook; the results page shows charts, strengths, weaknesses, plan and explanations; Level A mastery opens Level B; the console shows counts, the quality check and an audit trail; changing a weight is audited and changes the next score only.

## 12. Maintenance

Add content by import (console), approve it, and have it reviewed. Retire a question by archiving it. After changing weights or thresholds, finished assessments keep their stored score and version; comparisons only link results of the same scoring version. When the starting values are validated against real data, change them in Settings and bump `SCORING_VERSION` in `lib/reading/config.ts`.

## 13. Not built or not verified

- A scheduled data-retention job; account deletion cascades but old open assessments are not purged automatically.
- Monthly or annual subscription products (none exist in this codebase); renewal and "subscription status" screens beyond the existing Billing page.
- A printable PDF report (the CSV report exists; the results page prints with the browser).
- Peer comparison (deliberately absent: there is not enough comparable data).
- Screen-reader testing with real assistive technology; accessibility is by construction (labels, roles, keyboard, tables behind every chart) and automated checks only.
- The AI note was tested with mocked responses only; no live AI call was made.
- Load and performance testing.

## 14. Essay Reading Tests for competitive examinations (`/reading-tests`)

A separate public page and 30 test pages (`/reading-tests`, `/reading-tests/[n]`) for SSC, CDS, CAT, UPSC and CTET style practice. They are **not** the IELTS or SAT practice already on the portal and they are not learning levels: exam names appear only on these pages, never as categories inside the Reading Studio.

* **Source.** The 30 essays (600 to 1,100 words) with 300 questions come from the files supplied by the owner. They are saved unchanged, with a normaliser, an audit and corrections, in https://github.com/astroasknet-web/Essay-for-Compet-SSC-CAT-UPSC-CTET (`AUDIT.md`). The app reads the normalised copy in `lib/reading/essays/essays.json`.
* **Linked to the Studio.** Each essay is a passage in `rd_passages` with `collection = 'exam'` and each question a row in `rd_questions` (migration `20261225000001_reading_exam_tests.sql`). A new assessment kind `essay` runs it through the same runner, server-side marking, scoring, diagnosis, charts, history and report as every other assessment, so the answers feed the student's skill profile. Essays are excluded from the level pathway, fresh/timed/recall picking; targeted skill practice may draw on their questions.
* **Tags.** The files carry no skill tags, so `classifyQuestion` (`lib/reading/essays/meta.ts`) assigns a skill, question type, difficulty and guide time from the wording. It is rule-based (about two thirds fall back to "important facts and details") and tested; an administrator can retag in the console. The theme, the examinations each essay "suits" and the difficulty are editorial choices in `ESSAY_META` and are **not** claims about past papers.
* **Free and paid.** Three tests (6, 11, 20) are free for any signed-in student (`freeEssays` in the console settings); the other 27 need the same package as the rest of the Studio. Access is checked on the server in `startAssessment`.
* **Known limits.** In 79% of questions the correct option is also the longest (see the audit); 14 questions rely on general knowledge; explanations for 192 questions quote the supporting sentence of the essay and were not written by a subject expert; facts in the essays were not verified.

## 15. One studio, three tracks (English Reading Studio)

The Reading Studio, the essay tests and the IELTS Reading tests are one product, **English Reading Studio**, with three tracks (`lib/reading/access.ts`):

| Track | Content | Package (own product) |
|---|---|---|
| Reading Skills Pathway | levels A to J, practice, mastery, recall, timed, 7-day plan | `ai-reading-studio` |
| Indian Competitive Exams | 30 essay tests (SSC, CDS, CAT, UPSC, CTET) | `indian-competitive-reading` (price 499 is a placeholder) |
| International Exams | IELTS Reading practice tests (existing) | `ielts-practice-tests` (existing; Silver opens 10, Gold all) |

* The student **chooses tracks** on `/reading-studio/dashboard` (`rd_enrolments.tracks`, migration `20261226000001_reading_tracks.sql`); the dashboard then shows only those, plus a "Your packages" table. Choosing grants nothing: every start is checked on the server against what the student holds (`hasTrack`).
* **Analytics** (skill-by-skill analysis, charts, explanations, plan, history, report CSV) open for a holder of **any** paid track (`hasAnalytics`) and cover every skills-pathway and essay result.
* **IELTS Reading** keeps its own player and `test_attempts` table. Its results appear in the progress page as band scores; they are **not** skill-tagged or part of the Studio's diagnosis, because IELTS question types (matching headings, True/False/Not Given) do not map to the Studio's skills. SAT and GRE reading do not exist in the portal yet (GRE is Quant only), so the International track is IELTS Reading today.
* `/reading-studio` is the single public page; `/reading-tests` is the Indian track's library and `/practice-tests/ielts-reading` is the International track's.
