import { scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calcE, choice, len } from "./util";

/** Level L: Geometry and Measurement Calculations. Every figure is described in words and numbers; the formula is part of the working. */

const perimeter: Generator = (r, d) => {
  const hi = scale(d, 12, 60);
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3, 4]);
  const l = r.int(3, hi), w = r.int(2, hi);
  switch (form) {
    case 0: return calcE(`Find the perimeter of a rectangle ${l} cm long and ${w} cm wide.`, `2*(${l}+${w})`, [`Perimeter = 2 × (length + width).`, `2 × (${l} + ${w}) = ${2 * (l + w)} cm.`], { form, l, w }, len(2 * (l + w)), { unit: "cm" });
    case 1: return calcE(`Find the perimeter of a square with side ${l} cm.`, `4*${l}`, [`Perimeter = 4 × side = 4 × ${l} = ${4 * l} cm.`], { form, l }, len(4 * l), { unit: "cm" });
    case 2: { const c = r.int(3, hi); return calcE(`A triangle has sides ${l} cm, ${w} cm and ${c} cm. What is its perimeter?`, `${l}+${w}+${c}`, [`Add the three sides: ${l} + ${w} + ${c} = ${l + w + c} cm.`], { form, l, w, c }, len(l + w + c), { unit: "cm" }); }
    case 3: { const sides = r.pick([5, 6, 8, 10, 12]); return calcE(`A regular polygon has ${sides} equal sides of ${l} cm. What is its perimeter?`, `${sides}*${l}`, [`Perimeter = number of sides × side length = ${sides} × ${l} = ${sides * l} cm.`], { form, sides, l }, len(sides * l), { unit: "cm" }); }
    default: return calcE(`A rectangle has perimeter ${2 * (l + w)} cm and length ${l} cm. What is its width in cm?`, `${2 * (l + w)}/2-${l}`, [`Half the perimeter = length + width = ${l + w} cm.`, `Width = ${l + w} - ${l} = ${w} cm.`], { form, per: 2 * (l + w), l }, len(2 * (l + w)), { unit: "cm" });
  }
};

const areaBasic: Generator = (r, d) => {
  const hi = scale(d, 12, 50);
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3, 4]);
  const l = r.int(3, hi), w = r.int(2, hi);
  switch (form) {
    case 0: return calcE(`Find the area of a rectangle ${l} cm by ${w} cm.`, `${l}*${w}`, [`Area = length × width = ${l} × ${w} = ${l * w} cm².`], { form, l, w }, len(l * w), { unit: "cm²" });
    case 1: return calcE(`Find the area of a square with side ${l} cm.`, `${l}*${l}`, [`Area = side² = ${l} × ${l} = ${l * l} cm².`], { form, l }, len(l * l), { unit: "cm²" });
    case 2: { const b = 2 * r.int(2, hi / 2), h = r.int(3, hi); return calcE(`Find the area of a triangle with base ${b} cm and height ${h} cm.`, `${b}*${h}/2`, [`Area = ½ × base × height.`, `½ × ${b} × ${h} = ${(b * h) / 2} cm².`], { form, b, h }, len(b * h), { unit: "cm²" }); }
    case 3: return calcE(`A rectangle has area ${l * w} cm² and length ${l} cm. What is its width in cm?`, `${l * w}/${l}`, [`Width = area ÷ length.`, `${l * w} ÷ ${l} = ${w} cm.`], { form, area: l * w, l }, len(l * w), { unit: "cm" });
    default: { const a2 = r.int(2, 6), b2 = r.int(2, 6); const W = l + a2, H = w + b2; return calcE(`A rectangle ${W} cm by ${H} cm has a rectangular piece ${a2} cm by ${b2} cm cut out of it. What is the area left?`, `${W}*${H}-${a2}*${b2}`, [`Whole rectangle: ${W} × ${H} = ${W * H} cm².`, `Piece: ${a2} × ${b2} = ${a2 * b2} cm².`, `Left: ${W * H} - ${a2 * b2} = ${W * H - a2 * b2} cm².`], { form, W, H, a2, b2 }, len(W * H), { unit: "cm²" }); }
  }
};

const triangleAngles: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0] : d <= 6 ? [0, 1, 2] : [0, 1, 2, 3]);
  switch (form) {
    case 0: { const a = r.int(20, 80), b = r.int(20, 160 - a - 10); return calcE(`Two angles of a triangle are ${a}° and ${b}°. What is the third angle?`, `180-${a}-${b}`, [`The angles of a triangle add to 180°.`, `180 - ${a} - ${b} = ${180 - a - b}°.`], { form, a, b }, 3, { unit: "°" }); }
    case 1: { const apex = 2 * r.int(10, 80); return calcE(`An isosceles triangle has an apex angle of ${apex}°. What is each base angle?`, `(180-${apex})/2`, [`The two base angles are equal and the three angles add to 180°.`, `(180 - ${apex}) ÷ 2 = ${(180 - apex) / 2}°.`], { form, apex }, 3, { unit: "°" }); }
    case 2: { const a = r.int(25, 80), b = r.int(25, 80); return calcE(`In a triangle two interior angles are ${a}° and ${b}°. What is the exterior angle at the third vertex?`, `${a}+${b}`, [`An exterior angle equals the sum of the two opposite interior angles.`, `${a} + ${b} = ${a + b}°.`], { form, a, b }, 3, { unit: "°" }); }
    default: {
      const parts = r.pick([[1, 2, 3], [2, 3, 4], [2, 3, 5], [1, 1, 2], [3, 4, 5], [1, 4, 7], [2, 5, 11]]);
      const sum = parts[0] + parts[1] + parts[2], big = Math.max(...parts);
      return calcE(`The angles of a triangle are in the ratio ${parts.join(" : ")}. What is the largest angle?`, `180/${sum}*${big}`, [`${parts.join(" + ")} = ${sum} parts make 180°, so one part is ${180 / sum}°.`, `Largest angle = ${big} × ${180 / sum}° = ${(180 / sum) * big}°.`], { form, parts: parts.join(",") }, 3, { unit: "°" });
    }
  }
};

const quadArea: Generator = (r, d) => {
  const hi = scale(d, 12, 40);
  const form = r.pick(d <= 3 ? [0] : [0, 1, 2]);
  if (form === 0) { const b = r.int(4, hi), h = r.int(3, hi); return calcE(`Find the area of a parallelogram with base ${b} cm and height ${h} cm.`, `${b}*${h}`, [`Area = base × perpendicular height = ${b} × ${h} = ${b * h} cm².`], { form, b, h }, len(b * h), { unit: "cm²" }); }
  if (form === 1) { const a = r.int(4, hi), b = r.int(4, hi), h = 2 * r.int(2, hi / 2); return calcE(`A trapezium has parallel sides ${a} cm and ${b} cm and height ${h} cm. What is its area?`, `(${a}+${b})*${h}/2`, [`Area = ½ × (sum of parallel sides) × height.`, `½ × (${a} + ${b}) × ${h} = ${((a + b) * h) / 2} cm².`], { form, a, b, h }, len(a * h), { unit: "cm²" }); }
  const d1 = 2 * r.int(2, hi / 2), d2 = r.int(4, hi);
  return calcE(`A rhombus has diagonals ${d1} cm and ${d2} cm. What is its area?`, `${d1}*${d2}/2`, [`Area = ½ × product of the diagonals.`, `½ × ${d1} × ${d2} = ${(d1 * d2) / 2} cm².`], { form, d1, d2 }, len(d1 * d2), { unit: "cm²" });
};

const circle: Generator = (r, d) => {
  const sevens = d <= 6 || r.chance(0.5);
  const rad = sevens ? 7 * r.int(1, scale(d, 3, 9)) : r.int(2, scale(d, 10, 30));
  const piTxt = sevens ? "22/7" : "3.14";
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3]);
  const asDiameter = d >= 4 && r.chance(0.4);
  const given = asDiameter ? `diameter ${2 * rad} cm` : `radius ${rad} cm`;
  switch (form) {
    case 0: return calcE(`Take π = ${piTxt}. Find the circumference of a circle with ${given}.`, `2*${piTxt}*${rad}`, [`Circumference = 2πr${asDiameter ? ` (the radius is half of ${2 * rad}, so ${rad})` : ""}.`, `2 × ${piTxt} × ${rad}.`], { form, rad, pi: piTxt }, 3, { unit: "cm" });
    case 1: return calcE(`Take π = ${piTxt}. Find the area of a circle with ${given}.`, `${piTxt}*${rad}*${rad}`, [`Area = πr²${asDiameter ? ` (radius ${rad})` : ""}.`, `${piTxt} × ${rad} × ${rad}.`], { form, rad, pi: piTxt }, 3, { unit: "cm²" });
    case 2: return calcE(`Take π = ${piTxt}. Find the area of a semicircle with radius ${rad} cm.`, `${piTxt}*${rad}*${rad}/2`, [`A semicircle is half a circle: ½ × πr².`, `½ × ${piTxt} × ${rad} × ${rad}.`], { form, rad, pi: piTxt }, 3, { unit: "cm²" });
    default: return calcE(`Take π = ${piTxt}. A circle has circumference ${sevens ? 2 * 22 * (rad / 7) : Math.round(2 * 3.14 * rad * 100) / 100} cm. What is its radius in cm?`, `${rad}`, [`Circumference = 2πr, so r = circumference ÷ (2π).`, `The radius is ${rad} cm.`], { form, rad, pi: piTxt }, 3, { unit: "cm" });
  }
};

const surfaceArea: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3]);
  const a = r.int(2, scale(d, 8, 20)), b = r.int(2, scale(d, 8, 20)), c = r.int(2, scale(d, 8, 20));
  switch (form) {
    case 0: return calcE(`Find the total surface area of a cube with edge ${a} cm.`, `6*${a}*${a}`, [`A cube has 6 equal square faces.`, `6 × ${a}² = ${6 * a * a} cm².`], { form, a }, len(6 * a * a), { unit: "cm²" });
    case 1: return calcE(`Find the total surface area of a cuboid ${a} cm × ${b} cm × ${c} cm.`, `2*(${a}*${b}+${b}*${c}+${a}*${c})`, [`Surface area = 2(lb + bh + lh).`, `2 × (${a * b} + ${b * c} + ${a * c}) = ${2 * (a * b + b * c + a * c)} cm².`], { form, a, b, c }, len(2 * (a * b + b * c + a * c)), { unit: "cm²" });
    case 2: { const rad = 7 * r.int(1, 3), h = r.int(2, scale(d, 10, 25)); return calcE(`Take π = 22/7. Find the curved surface area of a cylinder with radius ${rad} cm and height ${h} cm.`, `2*22/7*${rad}*${h}`, [`Curved surface area = 2πrh.`, `2 × 22/7 × ${rad} × ${h} = ${44 * (rad / 7) * h} cm².`], { form, rad, h }, 4, { unit: "cm²" }); }
    default: { const rad = 7 * r.int(1, 3), h = r.int(2, scale(d, 10, 25)); return calcE(`Take π = 22/7. Find the total surface area of a closed cylinder with radius ${rad} cm and height ${h} cm.`, `2*22/7*${rad}*(${rad}+${h})`, [`Total surface area = 2πr(r + h).`, `2 × 22/7 × ${rad} × (${rad} + ${h}).`], { form, rad, h }, 4, { unit: "cm²" }); }
  }
};

const volume: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0, 1] : d <= 7 ? [0, 1, 2, 3] : [1, 2, 3, 4, 5]);
  const a = r.int(2, scale(d, 8, 20)), b = r.int(2, scale(d, 8, 20)), c = r.int(2, scale(d, 8, 20));
  switch (form) {
    case 0: return calcE(`Find the volume of a cube with edge ${a} cm.`, `${a}^3`, [`Volume = edge³ = ${a}³ = ${a ** 3} cm³.`], { form, a }, len(a ** 3), { unit: "cm³" });
    case 1: return calcE(`Find the volume of a cuboid ${a} cm × ${b} cm × ${c} cm.`, `${a}*${b}*${c}`, [`Volume = length × width × height = ${a} × ${b} × ${c} = ${a * b * c} cm³.`], { form, a, b, c }, len(a * b * c), { unit: "cm³" });
    case 2: { const rad = 7 * r.int(1, 2), h = r.int(2, scale(d, 10, 25)); return calcE(`Take π = 22/7. Find the volume of a cylinder with radius ${rad} cm and height ${h} cm.`, `22/7*${rad}*${rad}*${h}`, [`Volume = πr²h.`, `22/7 × ${rad} × ${rad} × ${h}.`], { form, rad, h }, 4, { unit: "cm³" }); }
    case 3: { const rad = 7 * r.int(1, 2), h = 3 * r.int(1, 6); return calcE(`Take π = 22/7. Find the volume of a cone with radius ${rad} cm and height ${h} cm.`, `22/7*${rad}*${rad}*${h}/3`, [`Volume of a cone = ⅓πr²h.`, `⅓ × 22/7 × ${rad} × ${rad} × ${h}.`], { form, rad, h }, 4, { unit: "cm³" }); }
    case 4: return calcE(`Take π = 22/7. Find the volume of a sphere with radius 21 cm.`, `4/3*22/7*21*21*21`, [`Volume of a sphere = 4/3 πr³.`, `4/3 × 22/7 × 21 × 21 × 21 = 38808 cm³.`], { form }, 5, { unit: "cm³" });
    default: return calcE(`A cuboid tank ${a} m × ${b} m × ${c} m is full of water. How many litres of water is that? (1 m³ = 1000 litres)`, `${a}*${b}*${c}*1000`, [`Volume = ${a} × ${b} × ${c} = ${a * b * c} m³.`, `1 m³ = 1000 litres, so ${a * b * c * 1000} litres.`], { form: 5, a, b, c }, len(a * b * c * 1000), { unit: "litres" });
  }
};

const angleCalc: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0, 1] : d <= 6 ? [0, 1, 2, 3] : [2, 3, 4, 5]);
  switch (form) {
    case 0: { const a = r.int(20, 160); return calcE(`Two angles on a straight line are ${a}° and x. Find x.`, `180-${a}`, [`Angles on a straight line add to 180°.`, `180 - ${a} = ${180 - a}°.`], { form, a }, 3, { unit: "°" }); }
    case 1: { const a = r.int(40, 120), b = r.int(40, 120), c = r.int(30, 360 - a - b - 10); return calcE(`Three angles around a point are ${a}°, ${b}° and ${c}°, and the fourth is x. Find x.`, `360-${a}-${b}-${c}`, [`Angles around a point add to 360°.`, `360 - ${a} - ${b} - ${c} = ${360 - a - b - c}°.`], { form, a, b, c }, 3, { unit: "°" }); }
    case 2: { const a = r.int(40, 140); return calcE(`Two parallel lines are cut by a transversal. One co-interior (same-side) angle is ${a}°. What is the other?`, `180-${a}`, [`Co-interior angles between parallel lines add to 180°.`, `180 - ${a} = ${180 - a}°.`], { form, a }, 3, { unit: "°" }); }
    case 3: { const sides = r.pick([5, 6, 7, 8, 9, 10, 12]); return calcE(`What is the sum of the interior angles of a polygon with ${sides} sides?`, `(${sides}-2)*180`, [`Sum of interior angles = (n - 2) × 180°.`, `(${sides} - 2) × 180 = ${(sides - 2) * 180}°.`], { form, sides }, 4, { unit: "°" }); }
    case 4: { const sides = r.pick([5, 6, 8, 9, 10, 12, 15, 18, 20]); return calcE(`What is each interior angle of a regular polygon with ${sides} sides?`, `(${sides}-2)*180/${sides}`, [`Sum of angles = (${sides} - 2) × 180° = ${(sides - 2) * 180}°.`, `Divide by ${sides} equal angles.`], { form, sides }, 4, { unit: "°" }); }
    default: { const sides = r.pick([5, 6, 8, 9, 10, 12, 15, 18, 20, 24]); return calcE(`What is each exterior angle of a regular polygon with ${sides} sides?`, `360/${sides}`, [`Exterior angles of any polygon add to 360°.`, `360 ÷ ${sides} = ${360 / sides}°.`], { form, sides }, 3, { unit: "°" }); }
  }
};

const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37]];
const pythagoras: Generator = (r, d) => {
  const [a, b, c] = r.pick(TRIPLES.slice(0, scale(d, 2, 7)));
  const k = r.int(1, scale(d, 3, 9));
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2]);
  const [A, B, C] = [a * k, b * k, c * k];
  if (form === 0) return calcE(`A right-angled triangle has shorter sides ${A} cm and ${B} cm. How long is the hypotenuse?`, `${C}`, [`c² = ${A}² + ${B}² = ${A * A} + ${B * B} = ${C * C}.`, `c = √${C * C} = ${C} cm.`], { form, A, B }, len(C * C), { unit: "cm" });
  if (form === 1) return calcE(`The hypotenuse of a right-angled triangle is ${C} cm and one side is ${A} cm. How long is the other side?`, `${B}`, [`b² = ${C}² - ${A}² = ${C * C} - ${A * A} = ${B * B}.`, `b = √${B * B} = ${B} cm.`], { form, C, A }, len(C * C), { unit: "cm" });
  return calcE(`A rectangle is ${A} cm by ${B} cm. How long is its diagonal?`, `${C}`, [`The diagonal makes a right-angled triangle with the sides.`, `d² = ${A}² + ${B}² = ${C * C}, so d = ${C} cm.`], { form, A, B }, len(C * C), { unit: "cm" });
};

const FORMULAS: Array<{ ask: string; right: string; wrong: string[] }> = [
  { ask: "area of a triangle", right: "½ × base × height", wrong: ["base × height", "½ × base × base", "2 × (base + height)"] },
  { ask: "area of a circle", right: "π × r²", wrong: ["2 × π × r", "π × d", "π × r"] },
  { ask: "circumference of a circle", right: "2 × π × r", wrong: ["π × r²", "π × r", "4 × π × r"] },
  { ask: "area of a trapezium", right: "½ × (a + b) × h", wrong: ["(a + b) × h", "½ × a × b", "a × b × h"] },
  { ask: "volume of a cylinder", right: "π × r² × h", wrong: ["2 × π × r × h", "⅓ × π × r² × h", "π × r × h"] },
  { ask: "volume of a cone", right: "⅓ × π × r² × h", wrong: ["π × r² × h", "½ × π × r² × h", "⅓ × π × r × h"] },
  { ask: "volume of a sphere", right: "4/3 × π × r³", wrong: ["4 × π × r²", "⅓ × π × r³", "4/3 × π × r²"] },
  { ask: "surface area of a sphere", right: "4 × π × r²", wrong: ["4/3 × π × r³", "2 × π × r²", "π × r²"] },
  { ask: "total surface area of a cube with edge a", right: "6 × a²", wrong: ["4 × a²", "a³", "12 × a"] },
  { ask: "area of a rhombus with diagonals p and q", right: "½ × p × q", wrong: ["p × q", "½ × (p + q)", "p + q"] },
  { ask: "sum of the interior angles of an n-sided polygon", right: "(n − 2) × 180°", wrong: ["n × 180°", "(n − 1) × 180°", "(n − 2) × 360°"] },
  { ask: "Pythagoras' theorem for hypotenuse c", right: "c² = a² + b²", wrong: ["c = a + b", "c² = a² − b²", "c = a² + b²"] },
  { ask: "curved surface area of a cylinder", right: "2 × π × r × h", wrong: ["π × r² × h", "2 × π × r × (r + h)", "π × r × h"] },
  { ask: "volume of a cuboid", right: "l × b × h", wrong: ["2(lb + bh + lh)", "l + b + h", "⅓ × l × b × h"] },
];
const formulaRecall: Generator = (r, d) => {
  const pool = FORMULAS.slice(0, scale(d, 6, FORMULAS.length));
  const f = r.pick(pool);
  return choice(r, `Which formula gives the ${f.ask}?`, f.right, f.wrong, [`The ${f.ask} is ${f.right}.`], { ask: f.ask }, 2);
};

const MEASURES: Array<{ from: string; to: string; num: number; den: number }> = [
  { from: "m²", to: "cm²", num: 10000, den: 1 }, { from: "cm²", to: "mm²", num: 100, den: 1 }, { from: "km²", to: "m²", num: 1000000, den: 1 },
  { from: "hectares", to: "m²", num: 10000, den: 1 }, { from: "litres", to: "cm³", num: 1000, den: 1 }, { from: "m³", to: "litres", num: 1000, den: 1 },
  { from: "cm²", to: "m²", num: 1, den: 10000 }, { from: "mm²", to: "cm²", num: 1, den: 100 }, { from: "cm³", to: "litres", num: 1, den: 1000 }, { from: "m³", to: "cm³", num: 1000000, den: 1 },
  { from: "m²", to: "hectares", num: 1, den: 10000 }, { from: "ml", to: "cm³", num: 1, den: 1 },
];
const measureConvert: Generator = (r, d) => {
  const c = r.pick(MEASURES.slice(0, scale(d, 6, MEASURES.length)));
  const value = r.int(2, scale(d, 20, 3000));
  return calcE(`Convert ${value} ${c.from} to ${c.to}.`, `${value}*${c.num}/${c.den}`, [`1 ${c.from} = ${c.num / c.den} ${c.to}.`, `${value} × ${c.num}${c.den === 1 ? "" : `/${c.den}`} in ${c.to}.`], { value, num: c.num, den: c.den }, len(value), { unit: c.to });
};

export const LEVEL_L: Skill[] = [
  S("perimeter", "Perimeter", 12, [7000, 20000], 8, perimeter),
  S("area-basic", "Area", 12, [7000, 22000], 8, areaBasic),
  S("triangle-angles", "Triangle angles", 12, [7000, 20000], 8, triangleAngles),
  S("quad-area", "Quadrilateral areas", 12, [9000, 24000], 8, quadArea),
  S("circle", "Circles", 12, [10000, 28000], 8, circle),
  S("surface-area", "Surface area", 12, [12000, 32000], 8, surfaceArea),
  S("volume", "Volume", 12, [12000, 34000], 8, volume),
  S("angle-calc", "Angles", 12, [7000, 22000], 8, angleCalc),
  S("pythagoras", "Pythagoras", 12, [9000, 26000], 8, pythagoras),
  S("formula-recall", "Formula recall", 12, [5000, 14000], 8, formulaRecall),
  S("measure-convert", "Measurement conversions", 12, [8000, 22000], 8, measureConvert),
];
