import { scale, type Rng } from "../rng";
import type { Generator, Skill } from "../types";
import { S, calcE, gcd, len, money, things, two } from "./util";

/** Level J: Applied Arithmetic. Everyday money, travel, work and measurement problems; names, items and currency follow the student's context, the numbers do not. */

/** The smallest amount for which pct% of it is a whole number, times a random whole multiplier (so answers stay exact). */
function wholeBase(r: Rng, pct: number, hi: number): number {
  const u = Math.round(1000 / gcd(Math.round(pct * 10), 1000));
  return u * r.int(1, Math.max(1, Math.floor(hi / u)));
}
const PCT_J = [5, 10, 12.5, 15, 20, 25, 30, 40, 50, 8, 18, 35];

const profitLoss: Generator = (r, d, ctx) => {
  const pct = r.pick(d <= 4 ? [10, 20, 25, 50, 5] : PCT_J);
  const cp = wholeBase(r, pct, scale(d, 600, 8000));
  const item = r.pick(things(ctx)).replace(/s$/, "");
  const profit = r.chance(0.6);
  const delta = (cp * pct) / 100;
  const sp = profit ? cp + delta : cp - delta;
  const form = d <= 3 ? 0 : r.pick([0, 1, 2]);
  if (form === 0) return calcE(`A ${item} is bought for ${money(ctx, cp)} and sold at a ${pct}% ${profit ? "profit" : "loss"}. What is the selling price?`, `${cp}*(100${profit ? "+" : "-"}${pct})/100`, [`${profit ? "Profit" : "Loss"} = ${pct}% of ${money(ctx, cp)} = ${money(ctx, delta)}.`, `Selling price = ${money(ctx, cp)} ${profit ? "+" : "-"} ${money(ctx, delta)} = ${money(ctx, sp)}.`], { form, cp, pct, profit: profit ? 1 : 0 }, len(cp));
  if (form === 1) return calcE(`A ${item} bought for ${money(ctx, cp)} is sold for ${money(ctx, sp)}. What is the ${profit ? "profit" : "loss"} percentage?`, `(${profit ? sp - cp : cp - sp})/${cp}*100`, [`${profit ? "Profit" : "Loss"} = ${money(ctx, Math.abs(sp - cp))}.`, `${Math.abs(sp - cp)} ÷ ${cp} × 100 = ${pct}%.`], { form, cp, sp, profit: profit ? 1 : 0 }, len(cp), { unit: "%" });
  return calcE(`A ${item} is sold for ${money(ctx, sp)}, which is a ${pct}% ${profit ? "profit" : "loss"}. What did it cost?`, `${sp}*100/(100${profit ? "+" : "-"}${pct})`, [`Selling price is ${profit ? 100 + pct : 100 - pct}% of the cost price.`, `Cost = ${sp} ÷ ${profit ? 100 + pct : 100 - pct} × 100 = ${money(ctx, cp)}.`], { form, sp, pct, profit: profit ? 1 : 0 }, len(sp));
};

const discount: Generator = (r, d, ctx) => {
  const pct = r.pick(d <= 4 ? [10, 20, 25, 50] : PCT_J);
  const mp = wholeBase(r, pct, scale(d, 800, 9000));
  const item = r.pick(things(ctx)).replace(/s$/, "");
  const off = (mp * pct) / 100;
  const form = d <= 3 ? 0 : r.pick([0, 1, 2]);
  if (form === 0) return calcE(`A ${item} is marked ${money(ctx, mp)} with ${pct}% off. What do you pay?`, `${mp}*(100-${pct})/100`, [`Discount = ${pct}% of ${money(ctx, mp)} = ${money(ctx, off)}.`, `You pay ${money(ctx, mp)} - ${money(ctx, off)} = ${money(ctx, mp - off)}.`], { form, mp, pct }, len(mp));
  if (form === 1) return calcE(`A ${item} marked ${money(ctx, mp)} is sold for ${money(ctx, mp - off)}. What is the discount percentage?`, `${off}/${mp}*100`, [`Discount = ${money(ctx, mp)} - ${money(ctx, mp - off)} = ${money(ctx, off)}.`, `${off} ÷ ${mp} × 100 = ${pct}%.`], { form, mp, sp: mp - off }, len(mp), { unit: "%" });
  return calcE(`After ${pct}% off, a ${item} costs ${money(ctx, mp - off)}. What was the marked price?`, `${mp - off}*100/(100-${pct})`, [`The price paid is ${100 - pct}% of the marked price.`, `${mp - off} ÷ ${100 - pct} × 100 = ${money(ctx, mp)}.`], { form, sp: mp - off, pct }, len(mp));
};

const simpleInterest: Generator = (r, d, ctx) => {
  const rate = r.pick([4, 5, 6, 8, 10, 12, 7.5, 2.5]);
  const years = r.int(1, scale(d, 4, 9));
  const months = d >= 6 && r.chance(0.4);
  const t = months ? years * 12 : years;
  const unitP = Math.round(1000 / gcd(Math.round(rate * 10), 1000)) * (months ? 12 : 1) * 10;
  const P = unitP * r.int(1, Math.max(1, Math.floor(scale(d, 4000, 60000) / unitP)));
  const [nm] = two(r, ctx);
  const tt = months ? `${t} months` : `${t} year${t > 1 ? "s" : ""}`;
  const timeExpr = months ? `${t}/12` : `${t}`;
  const si = (P * rate * (months ? t / 12 : t)) / 100;
  const form = d <= 3 ? 0 : r.pick([0, 1, 2]);
  if (form === 0) return calcE(`${nm} invests ${money(ctx, P)} at ${rate}% simple interest per year for ${tt}. How much interest is earned?`, `${P}*${rate}*${timeExpr}/100`, [`Simple interest = principal × rate × time ÷ 100.`, `${P} × ${rate} × ${months ? `${t}/12` : t} ÷ 100 = ${money(ctx, si)}.`], { form, P, rate, t, months: months ? 1 : 0 }, len(P));
  if (form === 1) return calcE(`${nm} invests ${money(ctx, P)} at ${rate}% simple interest per year for ${tt}. What is the total amount at the end?`, `${P}+${P}*${rate}*${timeExpr}/100`, [`Interest = ${P} × ${rate} × ${months ? `${t}/12` : t} ÷ 100 = ${money(ctx, si)}.`, `Amount = ${money(ctx, P)} + ${money(ctx, si)} = ${money(ctx, P + si)}.`], { form, P, rate, t, months: months ? 1 : 0 }, len(P));
  return calcE(`${money(ctx, P)} earns ${money(ctx, si)} simple interest in ${tt}. What is the yearly rate of interest?`, `${si}*100/(${P}*${timeExpr})`, [`Rate = interest × 100 ÷ (principal × time).`, `${si} × 100 ÷ (${P} × ${months ? `${t}/12` : t}) = ${rate}%.`], { form, P, si, t, months: months ? 1 : 0 }, len(P), { unit: "%" });
};

const compoundInterest: Generator = (r, d, ctx) => {
  const rate = r.pick(d <= 5 ? [10, 20, 5] : [5, 10, 20, 4, 8, 12, 15]);
  const years = d <= 6 ? 2 : r.pick([2, 3]);
  const P = r.int(1, scale(d, 5, 30)) * 1000;
  const [nm] = two(r, ctx);
  const ask = r.chance(0.5) ? "amount" : "interest";
  const expr = ask === "amount" ? `${P}*((100+${rate})/100)^${years}` : `${P}*((100+${rate})/100)^${years}-${P}`;
  return calcE(`${nm} invests ${money(ctx, P)} at ${rate}% compound interest per year for ${years} years. What is the ${ask === "amount" ? "total amount" : "compound interest earned"}?`, expr, [`Each year the amount is multiplied by ${1 + rate / 100}.`, `After ${years} years: ${P} × ${1 + rate / 100}${years === 2 ? "²" : "³"}.`, ask === "interest" ? `Subtract the ${money(ctx, P)} invested to get the interest.` : `That is the total amount.`], { P, rate, years, ask: ask === "amount" ? 1 : 0 }, len(P));
};

const speedDistanceTime: Generator = (r, d, ctx) => {
  const v = r.int(scale(d, 20, 40), scale(d, 60, 120));
  const t = r.pick(d <= 4 ? [1, 2, 3, 4] : [1.5, 2.5, 3, 4, 0.5, 2.25, 1.25]);
  const dist = v * t;
  const form = d <= 3 ? r.pick([0, 1]) : r.pick([0, 1, 2, 3]);
  const [nm] = two(r, ctx);
  if (form === 0) return calcE(`${nm} drives ${dist} km in ${t} hours. What is the average speed in km/h?`, `${dist}/${t}`, [`Speed = distance ÷ time.`, `${dist} ÷ ${t} = ${v} km/h.`], { form, dist, t }, len(dist), { unit: "km/h" });
  if (form === 1) return calcE(`${nm} travels at ${v} km/h for ${t} hours. How far is that in km?`, `${v}*${t}`, [`Distance = speed × time.`, `${v} × ${t} = ${dist} km.`], { form, v, t }, len(dist), { unit: "km" });
  if (form === 2) return calcE(`A journey of ${dist} km is made at ${v} km/h. How many hours does it take?`, `${dist}/${v}`, [`Time = distance ÷ speed.`, `${dist} ÷ ${v} = ${t} hours.`], { form, dist, v }, len(dist), { unit: "hours" });
  const v2 = r.int(scale(d, 20, 40), scale(d, 60, 100));
  const t2 = r.pick([1, 2, 3, 4, 0.5]);
  return calcE(`${nm} drives ${v} km/h for ${t} hours and then ${v2} km/h for ${t2} hours. What is the average speed for the whole trip, in km/h?`, `(${v}*${t}+${v2}*${t2})/(${t}+${t2})`, [`Total distance = ${v} × ${t} + ${v2} × ${t2} = ${v * t + v2 * t2} km.`, `Total time = ${t} + ${t2} = ${t + t2} hours.`, `Average speed = total distance ÷ total time.`], { form, v, t, v2, t2 }, 3, { unit: "km/h" });
};

const workRate: Generator = (r, d, ctx) => {
  const t = r.int(2, scale(d, 8, 24));
  const t2 = t * t;
  const divs: number[] = [];
  for (let u = 1; u <= t2; u++) if (t2 % u === 0 && u !== t && t + u <= 120) divs.push(u);
  const u = r.pick(divs);
  const x = t + u, y = t + t2 / u;
  const [a, b] = two(r, ctx);
  const form = d <= 4 ? 0 : r.pick([0, 1]);
  if (form === 0) return calcE(`${a} can do a job in ${x} days and ${b} can do it in ${y} days. Working together, how many days do they take?`, `1/(1/${x}+1/${y})`, [`In one day ${a} does 1/${x} and ${b} does 1/${y} of the job.`, `Together: 1/${x} + 1/${y} = ${x + y}/${x * y}, so they need ${x * y}/${x + y} = ${t} days.`], { form, x, y }, len(x * y));
  return calcE(`${a} alone can do a job in ${x} days. ${a} and ${b} together take ${t} days. How many days would ${b} take alone?`, `1/(1/${t}-1/${x})`, [`Together they do 1/${t} per day; ${a} does 1/${x}.`, `${b} does 1/${t} - 1/${x} per day, which is 1/${y}, so ${y} days.`], { form, x, t }, len(x * y));
};

const ages: Generator = (r, d, ctx) => {
  const [a, b] = two(r, ctx);
  const k = r.int(2, 5);
  const young = r.int(scale(d, 4, 8), scale(d, 16, 30));
  const old = k * young;
  const form = d <= 4 ? 0 : r.pick([0, 1, 2]);
  if (form === 0) return calcE(`${a} is ${k} times as old as ${b}. Together their ages add up to ${old + young}. How old is ${a}?`, `${old + young}*${k}/(${k}+1)`, [`${a}'s age is ${k} parts, ${b}'s is 1 part: ${k + 1} parts in all.`, `One part = ${old + young} ÷ ${k + 1} = ${young}.`, `${a} is ${k} × ${young} = ${old}.`], { form, k, S: old + young }, 2);
  if (form === 1) {
    const t = r.int(2, 10);
    return calcE(`${a} is ${k} times as old as ${b}. In ${t} years the sum of their ages will be ${old + young + 2 * t}. How old is ${b} now?`, `(${old + young + 2 * t}-2*${t})/(${k}+1)`, [`Now their ages add up to ${old + young + 2 * t} - 2 × ${t} = ${old + young}.`, `${k + 1} parts = ${old + young}, so ${b} is ${young}.`], { form, k, S: old + young + 2 * t, t }, 2);
  }
  const m = r.int(2, 4), yrs = r.int(1, 12), kid = r.int(5, 20);
  const parent = m * (kid + yrs) - yrs;
  return calcE(`${a} is ${parent} years old and ${b} is ${kid}. In how many years will ${a} be exactly ${m} times as old as ${b}?`, `(${parent}-${m}*${kid})/(${m}-1)`, [`After n years: ${parent} + n = ${m} × (${kid} + n).`, `${parent} - ${m * kid} = (${m} - 1) × n, so n = ${yrs}.`], { form, parent, kid, m }, 3);
};

const CONV: Array<{ from: string; to: string; num: number; den: number; mult: number }> = [
  { from: "km", to: "m", num: 1000, den: 1, mult: 1 }, { from: "m", to: "cm", num: 100, den: 1, mult: 1 }, { from: "kg", to: "g", num: 1000, den: 1, mult: 1 },
  { from: "litres", to: "ml", num: 1000, den: 1, mult: 1 }, { from: "hours", to: "minutes", num: 60, den: 1, mult: 1 }, { from: "minutes", to: "seconds", num: 60, den: 1, mult: 1 },
  { from: "cm", to: "mm", num: 10, den: 1, mult: 1 }, { from: "days", to: "hours", num: 24, den: 1, mult: 1 }, { from: "metres", to: "km", num: 1, den: 1000, mult: 1 },
  { from: "g", to: "kg", num: 1, den: 1000, mult: 1 }, { from: "ml", to: "litres", num: 1, den: 1000, mult: 1 }, { from: "minutes", to: "hours", num: 1, den: 60, mult: 3 },
  { from: "km/h", to: "m/s", num: 5, den: 18, mult: 18 }, { from: "m/s", to: "km/h", num: 18, den: 5, mult: 5 }, { from: "seconds", to: "minutes", num: 1, den: 60, mult: 3 }, { from: "cm", to: "m", num: 1, den: 100, mult: 1 },
];
const unitConvert: Generator = (r, d) => {
  const pool = CONV.slice(0, scale(d, 8, CONV.length));
  const c = r.pick(pool);
  const decimals = d >= 6 && r.chance(0.5) && c.den !== 60 && c.den !== 18 && c.den !== 5;
  const base = r.int(2, scale(d, 20, 400)) * c.mult;
  const value = decimals ? base / 10 : base;
  const vs = String(value);
  return calcE(`Convert ${vs} ${c.from} to ${c.to}.`, `${vs}*${c.num}/${c.den}`, [`1 ${c.from} = ${c.num / c.den} ${c.to}.`, `${vs} × ${c.num}${c.den === 1 ? "" : `/${c.den}`} = answer in ${c.to}.`], { value: vs, num: c.num, den: c.den }, len(base), { unit: c.to });
};

const wordMultistep: Generator = (r, d, ctx) => {
  const [a] = two(r, ctx);
  const its = things(ctx);
  const k1 = r.int(0, its.length - 1), k2 = (k1 + 1 + r.int(0, its.length - 2)) % its.length;
  const [i1, i2] = [its[k1], its[k2]];
  const form = d <= 3 ? 0 : r.pick([0, 1, 2, 3]);
  if (form === 0) {
    const q1 = r.int(2, scale(d, 5, 12)), p1 = r.int(5, scale(d, 30, 120)), q2 = r.int(2, scale(d, 5, 10)), p2 = r.int(3, scale(d, 20, 80));
    const cost = q1 * p1 + q2 * p2;
    const pay = Math.ceil((cost + 1) / 100) * 100;
    return calcE(`${a} buys ${q1} ${i1} at ${money(ctx, p1)} each and ${q2} ${i2} at ${money(ctx, p2)} each, and pays with ${money(ctx, pay)}. How much change is given?`, `${pay}-(${q1}*${p1}+${q2}*${p2})`, [`${q1} × ${p1} = ${q1 * p1}; ${q2} × ${p2} = ${q2 * p2}.`, `Total = ${cost}; change = ${pay} - ${cost} = ${pay - cost}.`], { form, q1, p1, q2, p2, pay }, len(pay));
  }
  if (form === 1) {
    const adults = r.int(2, scale(d, 6, 20)), kids = r.int(2, scale(d, 6, 20)), pa = r.int(10, scale(d, 60, 200)), pk = r.int(5, pa - 2);
    return calcE(`Tickets cost ${money(ctx, pa)} for an adult and ${money(ctx, pk)} for a child. A group of ${adults} adults and ${kids} children go together. What is the total cost?`, `${adults}*${pa}+${kids}*${pk}`, [`Adults: ${adults} × ${pa} = ${adults * pa}.`, `Children: ${kids} × ${pk} = ${kids * pk}.`, `Total = ${adults * pa + kids * pk}.`], { form, adults, kids, pa, pk }, len(adults * pa));
  }
  if (form === 2) {
    const rate = r.int(20, scale(d, 60, 200)), h = r.int(3, scale(d, 8, 40)), cost = r.int(10, rate * h - 1);
    return calcE(`${a} earns ${money(ctx, rate)} an hour for ${h} hours and then spends ${money(ctx, cost)}. How much is left?`, `${rate}*${h}-${cost}`, [`Earnings = ${rate} × ${h} = ${rate * h}.`, `Left = ${rate * h} - ${cost} = ${rate * h - cost}.`], { form, rate, h, cost }, len(rate * h));
  }
  const people = r.pick([2, 4, 5, 8, 10]);
  const each = r.int(20, scale(d, 100, 400));
  const bill = each * people;
  return calcE(`A bill of ${money(ctx, bill)} is shared equally by ${people} people, and each adds a ${money(ctx, Math.round(each / 10))} tip. How much does each person pay?`, `${bill}/${people}+${Math.round(each / 10)}`, [`Each share = ${bill} ÷ ${people} = ${each}.`, `Add the tip: ${each} + ${Math.round(each / 10)} = ${each + Math.round(each / 10)}.`], { form, bill, people, tip: Math.round(each / 10) }, len(bill));
};

const successivePct: Generator = (r, d, ctx) => {
  const a = r.pick([10, 20, 25, 50, 5, 15, 30, 40]), b = r.pick([10, 20, 25, 50, 5, 15, 30, 40]);
  const up1 = r.chance(0.6), up2 = r.chance(0.4);
  const form = d <= 3 ? 0 : r.pick([0, 1, 2]);
  const f1 = 100 + (up1 ? a : -a), f2 = 100 + (up2 ? b : -b);
  if (form === 0) return calcE(`A price ${up1 ? "rises" : "falls"} by ${a}% and then ${up2 ? "rises" : "falls"} by ${b}%. What is the net percentage change? (Use a minus sign for a fall.)`, `${f1}*${f2}/100-100`, [`Multiply the factors: ${f1}/100 × ${f2}/100.`, `${f1} × ${f2} ÷ 100 = ${(f1 * f2) / 100}, which is ${(f1 * f2) / 100 - 100}% change.`], { form, a, b, up1: up1 ? 1 : 0, up2: up2 ? 1 : 0 }, 3, { unit: "%" });
  if (form === 1) {
    const base = r.int(1, 40) * 100;
    return calcE(`${money(ctx, base)} ${up1 ? "increases" : "decreases"} by ${a}% and the result then ${up2 ? "increases" : "decreases"} by ${b}%. What is the final amount?`, `${base}*${f1}/100*${f2}/100`, [`After the first change: ${base} × ${f1}/100 = ${(base * f1) / 100}.`, `After the second: ${(base * f1) / 100} × ${f2}/100.`], { form, base, a, b, up1: up1 ? 1 : 0, up2: up2 ? 1 : 0 }, len(base));
  }
  return calcE(`Two successive discounts of ${a}% and ${b}% are the same as one discount of what percentage?`, `100-(100-${a})*(100-${b})/100`, [`Pay ${100 - a}% then ${100 - b}%: ${100 - a} × ${100 - b} ÷ 100 = ${((100 - a) * (100 - b)) / 100}% of the price.`, `So the single discount is 100 - ${((100 - a) * (100 - b)) / 100}.`], { form, a, b }, 3, { unit: "%" });
};

export const LEVEL_J: Skill[] = [
  S("profit-loss", "Profit and loss", 10, [10000, 28000], 8, profitLoss),
  S("discount", "Discounts", 10, [9000, 26000], 8, discount),
  S("simple-interest", "Simple interest", 10, [10000, 30000], 8, simpleInterest),
  S("compound-interest", "Compound interest", 10, [14000, 38000], 8, compoundInterest),
  S("speed-distance-time", "Speed, distance and time", 10, [9000, 28000], 8, speedDistanceTime),
  S("work-rate", "Work and rates", 10, [12000, 34000], 8, workRate),
  S("ages", "Ages", 10, [12000, 32000], 8, ages),
  S("unit-convert", "Unit conversions", 10, [6000, 18000], 8, unitConvert),
  S("word-multistep", "Multi-step word problems", 10, [12000, 36000], 8, wordMultistep),
  S("successive-pct", "Successive percentages", 10, [12000, 32000], 8, successivePct),
];
