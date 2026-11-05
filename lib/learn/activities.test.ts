import { describe, expect, it } from "vitest";
import { activitiesFor, badgeEarned, cleanState, findActivity, initialState, learnCourse, levelFor, requiredFor, skillProgress, xpFor } from "./activities";
import { runChecks } from "./checks";
import type { Activity, ActivityState } from "./types";
import { emptySheet, type SheetState } from "./sheet/engine";
import type { Deck, Slide } from "./slides";
import nc from "@/lib/market/data/lessons/digital-literacy.json";

const course = learnCourse("digital-literacy-master")!;
const sl = (id: string, layout: Slide["layout"], title: string, body = "", shapes: Slide["shapes"] = []): Slide => ({ id, layout, title, body, body2: "", shapes });
const sh = (n: number): Slide["shapes"] => Array.from({ length: n }, (_, i) => ({ id: "h" + i, kind: i % 2 ? "arrow" : "rect", x: 40 + i * 50, y: 300, w: 80, h: 40, fill: "#2563eb" }));
const withCells = (a: Activity, extra: Record<string, string>, fmt: SheetState["formats"] = {}, charts: SheetState["charts"] = []): ActivityState => {
  const s = (initialState(a) as { sheet: SheetState }).sheet;
  return { kind: "sheet", sheet: { ...s, cells: { ...s.cells, ...extra }, formats: { ...s.formats, ...fmt }, charts } };
};
const bar = (labels: string, values: string): SheetState["charts"] => [{ type: "bar", labels, values }];

/** A model answer for every activity. If an authored check is wrong, impossible or too easy, one of these tests fails. */
const SOLUTIONS: Record<string, (a: Activity) => ActivityState> = {
  "w1-letter": () => ({ kind: "word", html: "<p>12 March 2026</p><p>Dear Principal,</p><p>I am writing to ask for permission to run a short computer skills workshop.</p><p>The workshop would take place next month after school for Class 9 students.</p><p>I would need a few things from the school to make the workshop a success, and they are listed below.</p><ul><li>A classroom</li><li>A projector</li><li>Ten laptops</li></ul><p>Yours sincerely,</p><p><b>Asha Rao</b></p>" }),
  "w2-assignment": () => ({ kind: "word", html: "<h1>Why Digital Skills Matter</h1><h2>At school</h2><p>Digital skills help students find information quickly and present their work clearly to teachers.</p><h2>At work</h2><p>Almost every job now uses a computer, so people who can use <u>spreadsheets and documents</u> well are more useful.</p><p>Learning these skills early gives students a real advantage when they apply for their first job or internship later. Every new skill they practise makes the next one easier to learn and gives them more confidence in class and at home every single day.</p>" }),
  "w3-resume": () => ({ kind: "word", html: '<h1 style="text-align: center; font-size: 28px"><b>Asha Rao</b></h1><p style="text-align: center">asha.rao@example.com</p><h2>Skills</h2><ul><li>Typing</li><li>Spreadsheets</li><li>Presentations</li></ul><h2>Education</h2><p>Class 10, City Public School</p><h2>Experience</h2><p>Helped organise the school science fair.</p>' }),
  "w4-notice": () => ({ kind: "word", html: '<p style="text-align: center"><b>Notice of Meeting</b></p><p>Date: 5 April 2026</p><p>Time: 4 pm</p><p>Venue: Room 12</p><p>Agenda</p><ol><li>Welcome</li><li>Plan for the year</li><li>Any other business</li></ol>' }),
  "w5-report": () => ({ kind: "word", html: '<h1 style="font-size: 30px">Devices We Use</h1><h2>What we asked</h2><p>We asked three classmates which device they use most often for homework each week.</p><h2>What we found</h2><p>Most students use a phone, while one student prefers a laptop for longer assignments at home.</p><table><tr><th>Name</th><th>Device</th><th>Hours</th></tr><tr><td>Asha</td><td>Phone</td><td>5</td></tr><tr><td>Ravi</td><td>Laptop</td><td>8</td></tr><tr><td>Meena</td><td>Tablet</td><td>4</td></tr></table>' }),
  "cap-doc": () => ({ kind: "word", html: "<h1>Asha Rao</h1><p>I am a Class 10 student who enjoys learning how computers work and how they can solve everyday problems.</p><p>This year I want to become confident with spreadsheets and presentations so I can help my family business and also make useful things for my school clubs and for my friends too.</p><ul><li>Typing quickly</li><li>Making <b>charts</b></li><li>Explaining ideas simply</li></ul>" }),
  "s1-first": (a) => withCells(a, { A2: "Asha", A3: "Ravi", A4: "Meena", A5: "Dev", B2: "72", C2: "65", D2: "80", B3: "55", C3: "60", D3: "48", B4: "91", C4: "88", D4: "95", B5: "40", C5: "35", D5: "52" }, { A1: { bold: true } }),
  "s2-total-average": (a) => withCells(a, { E2: "=SUM(B2:D2)", E3: "=SUM(B3:D3)", E4: "=SUM(B4:D4)", E5: "=SUM(B5:D5)", F2: "=AVERAGE(B2:D2)", F3: "=AVERAGE(B3:D3)", F4: "=AVERAGE(B4:D4)", F5: "=AVERAGE(B5:D5)" }),
  "s3-budget": (a) => withCells(a, { B9: "=SUM(B3:B7)", B10: "=B2-B9", B11: '=IF(B10>=0,"Within budget","Overspent")' }, { B9: { num: "currency" } }),
  "s4-results": (a) => withCells(a, { C2: '=IF(B2>=40,"Pass","Fail")', C3: '=IF(B3>=40,"Pass","Fail")', C4: '=IF(B4>=40,"Pass","Fail")', C5: '=IF(B5>=40,"Pass","Fail")', C6: '=IF(B6>=40,"Pass","Fail")', C7: '=IF(B7>=40,"Pass","Fail")', B9: "=AVERAGE(B2:B7)", B10: "=MAX(B2:B7)", B11: '=COUNTIF(C2:C7,"Pass")' }),
  "s5-chart": (a) => withCells(a, { D2: "Mar" }, {}, bar("A2:A7", "B2:B7")),
  "s6-sort": (a) => withCells(a, { A2: "Meena", B2: "91", A3: "Asha", B3: "72", A4: "Sana", B4: "66", A5: "Priya", B5: "55", A6: "Dev", B6: "40", A7: "Ravi", B7: "35", A8: "Karan", B8: "28", D2: "Meena" }),
  "cap-sheet": (a) => withCells(a, { A2: "Maths", B2: "6", A3: "Science", B3: "5", A4: "English", B4: "4", A5: "Hindi", B5: "3", A6: "Computers", B6: "2", B7: "=SUM(B2:B6)", B8: "=AVERAGE(B2:B6)" }, {}, bar("A2:A6", "B2:B6")),
  "p1-intro": () => ({ kind: "slides", deck: { theme: "ocean", slides: [sl("1", "title", "About Me", "Asha Rao"), sl("2", "title-content", "My Family", "- Four of us\n- Mum is a teacher"), sl("3", "title-content", "My Hobbies", "- Reading\n- Cricket"), sl("4", "title-content", "My Goals", "- Learn to code\n- Become a doctor"), sl("5", "section", "Thank You", "")] } }),
  "p2-project": () => ({ kind: "slides", deck: { theme: "forest", slides: [sl("1", "title", "Our Local Environment", "A school project"), sl("2", "title-content", "The problem", "- Plastic waste\n- Dirty water", sh(1)), sl("3", "two-column", "Causes and effects", "- Littering"), sl("4", "section", "What we can do", ""), sl("5", "title-content", "Our plan", "- Clean-up day\n- Dustbins")] } }),
  "p3-water": () => ({ kind: "slides", deck: { theme: "clean", slides: [sl("1", "title", "The Water Cycle", "How water travels"), sl("2", "title-content", "Evaporation", "- Sun heats water", sh(2)), sl("3", "title-content", "Condensation", "- Vapour cools into clouds"), sl("4", "title-content", "Precipitation", "- Rain falls")] } }),
  "p4-cyber": () => ({ kind: "slides", deck: { theme: "slate", slides: [sl("1", "title", "Staying Safe Online", "Three tips"), sl("2", "title-content", "Strong passwords", "- Long\n- Unique"), sl("3", "two-column", "Spot phishing", "- Urgent threats"), sl("4", "section", "Two-step login", ""), sl("5", "title-content", "Ask for help", "- Tell a trusted adult")] } }),
  "cap-deck": () => ({ kind: "slides", deck: { theme: "ocean", slides: [sl("1", "title", "My Study Week", "What my data shows"), sl("2", "title-content", "Hours per subject", "- Maths takes the most\n- Computers the least"), sl("3", "title-content", "What I will change", "- Plan earlier")] } }),
};

const solve = (a: Activity): ActivityState => (a.kind === "classify" ? { kind: "classify", answers: Object.fromEntries(a.classify!.items.map((i) => [i.id, i.answer])) } : SOLUTIONS[a.id](a));

describe("Digital Literacy activities", () => {
  it("are well formed", () => {
    const ids = new Set<string>();
    for (const a of course.activities) {
      expect(ids.has(a.id), `duplicate ${a.id}`).toBe(false);
      ids.add(a.id);
      expect(a.checks.length, a.id).toBeGreaterThan(0);
      expect(new Set(a.checks.map((c) => c.id)).size, `${a.id} check ids`).toBe(a.checks.length);
      expect([a.objective, a.scenario, a.title].every((s) => s.length > 8), a.id).toBe(true);
      expect(a.steps.length, a.id).toBeGreaterThan(0);
      for (const c of a.checks) { expect(c.hint.length, `${a.id}/${c.id} hint`).toBeGreaterThan(5); expect(c.explain.length, `${a.id}/${c.id} explain`).toBeGreaterThan(5); }
      const prefix = { word: "doc.", sheet: "sheet.", slides: "slides.", classify: "classify.", sql: "sql.", dax: "dax.", viz: "viz." }[a.kind];
      for (const c of a.checks) expect(c.spec.k.startsWith(prefix), `${a.id}/${c.id} uses ${c.spec.k}`).toBe(true);
      expect(course.skills.some((s) => a.skills.includes(s.id)), a.id).toBe(true);
    }
    expect(course.activities.length).toBeGreaterThanOrEqual(25);
  });
  it("point at real modules of the course", () => {
    const mods = new Set<string>([...nc.modules.map((m) => m.slug), "capstone"]);
    for (const a of course.activities) expect(mods.has(a.module), `${a.id} -> ${a.module}`).toBe(true);
    for (const m of ["computer-basics", "ms-word", "ms-excel", "ms-powerpoint", "internet-email", "digital-safety", "cloud-productivity", "intro-to-ai", "capstone"]) expect(requiredFor("digital-literacy-master", m).length, m).toBeGreaterThan(0);
    expect(activitiesFor("digital-literacy-master", "ms-excel")).toHaveLength(6);
  });
  it("every activity can be completed by its model answer", () => {
    const problems: string[] = [];
    for (const a of course.activities) {
      const r = runChecks(a, solve(a));
      for (const x of r.results) if (!x.passed) problems.push(`${a.id}/${x.id}: ${x.message}`);
    }
    expect(problems).toEqual([]);
  });
  it("no activity is already passed (or half passed) before the student does anything", () => {
    for (const a of course.activities) {
      const r = runChecks(a, initialState(a));
      expect(r.allPassed, a.id).toBe(false);
      expect(r.passed / r.total, `${a.id} starts ${r.passed}/${r.total}`).toBeLessThanOrEqual(0.5);
    }
  });
  it("each check fails when its own step is missing (no check is vacuous)", () => {
    // Remove one piece from the model answer and a check must notice. Spot-check the most important ones.
    const a = findActivity("digital-literacy-master", "s2-total-average")!;
    const sol = solve(a) as { kind: "sheet"; sheet: SheetState };
    const short = { kind: "sheet" as const, sheet: { ...sol.sheet, cells: { ...sol.sheet.cells, E2: "=SUM(B2:C2)" } } };
    const r = runChecks(a, short);
    expect(r.results.find((x) => x.id === "e2")!.message).toMatch(/covers B2 to C2.*B2 to D2.*D2/);
    const typed = runChecks(a, { kind: "sheet", sheet: { ...sol.sheet, cells: { ...sol.sheet.cells, E2: "217" } } });
    expect(typed.results.find((x) => x.id === "e2")!.message).toMatch(/formula starts with an equals/);
    const wrongFn = runChecks(a, { kind: "sheet", sheet: { ...sol.sheet, cells: { ...sol.sheet.cells, F2: "=SUM(B2:D2)" } } });
    expect(wrongFn.results.find((x) => x.id === "f2")!.message).toMatch(/should use AVERAGE/);
    const broken = runChecks(a, { kind: "sheet", sheet: { ...sol.sheet, cells: { ...sol.sheet.cells, E3: "=SUM(B3:D3" } } });
    expect(broken.results.find((x) => x.id === "noerr")!.passed).toBe(false);
    const extra = runChecks(a, { kind: "sheet", sheet: { ...sol.sheet, cells: { ...sol.sheet.cells, E2: "=SUM(B2:E2)" } } });
    expect(extra.results.find((x) => x.id === "e2")!.passed).toBe(false);
  });
  it("gives a wrong-kind state no credit and never throws on junk", () => {
    const a = findActivity("digital-literacy-master", "w1-letter")!;
    expect(runChecks(a, { kind: "classify", answers: {} }).allPassed).toBe(false);
    expect(runChecks(a, { kind: "word", html: "" }).passed).toBe(0);
    expect(cleanState(a, { kind: "sheet" })).toBeNull();
    expect(cleanState(a, null)).toBeNull();
    expect(cleanState(a, { kind: "word", html: '<p onclick="x()">hi</p><script>alert(1)</script>' })).toEqual({ kind: "word", html: "<p>hi</p>" });
  });
  it("cleans client-sent state: unknown cells, formats, categories and decks are dropped", () => {
    const s = findActivity("digital-literacy-master", "s2-total-average")!;
    const c = cleanState(s, { kind: "sheet", sheet: { cells: { A1: "ok", ZZ9: "bad", "__proto__": "x", A2: 5, B2: "=SUM(1)" }, formats: { A1: { bold: true, evil: "x", bg: "red" } }, charts: [{ type: "bar", labels: "a2:a3", values: "b2:b3" }, { type: "x" }] } }) as { sheet: SheetState };
    expect(c.sheet.cells).toEqual({ A1: "ok", B2: "=SUM(1)" });
    expect(c.sheet.formats).toEqual({ A1: { bold: true } });
    expect(c.sheet.charts).toEqual([{ type: "bar", labels: "A2:A3", values: "B2:B3" }]);
    const k = findActivity("digital-literacy-master", "c1-parts")!;
    expect(cleanState(k, { kind: "classify", answers: { i1: "input", i2: "nope", zz: "input" } })).toEqual({ kind: "classify", answers: { i1: "input" } });
    const p = findActivity("digital-literacy-master", "p1-intro")!;
    const d = (cleanState(p, { kind: "slides", deck: { theme: "x", slides: [{ layout: "evil", title: "<b>t</b>", shapes: [{ fill: "red", x: -5, w: 99999 }] }] } }) as { deck: Deck }).deck;
    expect(d.theme).toBe("clean");
    expect(d.slides[0]).toMatchObject({ layout: "title-content", title: "<b>t</b>" }); // text stays text: it is escaped wherever it is shown
    expect(d.slides[0].shapes[0]).toMatchObject({ x: 0, w: 960 });
  });
  it("derives XP, level, skills and badges only from passed activities", () => {
    const none = new Set<string>();
    expect(xpFor(course, none)).toBe(0);
    expect(levelFor(course, 0)).toMatchObject({ title: "Beginner", next: { title: "Explorer", need: 150 } });
    const some = new Set(["s2-total-average", "w1-letter"]);
    expect(xpFor(course, some)).toBe(50 + 40);
    expect(badgeEarned(course.badges.find((b) => b.id === "first-formula")!, some)).toBe(true);
    expect(badgeEarned(course.badges.find((b) => b.id === "document-pro")!, some)).toBe(false);
    const all = new Set(course.activities.map((a) => a.id));
    expect(xpFor(course, all)).toBe(course.activities.reduce((n, a) => n + a.xp, 0));
    expect(levelFor(course, 5000).next).toBeNull();
    expect(course.badges.every((b) => badgeEarned(b, all))).toBe(true);
    const sp = skillProgress(course, some).find((s) => s.id === "excel")!;
    expect(sp).toMatchObject({ done: 1 });
    expect(emptySheet().cells).toEqual({});
  });
});
