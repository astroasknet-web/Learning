# The 20 interactive courses: how they are built and what they are not

Twenty courses have full lessons, hands-on labs, module quizzes, a capstone and badges: Microsoft Excel (basic), Microsoft Word, PowerPoint design, Statistics for analysts, Financial literacy and investing, Basic accounting and bookkeeping, Digital marketing foundations, SEO, Business communication, Corporate readiness and interview skills, Time management and productivity, Critical thinking and problem solving, Project management fundamentals, Agile/Scrum/Jira, Cybersecurity essentials, Prompt engineering, Entrepreneurship and startup basics, Product management fundamentals, Operations and supply chain, Customer success and support.

## Where the content lives

- One source file per course: `scripts/author/courses/<slug>.mjs` (helpers in `scripts/author/kit.mjs`).
- `node scripts/author/build-new-courses.mjs` turns every source file into `lib/market/data/<slug>.lessons.json`, `lib/learn/data/<slug>.activities.json`, updates the catalogue entry in `lib/market/data/courses.json` and regenerates the lazy registries `lib/market/new-lessons.ts` and `lib/learn/new-activities.ts`. Run it after editing any course, and commit the generated files.
- `lib/learn/new-courses.test.ts` checks every course: six modules of three lessons, at least 3,600 lesson words, well-formed quizzes (answers spread across positions, every question explained), at least one required lab per module, a capstone, and that **every lab can be finished with its model answer** (expected values are computed independently in the source and cross-checked against the spreadsheet engine).
- Selling: a course product is `course-<slug>`. New databases seed it active because the course now has lessons; databases that already had the rows get them switched on by `db/migrations/20261125000001_activate_new_courses.sql`. Fees come from `lib/pay/course-fees.ts`.

## How a lab is judged

Labs are not multiple choice. A spreadsheet, document, slide or sorting task is checked by `lib/learn/checks.ts` against the student's actual work (values, formulas used, cell coverage, headings, lists, word counts, patterns). Each failed check shows a plain explanation and a hint. XP and badges are earned only when every check passes.

## What these courses are not

- They are **not externally accredited**, and none claims to prepare for a named certification (project management and Scrum pages say so explicitly). "International standard" here is a quality target for structure, depth and practice, not an award.
- The labs run in the browser: there are no coding or live-software labs (no real Jira, no real search console, no connection to an AI service). The prompt-engineering labs check the structure and content of what a student writes, not an AI's reply.
- Law, tax, funding and employment content is general and says to check local rules; it is not legal or financial advice.
- Examples use India-friendly rupee figures that are illustrative. Prices of tools, tokens and markets change; the courses say so where it matters.
- Content was written and checked by the build's own tests and a review in the browser, not reviewed by outside subject experts. Have a subject expert read each course before you advertise it as expert-reviewed.
- Each course's first sorting activity is a free sample before purchase (the existing design for all courses); everything else needs a purchase or a plan pick.

## The 18 Blockchain & Web3 courses

The whole Blockchain & Web3 category (18 courses) is built with the same pipeline: Introduction to Blockchain & Web3; Blocks, Hashing & Consensus; Cryptocurrency & Digital Assets; Blockchain Architecture & Networks; Ethereum & Smart Contracts; Solidity for Beginners; Build Your First dApp; Advanced Solidity; Smart Contract Security & Auditing; Token Development & ERC Standards; NFTs & Decentralized Applications; Web3 with JavaScript & Node.js; Blockchain with PHP & Node.js; Production-Ready Web3 Applications; Blockchain Projects: 5 Real-World Applications; Blockchain Architecture & Enterprise Solutions; Blockchain & DeFi; Blockchain Capstone Project.

- Products are switched on by `db/migrations/20261201000001_activate_blockchain_courses.sql`.
- Extra interactive widgets: a live SHA-256 hash lab (`hashlab`), a toy blockchain you can edit, break and re-mine (`chainlab`) and a Merkle tree explorer (`merkle`). Their maths is in `lib/learn/widgets/sha256.ts` and `chain.ts`, with tests in `chain.test.ts`.
- Code listings: every Solidity listing was compiled with solc 0.8.26 against OpenZeppelin Contracts 5.0.2 (and the upgradeable package where used), and every JavaScript listing was syntax-checked. **PHP, SQL, YAML, JSON and Markdown listings were written and reviewed by hand but not executed by the build**; the PHP course says so on its landing page. Nothing was deployed to any network.
- Honest scope: the platform cannot run Solidity, PHP, Node.js or a wallet. Labs check designs, calculations, classifications and writing; students run code in their own tools (Remix, Hardhat, Node) on a local or test network.
- Hours: each course's catalogue hours and module count were rewritten to what the content really contains (about 8 to 16 hours, six modules each), not the original marketing figures (some of which said 20 to 40 hours and 7 to 10 modules).
- Risk wording: the token, NFT, DeFi and enterprise courses say plainly that they are education, not financial, investment, legal or tax advice, that tokens can lose all value, and that the example contracts are unaudited and must not hold real funds. The voting and registry projects explain what blockchains cannot guarantee (secret ballots, legal ownership). Keep this wording if you edit them.
- Not externally reviewed or accredited. Have a smart-contract security practitioner read the security, DeFi and production courses, and a lawyer read the legal, regulatory and privacy passages, before you market them as expert-reviewed.
