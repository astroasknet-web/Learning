import { scale, type Rng } from "../rng";
import type { Built, Generator, Skill } from "../types";
import { S, calcE, gcd, len } from "./util";

/** Level M: Quantitative Data and Reasoning. Tables and charts are generated as data and drawn by the page; probability and counting are kept small on purpose. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SUBJECTS = ["Maths", "Science", "English", "History", "Art", "Music", "Sport"];
const SHOPS = ["North", "South", "East", "West", "Central", "Harbour"];

function series(r: Rng, d: number, labels: string[], count: number): { labels: string[]; values: number[] } {
  const start = r.int(0, labels.length - count);
  const lo = scale(d, 5, 40), hi = scale(d, 30, 400);
  const step = hi >= 100 ? 5 : 1;
  const values = Array.from({ length: count }, () => r.int(Math.ceil(lo / step), Math.floor(hi / step)) * step);
  return { labels: labels.slice(start, start + count), values };
}
const lists = (xs: number[]): string => xs.join(",");
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

const tableRead: Generator = (r, d) => {
  const count = scale(d, 4, 6);
  const { labels, values } = series(r, d, DAYS, count);
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3]);
  const [i, j] = [r.int(0, count - 1), (r.int(0, count - 2) + 1)];
  const jj = (i + j) % count;
  const visual: Built["visual"] = { type: "table", head: ["Day", "Visitors"], rows: labels.map((l, k) => [l, values[k]]) };
  const base = { form, values: lists(values), i, j: jj };
  switch (form) {
    case 0: return { ...calcE(`The table shows visitors to a museum each day. How many visitors came in total?`, values.join("+"), [`Add the column: ${values.join(" + ")} = ${sum(values)}.`], base, len(sum(values))), visual };
    case 1: return { ...calcE(`The table shows visitors to a museum each day. How many came on ${labels[i]} and ${labels[jj]} together?`, `${values[i]}+${values[jj]}`, [`${labels[i]}: ${values[i]}; ${labels[jj]}: ${values[jj]}.`, `${values[i]} + ${values[jj]} = ${values[i] + values[jj]}.`], base, 3), visual };
    case 2: return { ...calcE(`The table shows visitors to a museum each day. What is the difference between the busiest and the quietest day?`, `${Math.max(...values)}-${Math.min(...values)}`, [`Busiest: ${Math.max(...values)}; quietest: ${Math.min(...values)}.`, `${Math.max(...values)} - ${Math.min(...values)} = ${Math.max(...values) - Math.min(...values)}.`], base, 3), visual };
    default: return { ...calcE(`The table shows visitors to a museum each day. How many more came on ${labels[i]} than on ${labels[jj]}? (If fewer, give a negative number.)`, `${values[i]}-${values[jj]}`, [`${values[i]} - ${values[jj]} = ${values[i] - values[jj]}.`], base, 3), visual };
  }
};

const barChart: Generator = (r, d) => {
  const count = scale(d, 4, 6);
  const { labels, values } = series(r, d, SHOPS, count);
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2]);
  const i = r.int(0, count - 1), j = (i + 1 + r.int(0, count - 2)) % count;
  const visual: Built["visual"] = { type: "bar", title: "Items sold by each shop", labels, values };
  const base = { form, values: lists(values), i, j };
  if (form === 0) return { ...calcE(`The bar chart shows items sold by each shop. How many items did ${labels[i]} and ${labels[j]} sell together?`, `${values[i]}+${values[j]}`, [`Read the bars: ${labels[i]} = ${values[i]}, ${labels[j]} = ${values[j]}.`, `Add them: ${values[i] + values[j]}.`], base, 3), visual };
  if (form === 1) return { ...calcE(`The bar chart shows items sold by each shop. How many items were sold in total?`, values.join("+"), [`Add every bar: ${values.join(" + ")} = ${sum(values)}.`], base, len(sum(values))), visual };
  return { ...calcE(`The bar chart shows items sold by each shop. What is the mean number of items sold per shop?`, `(${values.join("+")})/${count}`, [`Total = ${sum(values)}, shops = ${count}.`, `Mean = ${sum(values)} ÷ ${count}.`], base, len(sum(values))), visual };
};

const lineChart: Generator = (r, d) => {
  const count = scale(d, 5, 7);
  const { labels, values } = series(r, d, MONTHS, count);
  const form = r.pick(d <= 3 ? [0] : [0, 1, 2]);
  const visual: Built["visual"] = { type: "line", title: "Temperature or sales by month", labels, values };
  if (form === 0) { const i = r.int(0, count - 2), j = r.int(i + 1, count - 1); return { ...calcE(`The line graph shows monthly sales. What is the change from ${labels[i]} to ${labels[j]}? (Use a minus sign for a fall.)`, `${values[j]}-${values[i]}`, [`${labels[j]} = ${values[j]}; ${labels[i]} = ${values[i]}.`, `${values[j]} - ${values[i]} = ${values[j] - values[i]}.`], { form, values: lists(values), i, j }, 3), visual }; }
  if (form === 1) return { ...calcE(`The line graph shows monthly sales. What is the highest value minus the lowest value?`, `${Math.max(...values)}-${Math.min(...values)}`, [`Highest ${Math.max(...values)}, lowest ${Math.min(...values)}.`], { form, values: lists(values) }, 3), visual };
  // percentage change between two months, made exact
  const base = r.int(2, 20) * 20, pct = r.pick([5, 10, 20, 25, 50]);
  const up = r.chance(0.6);
  const to = up ? base + (base * pct) / 100 : base - (base * pct) / 100;
  const vals = values.slice();
  vals[0] = base; vals[1] = to;
  return { ...calcE(`The line graph shows monthly sales. What is the percentage ${up ? "increase" : "decrease"} from ${labels[0]} to ${labels[1]}?`, `(${Math.abs(to - base)})/${base}*100`, [`Change = ${Math.abs(to - base)}; start = ${base}.`, `${Math.abs(to - base)} ÷ ${base} × 100 = ${pct}%.`], { form, base, to }, 3, { unit: "%" }), visual: { type: "line", title: "Monthly sales", labels, values: vals } };
};

const pieChart: Generator = (r, d) => {
  const sets: number[][] = [[50, 30, 20], [40, 25, 20, 15], [35, 25, 20, 10, 10], [45, 30, 15, 10], [60, 20, 10, 10], [25, 25, 30, 20]];
  const pcts = r.pick(sets.slice(0, scale(d, 3, 6)));
  const total = r.int(2, scale(d, 20, 100)) * 20;
  const i = r.int(0, pcts.length - 1);
  const labels = SUBJECTS.slice(0, pcts.length);
  const form = r.pick(d <= 3 ? [0] : [0, 1]);
  const visual: Built["visual"] = { type: "pie", title: "Share of time spent", labels, values: pcts };
  if (form === 0) return { ...calcE(`The pie chart shows how ${total} students chose a subject (each slice is a percentage). How many students chose ${labels[i]}?`, `${pcts[i]}*${total}/100`, [`${labels[i]} is ${pcts[i]}% of ${total}.`, `${pcts[i]} ÷ 100 × ${total} = ${(pcts[i] * total) / 100}.`], { form, pcts: lists(pcts), total, i }, len(total)), visual };
  return { ...calcE(`The pie chart shows the share for each subject. What angle at the centre is the ${labels[i]} slice?`, `${pcts[i]}*360/100`, [`The whole circle is 360°.`, `${pcts[i]}% of 360° = ${(pcts[i] * 360) / 100}°.`], { form, pcts: lists(pcts), i }, 3, { unit: "°" }), visual };
};

const dataPercent: Generator = (r, d) => {
  const count = scale(d, 3, 5);
  const unit = r.pick([20, 40]);
  // choose count-1 shares, then give the rest to the last
  const pcts: number[] = Array.from({ length: count - 1 }, () => r.pick([10, 15, 20, 25]));
  while (sum(pcts) >= 90) pcts.pop();
  pcts.push(100 - sum(pcts));
  const labels = SHOPS.slice(0, pcts.length);
  const total = unit * r.int(2, scale(d, 6, 20));
  const values = pcts.map((p) => (p * total) / 100);
  const i = r.int(0, values.length - 1);
  const visual: Built["visual"] = { type: "table", head: ["Shop", "Sales"], rows: labels.map((l, k) => [l, values[k]]) };
  return { ...calcE(`The table shows sales for each shop. What percentage of all sales was made by ${labels[i]}?`, `${values[i]}/${sum(values)}*100`, [`Total = ${values.join(" + ")} = ${sum(values)}.`, `${values[i]} ÷ ${sum(values)} × 100 = ${pcts[i]}%.`], { values: lists(values), i }, len(total), { unit: "%" }), visual };
};

const dataAverage: Generator = (r, d) => {
  const count = scale(d, 5, 9);
  const form = r.pick(d <= 3 ? [0, 3] : [0, 1, 2, 3]);
  let xs = Array.from({ length: count }, () => r.int(scale(d, 3, 10), scale(d, 20, 99)));
  if (form === 0) { const rem = sum(xs) % count; xs[0] += rem === 0 ? 0 : count - rem; }
  if (form === 2) {
    const m = r.int(2, 50);
    xs = xs.map((x, k) => (k < 3 ? m : x === m ? x + 1 : x));
    const seen = new Set<number>([m]);
    xs = xs.map((x, k) => { if (k < 3) return x; let v = x; while (seen.has(v)) v++; seen.add(v); return v; });
  }
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = count % 2 === 1 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
  const shown = xs.join(", ");
  switch (form) {
    case 0: return calcE(`Find the mean of: ${shown}.`, `(${xs.join("+")})/${count}`, [`Total = ${sum(xs)}; count = ${count}.`], { form, xs: lists(xs) }, len(sum(xs)));
    case 1: return calcE(`Find the median of: ${shown}.`, `${mid}`, [`Put them in order: ${sorted.join(", ")}.`, count % 2 ? `The middle value is ${mid}.` : `The median is the mean of the two middle values: ${mid}.`], { form, xs: lists(xs) }, len(Math.max(...xs)));
    case 2: { return calcE(`Find the mode of: ${shown}.`, `${xs[0]}`, [`The mode is the value that appears most often.`], { form, xs: lists(xs) }, len(Math.max(...xs))); }
    default: return calcE(`Find the range of: ${shown}.`, `${sorted[count - 1]}-${sorted[0]}`, [`Range = largest - smallest = ${sorted[count - 1]} - ${sorted[0]}.`], { form, xs: lists(xs) }, len(Math.max(...xs)));
  }
};

const frac = (p: number, q: number): string => { const g = gcd(p, q); return q / g === 1 ? String(p / g) : `${p / g}/${q / g}`; };
const probabilityBasic: Generator = (r, d): Built => {
  const form = r.pick(d <= 3 ? [0, 1] : [0, 1, 2, 3]);
  if (form <= 1) {
    const red = r.int(1, scale(d, 6, 12)), blue = r.int(1, scale(d, 6, 12)), green = r.int(1, scale(d, 5, 10));
    const total = red + blue + green;
    const want = form === 0 ? red : total - red;
    return { prompt: `A bag holds ${red} red, ${blue} blue and ${green} green counters. One is picked at random. What is the probability it is ${form === 0 ? "red" : "not red"}? (Give a fraction in lowest terms.)`, answer: frac(want, total), lowest: true, working: [`There are ${total} counters, ${want} of them ${form === 0 ? "red" : "not red"}.`, `Probability = ${want}/${total} = ${frac(want, total)}.`], params: { form, red, blue, green }, size: len(total) };
  }
  if (form === 2) {
    const k = r.int(1, 5);
    return { prompt: `A fair six-sided die is rolled. What is the probability of getting more than ${k}? (Give a fraction in lowest terms.)`, answer: frac(6 - k, 6), lowest: true, working: [`Numbers greater than ${k}: ${6 - k} of the 6 faces.`, `${6 - k}/6 = ${frac(6 - k, 6)}.`], params: { form, k }, size: 2 };
  }
  const s = r.int(3, 11);
  let ways = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) ways++;
  return { prompt: `Two fair dice are rolled. What is the probability that the total is ${s}? (Give a fraction in lowest terms.)`, answer: frac(ways, 36), lowest: true, working: [`There are 36 equally likely outcomes.`, `${ways} of them give a total of ${s}, so the probability is ${frac(ways, 36)}.`], params: { form, s }, size: 3 };
};

const countingBasic: Generator = (r, d) => {
  const form = r.pick(d <= 3 ? [0] : [0, 1, 2, 3]);
  const a = r.int(2, scale(d, 5, 9)), b = r.int(2, scale(d, 5, 9)), c = r.int(2, 5);
  switch (form) {
    case 0: return calcE(`A shop sells ${a} kinds of shirt and ${b} kinds of trousers. How many different outfits (one shirt and one pair of trousers) are possible?`, `${a}*${b}`, [`Multiply the choices: ${a} × ${b} = ${a * b}.`], { form, a, b }, 2);
    case 1: return calcE(`A meal is one of ${a} starters, one of ${b} mains and one of ${c} desserts. How many different meals are possible?`, `${a}*${b}*${c}`, [`Multiply the choices: ${a} × ${b} × ${c} = ${a * b * c}.`], { form, a, b, c }, 3);
    case 2: { const people = r.int(3, scale(d, 8, 14)); return calcE(`${people} friends each shake hands once with every other friend. How many handshakes are there in total?`, `${people}*(${people}-1)/2`, [`Each of ${people} shakes with ${people - 1} others, but each handshake is counted twice.`, `${people} × ${people - 1} ÷ 2 = ${(people * (people - 1)) / 2}.`], { form, people }, 2); }
    default: { const k = r.int(3, 6); let f = 1; for (let i = 2; i <= k; i++) f *= i; return calcE(`In how many different orders can ${k} different books be placed on a shelf?`, Array.from({ length: k }, (_, i) => i + 1).join("*"), [`${k} choices for the first place, then ${k - 1}, and so on.`, `${k}! = ${f}.`], { form, k }, len(f)); }
  }
};

const permCombBasic: Generator = (r, d) => {
  const nn = r.int(4, Math.min(9, scale(d, 5, 9))), kk = r.int(2, Math.min(4, nn - 1));
  const comb = r.chance(0.5);
  let p = 1;
  for (let i = 0; i < kk; i++) p *= nn - i;
  let f = 1;
  for (let i = 2; i <= kk; i++) f *= i;
  const ans = comb ? p / f : p;
  const num = Array.from({ length: kk }, (_, i) => nn - i).join("*");
  const expr = comb ? `(${num})/(${Array.from({ length: kk }, (_, i) => i + 1).join("*")})` : num;
  return calcE(comb ? `How many ways can a team of ${kk} be chosen from ${nn} people?` : `In how many ways can ${kk} places (1st, 2nd${kk > 2 ? ", ..." : ""}) be filled from ${nn} runners?`, expr, [comb ? `Choose ${kk} from ${nn}: ${num.replace(/\*/g, " × ")} ÷ ${kk}! = ${ans}.` : `Order matters: ${num.replace(/\*/g, " × ")} = ${ans}.`], { n: nn, k: kk, comb: comb ? 1 : 0 }, 3);
};

const dataMultistep: Generator = (r, d) => {
  const rows = scale(d, 3, 4);
  const labels = SHOPS.slice(0, rows);
  const y1 = Array.from({ length: rows }, () => r.int(4, scale(d, 20, 60)) * 10);
  const total1 = sum(y1);
  const pct = r.pick([10, 20, 25, 5]);
  const y2 = y1.map((v) => v);
  const scaleBy = (100 + pct) / 100;
  for (let i = 0; i < rows; i++) y2[i] = Math.round(y1[i] * scaleBy);
  const t2 = sum(y2);
  const form = r.pick([0, 1, 2]);
  const visual: Built["visual"] = { type: "table", head: ["Shop", "Last year", "This year"], rows: labels.map((l, k) => [l, y1[k], y2[k]]) };
  const base = { form, y1: lists(y1), y2: lists(y2) };
  if (form === 0) return { ...calcE(`The table shows sales for each shop. What was the total for both years combined?`, `${total1}+${t2}`, [`Last year: ${y1.join(" + ")} = ${total1}.`, `This year: ${y2.join(" + ")} = ${t2}.`, `Both: ${total1 + t2}.`], base, len(total1 + t2)), visual };
  if (form === 1) { const i = r.int(0, rows - 1); return { ...calcE(`The table shows sales for each shop. By how much did ${labels[i]}'s sales grow?`, `${y2[i]}-${y1[i]}`, [`${y2[i]} - ${y1[i]} = ${y2[i] - y1[i]}.`], { ...base, i }, 3), visual }; }
  return { ...calcE(`The table shows sales for each shop. By what percentage (to the nearest whole number) did the total sales rise from last year to this year?`, `(${t2}-${total1})/${total1}*100`, [`Last year ${total1}, this year ${t2}.`, `Rise = ${t2 - total1}; ${t2 - total1} ÷ ${total1} × 100.`], base, len(total1), { unit: "%", tol: 0.5 }), visual };
};

export const LEVEL_M: Skill[] = [
  S("table-read", "Reading tables", 13, [8000, 22000], 8, tableRead),
  S("bar-chart", "Bar charts", 13, [9000, 24000], 8, barChart),
  S("line-chart", "Line graphs", 13, [10000, 26000], 8, lineChart),
  S("pie-chart", "Pie charts", 13, [10000, 26000], 8, pieChart),
  S("data-percent", "Percentages in data", 13, [10000, 28000], 8, dataPercent),
  S("data-average", "Averages in data", 13, [9000, 26000], 8, dataAverage),
  S("probability-basic", "Basic probability", 13, [10000, 28000], 8, probabilityBasic),
  S("counting-basic", "Counting", 13, [9000, 26000], 8, countingBasic),
  S("perm-comb-basic", "Arrangements and selections", 13, [10000, 30000], 8, permCombBasic),
  S("data-multistep", "Multi-step data questions", 13, [14000, 36000], 8, dataMultistep),
];
