import { scale } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calcE, gcd, len, money, things, two } from "./util";

/** Level I: Ratios, Proportions and Averages. Word problems take their names, currency and items from the student's context; the numbers never change with it. */

const ratioSimplify: Generator = (r, d) => {
  const parts = d >= 7 ? 3 : 2;
  let base: number[];
  for (;;) {
    base = Array.from({ length: parts }, () => r.int(1, scale(d, 6, 15)));
    if (gcd(gcd(base[0], base[1]), parts === 3 ? base[2] : base[0]) === 1 && new Set(base).size > 1) break;
  }
  const k = r.int(2, scale(d, 9, 24));
  const terms = base.map((x) => x * k);
  const decimal = d >= 8 && r.chance(0.4);
  const shown = decimal ? terms.map((t) => (t / 10).toFixed(1)).join(" : ") : terms.join(" : ");
  const t = decimal ? terms : terms;
  return { prompt: `Simplify the ratio ${shown} to its simplest whole-number form. (Write it like 2:3.)`, answer: base.join(":"), kind: "text", working: [decimal ? `Remove the decimal points by multiplying every term by 10: ${t.join(" : ")}.` : `Divide every term by their highest common factor, ${k}.`, `${t.join(" : ")} = ${base.join(" : ")}`], params: { terms: t.join(",") }, size: len(Math.max(...t)) };
};

const ratioMissing: Generator = (r, d) => {
  const a = r.int(2, scale(d, 6, 15)), b = r.int(a + 1, a + scale(d, 5, 12));
  const k = r.int(2, scale(d, 6, 14));
  const first = r.chance(0.5);
  return first ? calcE(`${a} : ${b} = ${a * k} : ?`, `${a * k}*${b}/${a}`, [`Both terms of ${a} : ${b} were multiplied by ${k}.`, `${b} × ${k} = ${b * k}.`], { a, b, k, pos: 2 }, len(a * k)) : calcE(`${a} : ${b} = ? : ${b * k}`, `${b * k}*${a}/${b}`, [`${b} became ${b * k}, so multiply ${a} by ${k} too.`, `${a} × ${k} = ${a * k}.`], { a, b, k, pos: 1 }, len(b * k));
};

const directProp: Generator = (r, d, ctx) => {
  const item = r.pick(things(ctx));
  const a = r.int(2, scale(d, 8, 20)), b = r.int(a + 1, a + scale(d, 8, 30));
  const u = r.int(2, scale(d, 12, 95));
  const total = u * a;
  return calcE(`${a} ${item} cost ${money(ctx, total)}. How much do ${b} ${item} cost? (${ctx.currency.trim()})`, `${total}/${a}*${b}`, [`Find the cost of one: ${money(ctx, total)} ÷ ${a} = ${money(ctx, u)}.`, `${b} × ${money(ctx, u)} = ${money(ctx, u * b)}.`], { a, b, total }, len(u * b));
};

const inverseProp: Generator = (r, d, ctx) => {
  const [p] = two(r, ctx);
  const x = r.int(2, scale(d, 8, 18)), days = r.int(3, scale(d, 12, 30));
  const total = x * days;
  const divs: number[] = [];
  for (let y = 2; y <= total; y++) if (total % y === 0 && y !== x && y <= scale(d, 20, 60)) divs.push(y);
  const y = divs.length ? r.pick(divs) : x * 2;
  const ans = total / y;
  return calcE(`${x} workers finish a job in ${days} days. ${p}'s manager brings in ${y} workers working at the same rate. How many days does the job take?`, `${x}*${days}/${y}`, [`More workers means fewer days. Total work = ${x} × ${days} = ${total} worker-days.`, `${total} ÷ ${y} = ${ans} days.`], { x, days, y }, len(total));
};

const shareRatio: Generator = (r, d, ctx) => {
  const three = d >= 7;
  const parts = Array.from({ length: three ? 3 : 2 }, () => r.int(1, scale(d, 5, 9)));
  const sum = parts.reduce((s, v) => s + v, 0);
  const unit = r.int(scale(d, 3, 20), scale(d, 20, 120));
  const total = sum * unit;
  const ask = r.int(0, parts.length - 1);
  const label = three ? ["first", "second", "third"][ask] : ["first", "second"][ask];
  const [nm] = two(r, ctx);
  return calcE(`${nm} shares ${money(ctx, total)} in the ratio ${parts.join(" : ")}. How much is the ${label} share? (${ctx.currency.trim()})`, `${total}/${sum}*${parts[ask]}`, [`Total parts: ${parts.join(" + ")} = ${sum}.`, `One part = ${money(ctx, total)} ÷ ${sum} = ${money(ctx, unit)}.`, `${label} share = ${parts[ask]} × ${money(ctx, unit)} = ${money(ctx, unit * parts[ask])}.`], { total, parts: parts.join(","), ask }, len(total));
};

const average: Generator = (r, d) => {
  const count = scale(d, 4, 8);
  const hi = scale(d, 20, 400);
  const xs = Array.from({ length: count }, () => r.int(Math.floor(hi / 4), hi));
  if (d < 8) { const rem = xs.reduce((s, v) => s + v, 0) % count; xs[0] += rem === 0 ? 0 : count - rem; }
  else if (xs.reduce((s, v) => s + v, 0) % (count % 2 === 0 ? count / 2 : count) !== 0) xs[0] += 1;
  const sum = xs.reduce((s, v) => s + v, 0);
  return calcE(`Find the mean of ${xs.join(", ")}.`, `(${xs.join("+")})/${count}`, [`Add the numbers: ${sum}.`, `Divide by how many there are: ${sum} ÷ ${count}.`], { xs: xs.join(",") }, len(sum));
};

const weightedAverage: Generator = (r, d) => {
  const totals = [10, 20, 25, 40, 50, 100];
  const t = r.pick(totals);
  const n1 = r.int(1, t - 1), n2 = t - n1;
  const m1 = r.int(scale(d, 20, 40), scale(d, 60, 95)), m2 = r.int(scale(d, 20, 40), scale(d, 60, 95));
  if (d >= 5 && r.chance(0.5)) return calcE(`Test A counts for ${n1 * (100 / t)}% of a grade and Test B for ${n2 * (100 / t)}%. A student scores ${m1} in A and ${m2} in B. What is the weighted grade?`, `(${n1 * (100 / t)}*${m1}+${n2 * (100 / t)}*${m2})/100`, [`Weight each score: ${n1 * (100 / t)}% × ${m1} + ${n2 * (100 / t)}% × ${m2}.`, `Divide by 100.`], { n1, n2, m1, m2, t, pct: 1 }, 3);
  return calcE(`A group of ${n1} has a mean of ${m1} and a group of ${n2} has a mean of ${m2}. What is the mean of all ${t}?`, `(${n1}*${m1}+${n2}*${m2})/${t}`, [`Total of the first group: ${n1} × ${m1} = ${n1 * m1}; second: ${n2} × ${m2} = ${n2 * m2}.`, `Combined mean = ${n1 * m1 + n2 * m2} ÷ ${t}.`], { n1, n2, m1, m2, t, pct: 0 }, 3);
};

const averageMissing: Generator = (r, d) => {
  const count = r.int(4, scale(d, 5, 9));
  const avg = r.int(scale(d, 8, 30), scale(d, 40, 200));
  if (d >= 5 && r.chance(0.5)) {
    const t = r.int(1, scale(d, 6, 20));
    const x = avg + (count + 1) * t;
    return calcE(`The mean of ${count} numbers is ${avg}. A new number ${x} is added. What is the new mean?`, `(${avg}*${count}+${x})/${count + 1}`, [`Old total = ${avg} × ${count} = ${avg * count}.`, `New total = ${avg * count} + ${x} = ${avg * count + x}; new mean = ${avg * count + x} ÷ ${count + 1}.`], { count, avg, x, form: 1 }, 3);
  }
  const known = Array.from({ length: count - 1 }, () => r.int(Math.max(1, avg - scale(d, 6, 30)), avg + scale(d, 6, 30)));
  const missing = avg * count - known.reduce((s, v) => s + v, 0);
  if (missing < 1) known[0] -= 1 - missing;
  const miss = avg * count - known.reduce((s, v) => s + v, 0);
  return calcE(`The mean of ${count} numbers is ${avg}. ${count - 1} of them are ${known.join(", ")}. What is the other number?`, `${avg}*${count}-(${known.join("+")})`, [`Total = ${avg} × ${count} = ${avg * count}.`, `Known numbers add to ${known.reduce((s, v) => s + v, 0)}, so the missing number is ${miss}.`], { count, avg, known: known.join(","), form: 0 }, 3);
};

const mixture: Generator = (r, d, ctx) => {
  const totals = [10, 20, 25, 40, 50];
  const t = r.pick(totals);
  const q1 = r.int(1, t - 1), q2 = t - q1;
  if (d >= 4 && r.chance(0.5)) {
    const c1 = r.int(5, 40), c2 = r.int(c1 + 5, 70);
    return calcE(`${q1} litres of a ${c1}% solution are mixed with ${q2} litres of a ${c2}% solution. What is the percentage of the mixture?`, `(${q1}*${c1}+${q2}*${c2})/${t}`, [`Pure amount from each: ${q1} × ${c1}% and ${q2} × ${c2}%.`, `Total pure = (${q1 * c1} + ${q2 * c2}) ÷ 100 litres in ${t} litres.`], { q1, q2, c1, c2, form: 1 }, 3, { unit: "%" });
  }
  const p1 = r.int(scale(d, 20, 30), scale(d, 60, 90)), p2 = r.int(p1 + 5, p1 + scale(d, 20, 60));
  return calcE(`${q1} kg of rice at ${money(ctx, p1)} per kg is mixed with ${q2} kg at ${money(ctx, p2)} per kg. What is the price per kg of the mixture? (${ctx.currency.trim()})`, `(${q1}*${p1}+${q2}*${p2})/${t}`, [`Total cost = ${q1} × ${p1} + ${q2} × ${p2} = ${q1 * p1 + q2 * p2}.`, `Total weight = ${t} kg, so price per kg = ${(q1 * p1 + q2 * p2) / t}.`], { q1, q2, p1, p2, form: 0 }, 3);
};

const partnership: Generator = (r, d, ctx) => {
  const [a, b] = two(r, ctx);
  const ca = r.int(2, scale(d, 6, 15)) * 1000, cb = r.int(2, scale(d, 6, 15)) * 1000;
  const ma = r.int(3, 12), mb = r.int(3, 12);
  const ra = (ca / 1000) * ma, rb = (cb / 1000) * mb;
  const sum = ra + rb;
  const g = gcd(sum, 1000);
  const P = (sum / g) * 1000 * r.int(1, scale(d, 3, 9));
  return calcE(`${a} invests ${money(ctx, ca)} for ${ma} months and ${b} invests ${money(ctx, cb)} for ${mb} months. They share a profit of ${money(ctx, P)} in proportion to money × time. What is ${a}'s share? (${ctx.currency.trim()})`, `${P}*${ra}/${sum}`, [`Compare money × time: ${a}: ${ca / 1000}k × ${ma} = ${ra}; ${b}: ${cb / 1000}k × ${mb} = ${rb}.`, `Ratio ${ra} : ${rb}, so ${a} gets ${ra}/${sum} of ${money(ctx, P)}.`], { ca, cb, ma, mb, P }, len(P));
};

export const LEVEL_I: Skill[] = [
  S("ratio-simplify", "Simplifying ratios", 9, [6000, 18000], 8, ratioSimplify),
  S("ratio-missing", "Equivalent ratios", 9, [6000, 16000], 8, ratioMissing),
  S("direct-prop", "Direct proportion", 9, [8000, 22000], 8, directProp),
  S("inverse-prop", "Inverse proportion", 9, [10000, 26000], 8, inverseProp),
  S("share-ratio", "Sharing in a ratio", 9, [9000, 24000], 8, shareRatio),
  S("average", "Averages", 9, [8000, 24000], 8, average),
  S("weighted-average", "Weighted averages", 9, [10000, 28000], 8, weightedAverage),
  S("average-missing", "Missing values in averages", 9, [10000, 28000], 8, averageMissing),
  S("mixture", "Mixtures", 9, [12000, 30000], 8, mixture),
  S("partnership", "Partnerships", 9, [14000, 34000], 8, partnership),
];
