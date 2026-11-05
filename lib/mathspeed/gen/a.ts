import { digits, scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calc, choice, len, mixOf, n } from "./util";

/** Level A: Number Foundations. Numbers up to a few digits, single-digit work, bonds, patterns, first timed practice. */

const PLACES = ["ones", "tens", "hundreds", "thousands", "ten-thousands", "hundred-thousands", "millions"];

const placeValue: Generator = (r, d) => {
  const k = scale(d, 2, 7);
  let v = digits(r, k);
  // Higher difficulty allows zeros inside the number, so the student has to read the place, not just pick a digit.
  const pos = r.int(0, k - 1);
  const dig = Math.floor(v / 10 ** pos) % 10;
  if (dig === 0) v += 10 ** pos * r.int(1, 9);
  const digit = Math.floor(v / 10 ** pos) % 10;
  if (d >= 4 && r.chance(0.5)) {
    return { prompt: `Which digit is in the ${PLACES[pos]} place of ${n(v)}?`, answer: String(digit), working: [`Count places from the right: ones, tens, hundreds...`, `The ${PLACES[pos]} place of ${n(v)} holds ${digit}.`], params: { n: v, pos, variant: "digit" }, size: k };
  }
  const value = digit * 10 ** pos;
  return calc(`What is the value of the digit ${digit} in ${n(v)}? (The ${digit} is in the ${PLACES[pos]} place.)`, String(value), `${digit}*${10 ** pos}`, [`The ${digit} is in the ${PLACES[pos]} place.`, `Its value is ${digit} x ${n(10 ** pos)} = ${n(value)}.`], { n: v, pos, variant: "value" }, k);
};

const expandedForm: Generator = (r, d) => {
  const k = scale(d, 2, 6);
  const parts: number[] = [];
  for (let p = k - 1; p >= 0; p--) parts.push(p === k - 1 ? r.int(1, 9) : r.int(0, 9));
  const shown = parts.map((x, i) => ({ x, p: k - 1 - i })).filter((t) => t.x > 0);
  const text = shown.map((t) => (t.p === 0 ? `${t.x}` : `${t.x} × ${n(10 ** t.p)}`)).join(" + ");
  const value = parts.reduce((s, x, i) => s + x * 10 ** (k - 1 - i), 0);
  const expr = shown.map((t) => `${t.x}*${10 ** t.p}`).join("+");
  return calc(`${text} = ?`, String(value), expr, [`Add the parts: ${shown.map((t) => n(t.x * 10 ** t.p)).join(" + ")} = ${n(value)}.`], { parts: parts.join(","), k }, k);
};

const countOn: Generator = (r, d) => {
  const steps = d <= 3 ? [2, 5, 10] : d <= 6 ? [3, 4, 6, 20, 25] : [7, 8, 9, 12, 15, 50, 100];
  const step = r.pick(steps);
  const back = d >= 5 && r.chance(0.4);
  const startBase = back ? step * r.int(8, 14) : r.int(0, 6) * step + (d >= 6 ? r.int(0, step - 1) : 0);
  const seq = [0, 1, 2, 3].map((i) => startBase + (back ? -i : i) * step);
  const k = 4;
  const ans = startBase + (back ? -k : k) * step;
  const sg = back ? "-" : "+";
  return calc(`Next number: ${seq.map(n).join(", ")}, ?`, String(ans), `${startBase}${sg}${k}*${step}`, [`The pattern ${back ? "goes down" : "goes up"} by ${step} each time.`, `${n(seq[3])} ${back ? "-" : "+"} ${step} = ${n(ans)}.`], { start: startBase, step, back: back ? 1 : 0, shown: 4 }, Math.max(2, String(Math.abs(ans)).length));
};

const compareNumbers: Generator = (r, d) => {
  const k = scale(d, 2, 6);
  let a = digits(r, k);
  let b = d >= 5 ? a + r.int(1, 9) * 10 ** r.int(0, Math.max(0, k - 3)) * (r.chance(0.5) ? 1 : -1) : digits(r, k);
  if (b === a || len(b) !== k) b = a + (a > 10 ** (k - 1) + 5 ? -3 : 3);
  const three = d >= 7;
  const c = three ? digits(r, k) : 0;
  const larger = r.chance(0.5);
  const list = three ? [a, b, c] : [a, b];
  if (new Set(list).size < list.length) list[list.length - 1] += 1;
  const want = larger ? Math.max(...list) : Math.min(...list);
  const others = list.filter((x) => x !== want);
  return choice(r, `Which is ${larger ? "the largest" : "the smallest"}: ${list.map(n).join(", ")}?`, n(want), others.map(n), [`Compare the digits from the left, one place at a time.`, `${larger ? "Largest" : "Smallest"} is ${n(want)}.`], { list: list.join(","), larger: larger ? 1 : 0 }, k);
};

const addSingle: Generator = (r, d) => {
  if (d <= 3) { const a = r.int(1, 6), b = r.int(1, 10 - a); return calc(`${a} + ${b} = ?`, String(a + b), `${a}+${b}`, [`${a} + ${b} = ${a + b}`], { a, b }, 1); }
  if (d <= 7) { const a = r.int(2, 9), b = r.int(Math.max(2, 11 - a), 9); return calc(`${a} + ${b} = ?`, String(a + b), `${a}+${b}`, [`Make 10 first: ${a} + ${10 - a} = 10, then add the other ${b - (10 - a)}.`, `${a} + ${b} = ${a + b}`], { a, b }, 1); }
  const a = r.int(3, 9), b = r.int(3, 9), c = r.int(2, 9);
  return calc(`${a} + ${b} + ${c} = ?`, String(a + b + c), `${a}+${b}+${c}`, [`Look for a pair that makes 10, then add the rest.`, `${a} + ${b} + ${c} = ${a + b + c}`], { a, b, c }, 1);
};

const subSingle: Generator = (r, d) => {
  if (d <= 3) { const a = r.int(3, 10), b = r.int(1, a - 1); return calc(`${a} - ${b} = ?`, String(a - b), `${a}-${b}`, [`${a} - ${b} = ${a - b}`], { a, b }, 1); }
  if (d <= 7) { const a = r.int(11, 18), b = r.int(a - 9, 9); return calc(`${a} - ${b} = ?`, String(a - b), `${a}-${b}`, [`Take away to 10 first: ${a} - ${a - 10} = 10, then take the other ${b - (a - 10)}.`, `${a} - ${b} = ${a - b}`], { a, b }, 1); }
  const a = r.int(14, 25), b = r.int(2, 9), c = r.int(2, Math.min(9, a - b));
  return calc(`${a} - ${b} - ${c} = ?`, String(a - b - c), `${a}-${b}-${c}`, [`${a} - ${b} = ${a - b}, then - ${c} = ${a - b - c}.`], { a, b, c }, 2);
};

const numberBonds: Generator = (r, d) => {
  const total = d <= 4 ? 10 : d <= 7 ? r.pick([10, 12, 15, 20]) : r.pick([14, 16, 17, 18, 19, 20]);
  const known = r.int(1, total - 1);
  const first = r.chance(0.5);
  const q = first ? `${known} + ? = ${total}` : `? + ${known} = ${total}`;
  return calc(q, String(total - known), `${total}-${known}`, [`${total} - ${known} = ${total - known}`, `Check: ${known} + ${total - known} = ${total}.`], { total, known }, len(total));
};

const doublesHalves: Generator = (r, d) => {
  const half = d >= 4 && r.chance(0.5);
  if (half) { const h = r.int(Math.max(2, scale(d, 2, 40)), scale(d, 6, 99)); const x = h * 2; return calc(`Half of ${x} = ?`, String(h), `${x}/2`, [`Half of ${x} is ${h}, because ${h} + ${h} = ${x}.`], { x, op: "half" }, len(x)); }
  const x = r.int(Math.max(2, scale(d, 2, 30)), scale(d, 9, 99));
  return calc(`Double ${x} = ?`, String(x * 2), `${x}*2`, [`Double the tens and the ones separately, then add.`, `${x} + ${x} = ${x * 2}`], { x, op: "double" }, len(x));
};

const mentalBasic: Generator = (r, d) => {
  if (d <= 3) { const a = r.int(1, 5) * 10, b = r.int(1, 5) * 10, add = r.chance(0.6); const [x, y] = add ? [a, b] : [Math.max(a, b) + 10, Math.min(a, b)]; return calc(`${x} ${add ? "+" : "-"} ${y} = ?`, String(add ? x + y : x - y), `${x}${add ? "+" : "-"}${y}`, [`Think in tens: ${x / 10} tens ${add ? "plus" : "minus"} ${y / 10} tens.`], { x, y, add: add ? 1 : 0 }, 2); }
  if (d <= 7) {
    const add = r.chance(0.5), ones = r.int(1, 5), x = r.int(1, 8) * 10 + ones, cross = d >= 6;
    const y = cross ? (add ? 10 - ones + r.int(1, 5) : ones + r.int(1, 5)) : add ? r.int(1, 9 - ones) : r.int(1, ones);
    const res = add ? x + y : x - y;
    return calc(`${x} ${add ? "+" : "-"} ${y} = ?`, String(res), `${x}${add ? "+" : "-"}${y}`, [cross ? `Jump to the next ten first, then use the rest of ${y}.` : `Only the ones change: ${ones} ${add ? "+" : "-"} ${y}.`, `${x} ${add ? "+" : "-"} ${y} = ${res}`], { x, y, add: add ? 1 : 0 }, 2);
  }
  const a = r.int(12, 68), b = r.int(11, 31), add = r.chance(0.5);
  const x = add ? a : a + b;
  return calc(`${x} ${add ? "+" : "-"} ${b} = ?`, String(add ? x + b : x - b), `${x}${add ? "+" : "-"}${b}`, [`Split ${b} into tens and ones: ${Math.floor(b / 10) * 10} + ${b % 10}.`, `${add ? "Add" : "Subtract"} the tens, then the ones.`], { x, y: b, add: add ? 1 : 0 }, 2);
};

const speedMixed: Generator = mixOf([["add-single", addSingle], ["sub-single", subSingle], ["number-bonds", numberBonds], ["doubles-halves", doublesHalves]]);

export const LEVEL_A: Skill[] = [
  S("place-value", "Place value", 1, [4000, 8000], 7, placeValue),
  S("expanded-form", "Reading numbers in parts", 1, [6000, 12000], 6, expandedForm),
  S("count-on", "Counting patterns", 1, [4000, 9000], 6, countOn),
  S("compare-numbers", "Comparing numbers", 1, [3500, 8000], 6, compareNumbers),
  S("add-single", "Adding single digits", 1, [2500, 6000], 7, addSingle),
  S("sub-single", "Subtracting single digits", 1, [2800, 7000], 7, subSingle),
  S("number-bonds", "Number bonds", 1, [2800, 6000], 7, numberBonds),
  S("doubles-halves", "Doubles and halves", 1, [3000, 8000], 7, doublesHalves),
  S("mental-basic", "Basic mental arithmetic", 1, [4000, 9000], 7, mentalBasic),
  S("speed-mixed", "Quick-fire mixed practice", 1, [2500, 6500], 7, speedMixed),
];
