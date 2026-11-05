import { skill } from "./skills";
import { LESSONS } from "./lessons";

/**
 * The curriculum sequence: which skills each level and module teaches, in order. It says nothing about how hard a question is; that is the
 * difficulty engine's job (see docs/math-speed-studio.md). Student-facing words: Level, Module, Learn / Understand / Practise.
 */
export interface Lesson {
  /** One line on what the module is for. */
  blurb: string;
  /** Learn: the idea and the method, in short paragraphs. */
  learn: string[];
  /** Learn: the method as numbered steps. */
  steps: string[];
  /** Understand: why it works. */
  understand: string[];
  /** Understand: mistakes to watch for. */
  mistakes: string[];
  /** One sentence to remember. */
  tip: string;
}

export interface ModuleDef { title: string; skills: string[] }
export interface Module extends ModuleDef { key: string; level: number; n: number; lesson: Lesson | null }
export interface Level {
  n: number; letter: string; title: string; summary: string; topics: string[];
  /** Accuracy (percent) needed in the Level Assessment to unlock the next level. */
  pass: number;
  modules: Module[];
  /** True when every module of the level has its lessons written. A level that is not authored is shown as coming soon and cannot be started. */
  authored: boolean;
}

export const LETTERS = "ABCDEFGHIJKLMNO".split("");
export const levelLetter = (n: number): string => LETTERS[n - 1];
export const levelNumber = (letter: string): number => LETTERS.indexOf(letter.toUpperCase()) + 1;
export const moduleKey = (level: number, n: number): string => `${levelLetter(level)}-${String(n).padStart(2, "0")}`;

interface LevelDef { title: string; summary: string; topics: string[]; pass?: number; modules: ModuleDef[] }
const M = (title: string, ...skills: string[]): ModuleDef => ({ title, skills });

const DEFS: LevelDef[] = [
  { title: "Number Foundations", summary: "Place value, single-digit adding and subtracting, number bonds, counting patterns and your first timed practice.", topics: ["Place value", "Single-digit addition and subtraction", "Number bonds and complements", "Counting patterns", "Comparing numbers", "Basic mental arithmetic", "Introduction to timing"], modules: [
    M("Place value", "place-value"), M("Reading numbers in parts", "expanded-form"), M("Counting patterns", "count-on"), M("Comparing numbers", "compare-numbers"),
    M("Adding single digits", "add-single"), M("Subtracting single digits", "sub-single"), M("Number bonds", "number-bonds"), M("Doubles and halves", "doubles-halves"),
    M("Basic mental arithmetic", "mental-basic"), M("Quick-fire practice", "speed-mixed")] },
  { title: "Arithmetic Fluency", summary: "Two-digit addition and subtraction, carrying and borrowing, calculation chains, complements to 100 and 1000, estimation and checking.", topics: ["Two-digit addition and subtraction", "Carrying and borrowing", "Calculation chains", "Complements to 100 and 1000", "Mental shortcuts", "Estimation and checking"], modules: [
    M("Two-digit addition", "add-2digit"), M("Two-digit subtraction", "sub-2digit"), M("Carrying", "add-carry"), M("Borrowing", "sub-borrow"), M("Calculation chains", "calc-chain"),
    M("Complements to 100", "complement-100"), M("Complements to 1000", "complement-1000"), M("Rounding shortcuts", "add-by-rounding"), M("Estimating answers", "estimate-sum"), M("Checking your answers", "digital-root")] },
  { title: "Multiplication & Division Foundations", summary: "Tables from 1 to 20, missing factors, two-digit by one-digit multiplication, exact division, remainders, divisibility rules and rapid recall.", topics: ["Multiplication tables 1 to 20", "Multiplication and division facts", "Two-digit by one-digit multiplication", "Exact division and remainders", "Divisibility rules", "Rapid recall"], modules: [
    M("Tables 2 to 5", "tables-easy"), M("Tables 6 to 10", "tables-mid"), M("Tables 11 to 20", "tables-teens"), M("Missing factors", "missing-factor"), M("Two-digit by one-digit", "mul-2x1"),
    M("Division facts", "div-facts"), M("Exact division", "div-exact"), M("Remainders", "div-remainder"), M("Divisibility rules", "divisible-by"), M("Rapid recall", "recall-mixed")] },
  { title: "Advanced Basic Calculations", summary: "Multi-digit addition and subtraction, two-digit and three-digit multiplication, long division, powers of ten, near numbers and mixed operations.", topics: ["Multi-digit addition and subtraction", "Two-digit and three-digit multiplication", "Division by one- and two-digit numbers", "Multiplying and dividing by 10, 100, 1000", "Near numbers", "Mixed operations"], modules: [
    M("Multi-digit addition", "add-multi"), M("Multi-digit subtraction", "sub-multi"), M("Two-digit by two-digit", "mul-2x2"), M("Three-digit multiplication", "mul-3x2"), M("Long division", "div-long"),
    M("Division by two-digit numbers", "div-2digit"), M("Multiplying and dividing by 10, 100, 1000", "mul-powers-10"), M("Near numbers", "near-round-mul"), M("Mixed operations", "mixed-ops")] },
  { title: "Number Mastery", summary: "Squares, cubes, roots, primes, factors and multiples, HCF and LCM, powers, last-digit and remainder patterns and fast squaring.", topics: ["Squares and cubes", "Square and cube roots", "Primes, factors and multiples", "HCF and LCM", "Powers", "Last digits and remainder patterns", "Fast squaring"], modules: [
    M("Squares", "squares"), M("Cubes", "cubes"), M("Square roots", "sqrt-perfect"), M("Cube roots", "cbrt-perfect"), M("Spotting primes", "prime-test"), M("Factors", "factor-count"),
    M("Multiples", "next-multiple"), M("HCF", "hcf"), M("LCM", "lcm"), M("Powers", "powers"), M("Last digits", "last-digit"), M("Remainder patterns", "remainder-pattern"), M("Fast squaring", "square-near-base")] },
  { title: "Fractions, Decimals & Percentages", summary: "Simplifying and comparing fractions, fraction and decimal arithmetic, conversions, common percentages, increase and decrease, recurring decimals and approximation.", topics: ["Simplifying and comparing fractions", "Fraction arithmetic", "Decimal arithmetic", "Fractions, decimals and percentages", "Common percentages", "Percentage increase and decrease", "Recurring decimals and approximation"], modules: [
    M("Simplifying fractions", "simplify-fraction"), M("Comparing fractions", "compare-fractions"), M("Adding and subtracting fractions", "fraction-addsub"), M("Multiplying and dividing fractions", "fraction-muldiv"),
    M("Decimal addition and subtraction", "decimal-addsub"), M("Decimal multiplication and division", "decimal-muldiv"), M("Fractions, decimals and percentages", "convert"), M("Percentage of an amount", "pct-of"),
    M("Increase and decrease", "pct-change"), M("Finding the percentage", "pct-what"), M("Approximating decimals", "round-decimal"), M("Recurring decimals", "recurring-digit")] },
  { title: "Mental Calculation Techniques", summary: "Multiplying by 11, 25, 50, 99 and 101, working near 10, 100 and 1000, squaring numbers ending in 5, compensation, Vedic-style methods and fast division.", topics: ["Shortcuts for 11, 25, 50, 99, 101", "Numbers near 100 and 1000", "Squaring numbers ending in 5", "Distributive and compensation methods", "Crosswise multiplication", "Fast division", "Choosing a strategy"], modules: [
    M("Multiplying by 11", "mul-11"), M("Multiplying by 25 and 50", "mul-25-50"), M("Multiplying by 99 and 101", "mul-99-101"), M("Numbers near 100 and 1000", "mul-near-base"), M("Squaring numbers ending in 5", "square-ends-5"),
    M("Distributive shortcuts", "distributive"), M("Compensation", "compensation"), M("Crosswise multiplication", "crosswise"), M("Fast division", "div-reciprocal"), M("Choosing the best strategy", "strategy-mixed")] },
  { title: "Numerical Operations & Algebra", summary: "Order of operations, negative numbers, fractions and decimals in multi-step work, missing numbers, substitution, simplifying, linear equations and identities.", topics: ["Order of operations", "Negative numbers", "Fractions and decimals in multi-step expressions", "Missing numbers and substitution", "Simplifying expressions", "Linear equations", "Identities"], modules: [
    M("Order of operations", "bodmas"), M("Negative numbers", "negatives"), M("Fractions and decimals together", "mixed-fracdec"), M("Missing numbers", "missing-number"), M("Substitution", "substitute"),
    M("Simplifying expressions", "like-terms"), M("One-step equations", "solve-1step"), M("Two-step equations", "solve-2step"), M("Unknowns on both sides", "solve-both"), M("Using identities", "identity-square")] },
  { title: "Ratios, Proportions & Averages", summary: "Ratios, direct and inverse proportion, sharing in a ratio, averages, weighted averages, missing values, mixtures and partnerships.", topics: ["Ratios and equivalent ratios", "Direct and inverse proportion", "Proportional division", "Averages and weighted averages", "Missing values in averages", "Mixtures and partnerships"], modules: [
    M("Simplifying ratios", "ratio-simplify"), M("Equivalent ratios", "ratio-missing"), M("Direct proportion", "direct-prop"), M("Inverse proportion", "inverse-prop"), M("Sharing in a ratio", "share-ratio"),
    M("Averages", "average"), M("Weighted averages", "weighted-average"), M("Missing values in averages", "average-missing"), M("Mixtures", "mixture"), M("Partnerships", "partnership")] },
  { title: "Applied Arithmetic", summary: "Profit, loss and discount, simple and compound interest, speed, distance and time, work and rates, ages, unit conversions and multi-step word problems.", topics: ["Profit, loss and discount", "Simple and compound interest", "Speed, distance and time", "Work and rates", "Ages", "Unit conversions", "Multi-step word problems"], modules: [
    M("Profit and loss", "profit-loss"), M("Discounts", "discount"), M("Simple interest", "simple-interest"), M("Compound interest", "compound-interest"), M("Speed, distance and time", "speed-distance-time"),
    M("Work and rates", "work-rate"), M("Ages", "ages"), M("Unit conversions", "unit-convert"), M("Multi-step word problems", "word-multistep"), M("Successive percentages", "successive-pct")] },
  { title: "Advanced Number Sense", summary: "Number series, missing terms, remainders and cycles of last digits, digit problems, quick comparisons, estimation, multi-step simplification and choosing efficient methods.", topics: ["Number series and missing terms", "Remainders and cycles", "Digit problems", "Quick comparisons", "Estimation", "Multi-step simplification", "Choosing efficient methods"], modules: [
    M("Number series", "series-next"), M("Missing terms", "series-missing"), M("Remainders of powers", "remainder-big"), M("Cycles of last digits", "unit-digit-power"), M("Digit problems", "digit-problem"),
    M("Quick comparisons", "quant-compare"), M("Estimation", "estimate-product"), M("Multi-step simplification", "simplify-multi"), M("Estimating roots", "approx-sqrt"), M("Choosing efficient methods", "efficient-mixed")] },
  { title: "Geometry & Measurement Calculations", summary: "Perimeter and area, triangles, quadrilaterals and circles, surface area and volume, angles, Pythagoras, formula recall and measurement conversions.", topics: ["Perimeter and area", "Triangles and quadrilaterals", "Circles", "Surface area and volume", "Angles", "Pythagoras", "Formula recall", "Measurement conversions"], modules: [
    M("Perimeter", "perimeter"), M("Area", "area-basic"), M("Triangle angles", "triangle-angles"), M("Quadrilateral areas", "quad-area"), M("Circles", "circle"), M("Surface area", "surface-area"),
    M("Volume", "volume"), M("Angles", "angle-calc"), M("Pythagoras", "pythagoras"), M("Formula recall", "formula-recall"), M("Measurement conversions", "measure-convert")] },
  { title: "Quantitative Data & Reasoning", summary: "Tables, bar charts, line graphs and pie charts, percentages and averages in data, basic probability, counting, arrangements and multi-step data questions.", topics: ["Tables and charts", "Percentages, ratios and averages in data", "Basic probability", "Counting", "Arrangements and selections", "Multi-step data interpretation"], modules: [
    M("Reading tables", "table-read"), M("Bar charts", "bar-chart"), M("Line graphs", "line-chart"), M("Pie charts", "pie-chart"), M("Percentages in data", "data-percent"),
    M("Averages in data", "data-average"), M("Basic probability", "probability-basic"), M("Counting", "counting-basic"), M("Arrangements and selections", "perm-comb-basic"), M("Multi-step data questions", "data-multistep")] },
  { title: "Advanced Mathematical Fluency", summary: "Simultaneous equations, quadratics and factorising, exponents, radicals, standard form, polynomials, advanced percentages and ratios, standard-angle values and combined shortcuts.", topics: ["Advanced algebra", "Quadratics and factorising", "Exponents and radicals", "Standard form", "Polynomials", "Advanced percentages and ratios", "Standard angle values", "Combined shortcuts"], modules: [
    M("Simultaneous equations", "algebra-adv"), M("Quadratic equations", "quadratic-roots"), M("Factorising", "factorise"), M("Exponents", "exponent-laws"), M("Radicals", "radicals"), M("Standard form", "sci-notation"),
    M("Polynomials", "polynomial-eval"), M("Advanced percentages and ratios", "pct-ratio-adv"), M("Values of standard angles", "trig-values"), M("Using identities", "trig-identity"), M("Combined shortcuts", "combined-shortcuts")] },
  { title: "Mastery & High-Speed Calculation", summary: "Large-number mental calculation, rapid mixed arithmetic, advanced multiplication and division, multi-step reasoning, calculation under time pressure, accuracy, high-difficulty problems and your personal benchmarks.", topics: ["Large-number mental calculation", "Rapid mixed arithmetic", "Advanced multiplication and division", "Multi-step reasoning", "Calculation under time pressure", "Accuracy and error reduction", "High-difficulty problems", "Cumulative mastery", "Personal benchmarks"], pass: 85, modules: [
    M("Large-number mental calculation", "large-mental"), M("Rapid mixed arithmetic", "rapid-mixed"), M("Advanced multiplication", "mul-adv"), M("Advanced division", "div-adv"), M("Multi-step reasoning", "reasoning-multistep"),
    M("Calculation under time pressure", "pressure-mixed"), M("Accuracy and error spotting", "error-spot"), M("High-difficulty problems", "high-difficulty"), M("Cumulative mastery practice", "cumulative-mix"), M("Your speed and accuracy benchmark", "benchmark")] },
];

export const LEVELS: Level[] = DEFS.map((def, i) => {
  const n = i + 1;
  const modules: Module[] = def.modules.map((m, j) => ({ ...m, key: moduleKey(n, j + 1), level: n, n: j + 1, lesson: LESSONS[moduleKey(n, j + 1)] ?? null }));
  return { n, letter: levelLetter(n), title: def.title, summary: def.summary, topics: def.topics, pass: def.pass ?? 80, modules, authored: modules.every((m) => m.lesson !== null) };
});

export const level = (n: number): Level | null => LEVELS[n - 1] ?? null;
export const COURSE_TITLE = "Mathematics Speed Enhancement Studio";
export const COURSE_SLUG = "mathematics-speed-enhancement";
export const MAX_LEVEL = LEVELS.length;

const byKey = new Map(LEVELS.flatMap((l) => l.modules).map((m) => [m.key, m]));
export const moduleByKey = (key: string): Module | null => byKey.get(key.toUpperCase()) ?? null;
export const totalModules = (): number => byKey.size;

/** Every single skill a level teaches (mixed skills count for the level they belong to). */
export const skillsOfLevel = (n: number): string[] => [...new Set(LEVELS[n - 1].modules.flatMap((m) => m.skills))];
/** The first skill's level, for finding which level a skill belongs to. */
export const levelOfSkill = (id: string): number => skill(id)?.level ?? 1;
/** The module that follows (in the whole journey) or null at the end. */
export function nextModule(key: string): Module | null {
  const m = moduleByKey(key);
  if (!m) return null;
  const l = LEVELS[m.level - 1];
  return l.modules[m.n] ?? null;
}
