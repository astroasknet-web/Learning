import { describe, expect, it } from "vitest";
import { mapExamTopic, buildMockAttempt } from "./adapters/exam";
import { mapSkill } from "./adapters/mathspeed";
import { validateAttempt } from "./contract";
import { SEED_TOPIC_IDS } from "./taxonomy";

describe("exam adapter: topic mapping", () => {
  it("drops non-maths subjects and maps JEE maths topics into the taxonomy", () => {
    expect(mapExamTopic("Physics", "Kinematics", false)).toBeNull();
    expect(mapExamTopic("Chemistry", "Chemical Kinetics", false)).toBeNull();
    expect(mapExamTopic("Mathematics", "Trig Identities", false)).toBe("trigonometry");
    expect(mapExamTopic("Mathematics", "Parabola", false)).toBe("coordinate-geometry");
    expect(mapExamTopic("Mathematics", "Permutations And Combinations", false)).toBe("counting");
    expect(mapExamTopic("Mathematics", "Integration", false)).toBe("integration");
    expect(mapExamTopic("Mathematics", "Matrices And Determinants", false)).toBe("linear-equations");
    // an unplaceable maths question is kept as a multi-step problem, not dropped
    expect(mapExamTopic("Mathematics", "Some Exotic Thing", false)).toBe("multistep-problems");
  });
  it("maps every IMO section to a real taxonomy topic", () => {
    for (const sec of ["logical-reasoning", "mathematical-reasoning", "everyday-math", "achievers"]) {
      const t = mapExamTopic(sec, undefined, true);
      expect(t).not.toBeNull();
      expect(SEED_TOPIC_IDS).toContain(t);
    }
  });
  it("builds a valid attempt from graded maths questions and drops the rest", () => {
    const a = buildMockAttempt(7, "jee-mains", "mathematics", "JEE Main: Mathematics", new Date().toISOString(), 3600_000, [
      { section: "Physics", topic: "Optics", correct: true, skipped: false, marks: 4, maxMarks: 4 },
      { section: "Mathematics", topic: "Circles", correct: true, skipped: false, marks: 4, maxMarks: 4 },
      { section: "Mathematics", topic: "Probability", correct: false, skipped: false, marks: 0, maxMarks: 4 },
      { section: "Mathematics", topic: "Integration", correct: false, skipped: true, marks: 0, maxMarks: 4 },
    ]);
    expect(a.items).toHaveLength(3); // the Physics one is dropped
    expect(a.items.every((i) => SEED_TOPIC_IDS.includes(i.topic))).toBe(true);
    expect(validateAttempt(a).ok).toBe(true);
  });
});

describe("math-speed skill mapping", () => {
  it("places arithmetic skills and falls back to mental calculation", () => {
    expect(mapSkill("fraction-addsub")).toBe("fractions-decimals");
    expect(mapSkill("pct-change")).toBe("percentages");
    expect(mapSkill("triangle-angles")).toBe("triangles");
    expect(mapSkill("solve-2step")).toBe("algebra-basics");
    expect(mapSkill("add-2digit")).toBe("mental-calc");
    expect(SEED_TOPIC_IDS).toContain(mapSkill("some-unknown-skill"));
  });
});
