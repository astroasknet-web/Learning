/**
 * Renders a Vidaara "standard course" (the assembled JSON produced by the course tools) into the HTML that the native lesson player shows.
 * Pure functions, no I/O. Every piece of text is escaped. Classes are styled in app/globals.css (section "Course lesson components", prefix cw-).
 */

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const fmt = (n) => (n < 0 ? "-" : "") + Math.abs(n).toLocaleString("en-IN");
export const slugify = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
import { lessonWidgets, widgetHtml } from "./widget-html.mjs";
const rs = (n) => "₹" + fmt(n); // rupee sign + Indian grouping

/* ------------------------------------------------------------------------------------------------------------------ diagrams */

const C = { ink: "#1A1A1A", ink3: "#525252", orange: "#FF6A2F", deep: "#9C3A11", light: "#FFEADB", cream: "#EFEEE8", green: "#15803D", greenL: "#DCFCE7", blue: "#1D4ED8", blueL: "#DBEAFE", red: "#B91C1C", redL: "#FEE2E2" };
const fig = (svg, caption, label) => `<figure class="cw-fig"><div class="cw-fig-scroll">${svg.replace("<svg ", `<svg role="img" aria-label="${esc(label)}" `)}</div><figcaption>${esc(caption)}</figcaption></figure>`;
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.size ?? 15}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? C.ink}" text-anchor="${o.anchor ?? "start"}" font-family="Poppins,system-ui,sans-serif">${esc(s)}</text>`;
const rect = (x, y, w, h, fill, stroke, r = 10) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2"` : ""}/>`;
const arrowDef = `<defs><marker id="cwa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${C.ink3}"/></marker></defs>`;
const arrow = (x1, y1, x2, y2, dash) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink3}" stroke-width="2"${dash ? ' stroke-dasharray="5 4"' : ""} marker-end="url(#cwa)"/>`;

/** Balance-sheet picture of Rohan Stationers after transaction 6 (Unit 1, lesson 3). */
export function equationDiagram() {
  const cash = 390000, furn = 80000, stock = 90000, cred = 50000, cap = 510000;
  const total = cash + furn + stock; // 5,60,000
  const H = 190, k = H / total, top = 40, base = top + H;
  let y = base;
  const seg = (v, fill, stroke, label, x, w) => { const h = v * k; y -= h; return rect(x, y, w, h, fill, stroke, 4) + (h > 22 ? text(x + w / 2, y + h / 2 + 5, `${label} ${rs(v)}`, { anchor: "middle", size: 14 }) : label ? text(x + w / 2, y + h / 2 + 4.5, `${label} ${rs(v)}`, { anchor: "middle", size: 12, weight: 600, fill: C.red }) : ""); };
  y = base; const L = [seg(cash, C.greenL, C.green, "Cash", 40, 220), seg(furn, C.blueL, C.blue, "Furniture", 40, 220), seg(stock, C.light, C.deep, "Stock", 40, 220)].join("");
  y = base; const R = [seg(cap, C.cream, C.ink3, "Capital", 340, 220), seg(cred, C.redL, C.red, "Creditors", 340, 220)].join("");
  const svg = `<svg viewBox="0 0 620 270" xmlns="http://www.w3.org/2000/svg">${text(150, 28, "Assets " + rs(total), { anchor: "middle", weight: 600 })}${text(450, 28, "Liabilities + Capital " + rs(cred + cap), { anchor: "middle", weight: 600 })}${L}${R}${text(300, base - H / 2 + 8, "=", { anchor: "middle", size: 36, weight: 700, fill: C.deep })}${text(300, 262, "Both sides total " + rs(total) + ": the equation holds after every transaction", { anchor: "middle", size: 14, fill: C.ink3 })}</svg>`;
  return fig(svg, "Rohan Stationers after the six transactions: what the business owns equals what it owes plus what the owner has put in.", "Bar diagram: assets of 5,60,000 equal creditors of 50,000 plus capital of 5,10,000");
}

/** The eight-step accounting cycle. */
export function cycleDiagram() {
  const steps = ["Source documents", "Journal entries", "Ledger posting", "Trial balance", "Adjusting entries", "Adjusted trial balance", "Final accounts", "Closing and next year"];
  const w = 128, h = 64, gx = 16, x0 = 14, ys = [20, 130];
  let out = arrowDef;
  steps.forEach((s, i) => {
    const row = i < 4 ? 0 : 1, col = row === 0 ? i : 7 - i, x = x0 + col * (w + gx), y = ys[row];
    out += rect(x, y, w, h, row === 0 ? C.light : C.cream, row === 0 ? C.orange : C.ink3, 12) + text(x + 14, y + 26, String(i + 1), { weight: 700, size: 17, fill: C.deep }) + text(x + w / 2 + 6, y + 30, s.split(" ")[0], { anchor: "middle", size: 14, weight: 600 }) + text(x + w / 2 + 6, y + 50, s.split(" ").slice(1).join(" "), { anchor: "middle", size: 14 });
    if (i < 3) out += arrow(x + w, y + h / 2, x + w + gx - 2, y + h / 2);
    if (i > 3 && i < 7) out += arrow(x, y + h / 2, x - gx + 2, y + h / 2);
  });
  const xr = x0 + 3 * (w + gx) + w / 2;
  out += `<path d="M${xr} ${ys[0] + h} L${xr} ${ys[1] - 4}" stroke="${C.ink3}" stroke-width="2" fill="none" marker-end="url(#cwa)"/>`;
  return fig(`<svg viewBox="0 0 612 226" xmlns="http://www.w3.org/2000/svg">${out}${text(306, 218, "The cycle repeats every accounting year", { anchor: "middle", size: 14, fill: C.ink3 })}</svg>`, "The accounting cycle from the first voucher to the opening entries of the next year.", "Flow of eight steps in the accounting cycle");
}

/** T-account of Rohan's Cash account (Unit 2, lesson 1). */
export function tAccountDiagram() {
  const dr = [["Capital", 300000], ["Sales", 50000], ["Gupta", 25000]];
  const cr = [["Purchases", 80000], ["Rent", 10000], ["Verma & Co", 30000], ["Balance c/d", 255000]];
  let out = text(300, 26, "Cash A/c", { anchor: "middle", weight: 700, size: 17 }) + `<line x1="40" y1="38" x2="560" y2="38" stroke="${C.ink}" stroke-width="2"/><line x1="300" y1="38" x2="300" y2="232" stroke="${C.ink}" stroke-width="2"/>${text(60, 58, "Dr", { weight: 700, fill: C.deep })}${text(540, 58, "Cr", { weight: 700, fill: C.deep, anchor: "end" })}`;
  dr.forEach(([n, v], i) => { out += text(60, 84 + i * 28, "To " + n) + text(280, 84 + i * 28, fmt(v), { anchor: "end" }); });
  cr.forEach(([n, v], i) => { out += text(320, 84 + i * 28, "By " + n) + text(540, 84 + i * 28, fmt(v), { anchor: "end" }); });
  out += `<line x1="40" y1="198" x2="560" y2="198" stroke="${C.ink3}"/>${text(60, 222, "Total", { weight: 600 })}${text(280, 222, fmt(375000), { anchor: "end", weight: 600 })}${text(320, 222, "Total", { weight: 600 })}${text(540, 222, fmt(375000), { anchor: "end", weight: 600 })}`;
  return fig(`<svg viewBox="0 0 600 246" xmlns="http://www.w3.org/2000/svg">${out}</svg>`, "Both sides add up to 3,75,000. The difference, 2,55,000, is the cash in hand and is carried down as the opening balance.", "T-account for the cash account showing debits of 3,75,000 and credits of 1,20,000 plus balance 2,55,000");
}

/** Straight-line vs written-down-value book value over five years (Unit 3, lesson 2). */
export function depreciationDiagram() {
  const cost = 500000, res = 50000, rate = 0.2, n = 5;
  const slm = [], wdv = [cost]; slm.push(cost);
  for (let i = 1; i <= n; i++) { slm.push(cost - ((cost - res) / n) * i); wdv.push(Math.round(wdv[i - 1] * (1 - rate))); }
  const X0 = 70, X1 = 470, Y0 = 220, Y1 = 30, px = (i) => X0 + ((X1 - X0) / n) * i, py = (v) => Y0 - ((Y0 - Y1) * v) / cost;
  const line = (arr, col) => `<polyline points="${arr.map((v, i) => `${px(i)},${py(v)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="3"/>` + arr.map((v, i) => `<circle cx="${px(i)}" cy="${py(v)}" r="4.5" fill="${col}"/>`).join("");
  let grid = "";
  [0, 1, 2, 3, 4, 5].forEach((i) => { grid += text(px(i), 244, `Year ${i}`, { anchor: "middle", size: 13, fill: C.ink3 }); });
  [0, 100000, 200000, 300000, 400000, 500000].forEach((v) => { grid += `<line x1="${X0}" y1="${py(v)}" x2="${X1}" y2="${py(v)}" stroke="#D9D9D3"/>` + text(X0 - 8, py(v) + 4, v === 0 ? "0" : `${v / 100000}L`, { anchor: "end", size: 13, fill: C.ink3 }); });
  const svg = `<svg viewBox="0 0 620 262" xmlns="http://www.w3.org/2000/svg">${grid}${line(slm, C.orange)}${line(wdv, C.blue)}${text(px(5) + 12, py(slm[5]) + 4, "SLM " + fmt(slm[5]), { size: 13, fill: C.deep, weight: 700 })}${text(px(5) + 12, py(wdv[5]) + 4, "WDV " + fmt(wdv[5]), { size: 13, fill: C.blue, weight: 700 })}${rect(70, 4, 14, 14, C.orange, null, 3)}${text(90, 16, "Straight-line (SLM)", { size: 13 })}${rect(250, 4, 14, 14, C.blue, null, 3)}${text(270, 16, "Written-down value at 20% (WDV)", { size: 13 })}</svg>`;
  return fig(svg, "Book value of a 5,00,000 machine with scrap value 50,000. SLM falls in a straight line to the scrap value; WDV falls faster at first and never reaches zero. L = lakh rupees.", "Line chart comparing book value under straight-line and written-down-value depreciation over five years");
}

/** From trial balance to balance sheet using the Meera Garments figures (Unit 4, lesson 3). */
export function finalAccountsDiagram() {
  const b = [[["Trial", "balance"], "Dr = Cr", rs(1706000)], [["Trading", "account"], "Gross profit", rs(475000)], [["Profit and", "loss account"], "Net profit", rs(183750)], [["Balance", "sheet"], "Both sides", rs(635750)]];
  let out = arrowDef;
  b.forEach(([t, s, v], i) => {
    const x = 12 + i * 148;
    out += rect(x, 40, 128, 110, i === 3 ? C.greenL : C.light, i === 3 ? C.green : C.orange, 14) + text(x + 64, 70, t[0], { anchor: "middle", weight: 700, size: 14 }) + text(x + 64, 88, t[1], { anchor: "middle", weight: 700, size: 14 }) + text(x + 64, 114, s, { anchor: "middle", size: 13, fill: C.ink3 }) + text(x + 64, 136, v, { anchor: "middle", weight: 700, size: 15, fill: C.deep });
    if (i < 3) out += arrow(x + 130, 95, x + 146, 95);
  });
  out += text(306, 190, "Adjustments (closing stock, depreciation, outstanding and prepaid items) change the figures at each step", { anchor: "middle", size: 13, fill: C.ink3 });
  return fig(`<svg viewBox="0 0 612 206" xmlns="http://www.w3.org/2000/svg">${out}</svg>`, "Meera Garments: how one trial balance becomes the three final statements. Net profit moves into capital, which is why the balance sheet balances.", "Flow from trial balance to trading account to profit and loss account to balance sheet");
}

/** Life of a bill of exchange (Unit 5, lesson 1). */
export function billDiagram() {
  const ev = [["Day 0", "Goods sold, bill", "drawn for " + rs(50000)], ["Day 0", "Drawee accepts", "Bills receivable " + rs(50000)], ["Next day", "Discounted", "Bank pays " + rs(48500)], ["Month 3 + 3 days", "Due date", "Drawee pays the bank"]];
  let out = `<line x1="50" y1="80" x2="560" y2="80" stroke="${C.ink3}" stroke-width="3"/>`;
  ev.forEach(([d, t, s], i) => {
    const x = 70 + i * 160;
    out += `<circle cx="${x}" cy="80" r="11" fill="${i === 2 ? C.orange : C.deep}"/>${text(x, 52, d, { anchor: "middle", size: 13, fill: C.ink3 })}${text(x, 116, t, { anchor: "middle", weight: 700, size: 14 })}${text(x, 138, s, { anchor: "middle", size: 12.5 })}`;
  });
  out += rect(188, 160, 260, 40, C.redL, C.red, 10) + text(318, 185, "If unpaid: drawee's account debited again", { anchor: "middle", size: 13, fill: C.red, weight: 600 });
  return fig(`<svg viewBox="0 0 620 212" xmlns="http://www.w3.org/2000/svg">${out}</svg>`, "A three-month bill discounted at 12% costs the drawer 1,500. If the drawee dishonours it, the amount plus noting charges is debited to the drawee again.", "Timeline of a bill of exchange from drawing to the due date");
}

/** Consignment flow with the Anand and Bhatia figures (Unit 5, lesson 2). */
export function consignmentDiagram() {
  let out = arrowDef;
  out += rect(8, 40, 142, 100, C.light, C.orange, 14) + text(79, 70, "Consignor", { anchor: "middle", weight: 700 }) + text(79, 92, "Owns the goods", { anchor: "middle", size: 13 }) + text(79, 114, "Anand & Co.", { anchor: "middle", size: 13, fill: C.ink3 });
  out += rect(240, 40, 142, 100, C.cream, C.ink3, 14) + text(311, 70, "Consignee", { anchor: "middle", weight: 700 }) + text(311, 92, "Sells as agent", { anchor: "middle", size: 13 }) + text(311, 114, "Bhatia", { anchor: "middle", size: 13, fill: C.ink3 });
  out += rect(470, 40, 142, 100, C.greenL, C.green, 14) + text(541, 70, "Customers", { anchor: "middle", weight: 700 }) + text(541, 92, "800 units bought", { anchor: "middle", size: 13 }) + text(541, 114, rs(104000), { anchor: "middle", size: 14, weight: 600 });
  out += arrow(154, 76, 236, 76) + text(195, 66, "1,000 units", { anchor: "middle", size: 12.5 }) + arrow(386, 76, 466, 76, true) + text(426, 66, "sales", { anchor: "middle", size: 12.5 });
  out += arrow(236, 112, 154, 112, true) + text(195, 134, "Account sales", { anchor: "middle", size: 12.5 }) + text(195, 154, "+ " + rs(95800), { anchor: "middle", size: 13, weight: 700, fill: C.deep });
  out += text(310, 178, "Unsold: 200 units valued at " + rs(21400) + " (cost plus a share of freight and insurance)", { anchor: "middle", size: 13, fill: C.ink3 });
  return fig(`<svg viewBox="0 0 620 196" xmlns="http://www.w3.org/2000/svg">${out}</svg>`, "Ownership stays with the consignor; the consignee earns commission and remits the balance after expenses. Profit on consignment: 10,200.", "Diagram of goods moving from consignor to consignee to customers and the account sales coming back");
}

/** Four ratio families with the Kiran Foods values (Unit 6, lesson 2). */
export function ratioDiagram() {
  const q = [
    ["Liquidity", "Can we pay short-term dues?", ["Current ratio  1.8 : 1", "Quick ratio  1.2 : 1"], C.blueL, C.blue],
    ["Solvency", "How much do we borrow?", ["Debt-equity  0.6 : 1", "Interest cover  7 times"], C.redL, C.red],
    ["Profitability", "How much do we earn?", ["Gross profit  30%", "Net profit  10%", "ROE 24%   ROCE 17.5%"], C.greenL, C.green],
    ["Activity", "How fast does money move?", ["Stock turns  5.6 times", "Customers pay in  36.5 days"], C.light, C.deep],
  ];
  let out = "";
  q.forEach(([t, s, lines, f, st], i) => {
    const x = 12 + (i % 2) * 300, y = 12 + Math.floor(i / 2) * 146;
    out += rect(x, y, 288, 134, f, st, 14) + text(x + 16, y + 28, t, { weight: 700, size: 16, fill: st }) + text(x + 16, y + 48, s, { size: 13, fill: C.ink3 });
    lines.forEach((l, j) => { out += text(x + 16, y + 76 + j * 20, l, { size: 14.5, weight: 500 }); });
  });
  return fig(`<svg viewBox="0 0 612 302" xmlns="http://www.w3.org/2000/svg">${out}</svg>`, "The four families of ratios, with the values for Kiran Foods Ltd. from the worked example.", "Four boxes: liquidity, solvency, profitability and activity ratios with example values");
}

/** Cash flow statement as bars (Unit 6, lesson 3). */
export function cashFlowDiagram() {
  const rows = [["Operating", 270000, C.green], ["Investing", -115000, C.red], ["Financing", 20000, C.blue], ["Net change", 175000, C.deep]];
  const zero = 230, scale = 260 / 270000;
  let out = `<line x1="${zero}" y1="20" x2="${zero}" y2="200" stroke="${C.ink3}" stroke-width="2"/>`;
  rows.forEach(([n, v, c], i) => {
    const y = 30 + i * 42, w = Math.abs(v) * scale, x = v >= 0 ? zero : zero - w;
    out += text(14, y + 22, n, { weight: 600 }) + rect(x, y, w, 30, c, null, 4) + text(v >= 0 ? zero + w + 8 : zero + 10, y + 21, (v >= 0 ? "+" : "-") + rs(Math.abs(v)).replace("₹", "₹"), { size: 14, weight: 700, fill: v >= 0 ? C.ink : C.red });
  });
  out += text(300, 214, "Opening cash " + rs(25000) + "  +  net change " + rs(175000) + "  =  closing cash " + rs(200000), { anchor: "middle", size: 14, fill: C.ink3 });
  return fig(`<svg viewBox="0 0 620 230" xmlns="http://www.w3.org/2000/svg">${out}</svg>`, "Cash generated and used in the year, by activity. Profit is not cash: check each section.", "Bar chart of operating, investing and financing cash flows and the net change in cash");
}

export const DIAGRAMS = { "L1.3": [equationDiagram], "L1.4": [cycleDiagram], "L2.1": [tAccountDiagram], "L3.2": [depreciationDiagram], "L4.3": [finalAccountsDiagram], "L5.1": [billDiagram], "L5.2": [consignmentDiagram], "L6.2": [ratioDiagram], "L6.3": [cashFlowDiagram] };

/* ------------------------------------------------------------------------------------------------------------------ blocks */

const CALLOUT = { tip: ["cw-tip", "Tip"], warning: ["cw-warn", "Watch out"], "indian-context": ["cw-india", "In India"] };

export function renderBlock(b) {
  switch (b.type) {
    case "text": return `<p>${esc(b.text)}</p>`;
    case "definition": return `<div class="cw-def"><span class="cw-label">Definition</span><p><b>${esc(b.term)}.</b> ${esc(b.text)}</p></div>`;
    case "list": {
      const tag = b.style === "numbered" ? "ol" : "ul";
      return `<div class="cw-box">${b.title ? `<h3>${esc(b.title)}</h3>` : ""}<${tag}>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</${tag}></div>`;
    }
    case "table": {
      const head = `<tr>${b.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr>`;
      const body = b.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("");
      return `<div class="cw-tablewrap" role="region" aria-label="${esc(b.caption ?? "Table")}" tabindex="0"><table class="cw-table">${b.caption ? `<caption>${esc(b.caption)}</caption>` : ""}<thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    }
    case "formula": return `<div class="cw-formula"><span class="cw-label">Formula &middot; ${esc(b.name)}</span><p class="cw-eq">${esc(b.expression)}</p>${b.note ? `<p class="cw-note">${esc(b.note)}</p>` : ""}</div>`;
    case "callout": { const [cls, label] = CALLOUT[b.kind] ?? CALLOUT.tip; return `<aside class="cw-callout ${cls}"><span class="cw-label">${label}</span><p>${esc(b.text)}</p></aside>`; }
    default: return "";
  }
}

function journalTable(j) {
  const rows = j.map((e) => {
    const lines = Math.max(e.dr.length, e.cr.length);
    let r = "";
    for (let i = 0; i < lines; i++) {
      const d = e.dr[i], c = e.cr[i];
      r += `<tr>${i === 0 ? `<th scope="row" rowspan="${lines}">${esc(e.ref)}</th>` : ""}<td>${d ? esc(d[0]) + " A/c Dr" : ""}</td><td class="cw-num">${d ? fmt(d[1]) : ""}</td><td>${c ? "To " + esc(c[0]) + " A/c" : ""}</td><td class="cw-num">${c ? fmt(c[1]) : ""}</td></tr>`;
    }
    return r;
  }).join("");
  return `<div class="cw-tablewrap" role="region" aria-label="Journal entries" tabindex="0"><table class="cw-table cw-journal"><caption>Journal entries</caption><thead><tr><th scope="col">Entry</th><th scope="col">Debit</th><th scope="col">Amount</th><th scope="col">Credit</th><th scope="col">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function trialBalanceTable(tb) {
  const dr = tb.rows.reduce((s, r) => s + r.dr, 0), cr = tb.rows.reduce((s, r) => s + r.cr, 0);
  const body = tb.rows.map((r) => `<tr><th scope="row">${esc(r.account)}</th><td class="cw-num">${r.dr ? fmt(r.dr) : ""}</td><td class="cw-num">${r.cr ? fmt(r.cr) : ""}</td></tr>`).join("");
  return `<div class="cw-tablewrap" role="region" aria-label="Trial balance" tabindex="0"><table class="cw-table cw-tb"><caption>Trial balance (rupees)</caption><thead><tr><th scope="col">Account</th><th scope="col">Debit</th><th scope="col">Credit</th></tr></thead><tbody>${body}</tbody><tfoot><tr><th scope="row">Total</th><td class="cw-num">${fmt(dr)}</td><td class="cw-num">${fmt(cr)}</td></tr></tfoot></table></div>`;
}

export function renderExample(we) {
  return `<section class="cw-example" aria-label="Worked example: ${esc(we.title)}"><header><span class="cw-label">Worked example</span><h3>${esc(we.title)}</h3></header><p class="cw-problem">${esc(we.problem)}</p><ol class="cw-steps">${we.solution_steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>${we.verify?.journal ? journalTable(we.verify.journal) : ""}${we.verify?.trial_balance ? trialBalanceTable(we.verify.trial_balance) : ""}<p class="cw-answer"><b>Answer.</b> ${esc(we.answer)}</p></section>`;
}

export function lessonHtml(lesson) {
  const parts = [];
  parts.push(`<div class="cw-obj"><span class="cw-label">By the end of this lesson you can</span><ul>${lesson.objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul><p class="cw-time">About ${lesson.minutes} minutes</p></div>`);
  for (const d of DIAGRAMS[lesson.id] ?? []) parts.push(d());
  for (const b of lesson.blocks) parts.push(renderBlock(b));
  for (const we of lesson.worked_examples ?? []) parts.push(renderExample(we));
  const widgets = lessonWidgets(lesson); // interactive activities; see scripts/lib/widget-html.mjs
  for (const w of widgets) if (w.type !== "complete") parts.push(widgetHtml(w));
  if (lesson.common_mistakes?.length) parts.push(`<div class="cw-mistakes"><h3>Common mistakes</h3><ul>${lesson.common_mistakes.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>`);
  if (lesson.exam_tip) parts.push(`<aside class="cw-callout cw-exam"><span class="cw-label">Exam tip</span><p>${esc(lesson.exam_tip)}</p></aside>`);
  for (const s of lesson.practice?.short ?? []) parts.push(`<details class="cw-qa"><summary>Try it yourself: ${esc(s.q)}</summary><p><b>Model answer.</b> ${esc(s.model_answer)}</p></details>`);
  for (const w of widgets) if (w.type === "complete") parts.push(widgetHtml(w));
  return parts.join("\n");
}

const firstSentence = (s) => { const m = /^.*?[.!?](\s|$)/.exec(s); return (m ? m[0] : s).trim(); };
export function keyPoints(lesson) {
  const k = [];
  for (const b of lesson.blocks) {
    if (b.type === "definition") k.push(`${b.term}: ${firstSentence(b.text)}`);
    if (b.type === "formula") k.push(`${b.name}: ${b.expression}`);
  }
  if (lesson.exam_tip) k.push(`Exam tip: ${firstSentence(lesson.exam_tip)}`);
  if (k.length < 3) for (const o of lesson.objectives) { if (k.length >= 3) break; k.push(o); }
  return k.slice(0, 5);
}

export function mcqToQuiz(list, pass) {
  return { pass, questions: list.map((q) => ({ text: esc(q.q), options: q.options.map(esc), correct: "ABCD".indexOf(q.answer), explanation: esc(q.explain) })) };
}

/** Whole-course conversion to the NativeCourse shape used by lib/market/lessons.ts. */
export function buildNativeCourse(c, key) {
  const ur = c.units;
  const modules = ur.map((u, i) => {
    const outcomes = c.learning_outcomes.filter((o) => (u.outcomes ?? []).includes(o.id));
    const intro =
      `<div class="cw-meta"><span class="cw-chip">About ${u.hours} hours</span><span class="cw-chip">${u.lessons.length} lessons</span>${(u.coverage ?? []).slice(0, 6).map((x) => `<span class="cw-chip cw-chip-soft">${esc(x)}</span>`).join("")}</div>` +
      (outcomes.length ? `<div class="cw-obj"><span class="cw-label">After this unit you can</span><ul>${outcomes.map((o) => `<li>${esc(o.text)}</li>`).join("")}</ul></div>` : "");
    const cs = u.case_study;
    return {
      num: i + 1, slug: u.slug ?? slugify(u.title), seoTitle: u.seo_title, title: u.title, hours: u.hours, level: `Unit ${i + 1}`, summary: u.summary, outcome: u.summary, intro,
      topics: u.lessons.map((l) => ({ title: l.title, slug: l.slug ?? slugify(l.title), html: lessonHtml(l), keyPoints: keyPoints(l) })),
      practical: cs ? {
        title: `Case study: ${cs.title}`,
        intro: cs.scenario,
        steps: cs.questions.map((q) => `${esc(q.q)}<details class="cw-qa"><summary>Check your thinking</summary><ul>${q.answer_points.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></details>`),
      } : null,
      quiz: mcqToQuiz(u.lessons.flatMap((l) => l.practice?.mcq ?? []), 60),
    };
  });

  const labs = c.lab.exercises.map((e) => `<b>Lab ${esc(e.id.replace("LAB", ""))}: ${esc(e.title)}.</b> ${esc(e.task)} <span class="cw-expected">Expected: ${esc(e.expected_result)}</span>`);
  const nums = c.question_bank.numericals.map((n) => `<b>${esc(n.id)}</b> <span class="cw-chip cw-chip-soft">${n.marks} marks &middot; ${esc(n.difficulty)}</span> ${esc(n.question)}<details class="cw-qa"><summary>Show the solution</summary><ol>${n.solution_steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><p class="cw-answer"><b>Answer.</b> ${esc(n.answer)}</p></details>`);
  const sheet = `<div class="cw-box"><h3>Formula sheet</h3><ul>${c.revision.formula_sheet.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`;
  const summary = `<div class="cw-box"><h3>The course on one page</h3><ol>${c.revision.one_page_summary.map((f) => `<li>${esc(f)}</li>`).join("")}</ol></div>`;
  const pat = c.assessment.suggested_paper_pattern;
  const capIntro = `<p>You now have the full toolkit. This last step has three parts: practise the numericals below, build the books in software, and take the final assessment of ${ur.reduce((s, u) => s + u.unit_test.mcq.length, 0)} questions covering every unit.</p>${sheet}${summary}<div class="cw-box"><h3>How a typical university paper is set</h3><p>${esc(pat.name)}.</p><ul><li>${esc(pat.section_a)}</li><li>${esc(pat.section_b)}</li><li>${esc(pat.internal)}</li></ul><p class="cw-note">${esc(pat.note)}</p></div>`;
  const capstone = {
    slug: "capstone", title: "Final assessment and revision pack", summary: "Revision sheets, practice numericals with full solutions, a software lab and a final test across all six units.",
    intro: capIntro, steps: [...labs, ...nums], projectTitle: "Practice: build the books and solve the numericals",
    quiz: mcqToQuiz(ur.flatMap((u) => u.unit_test.mcq), 70),
  };

  const landing = {
    outcomes: c.learning_outcomes.map((o) => ({ id: o.id, text: o.text })),
    audience: c.who_is_it_for, prerequisites: c.prerequisites, alignment: c.alignment.map((a) => ({ university: a.university, code: a.code, title: a.title, semester: a.semester, scheme: a.scheme, source: a.source })),
    alignmentNote: c.coverage_matrix_note, faqs: c.faqs, glossary: c.glossary, references: c.references.official, textbooks: c.references.textbooks,
    shortTitle: `${c.course.programme} ${c.course.title}`, author: { name: c.course.author, publisher: c.course.publisher }, updated: c.course.last_updated, version: c.course.version, status: c.course.status,
    seo: { title: c.seo.title.replace(/\s*\|\s*Vidaara\s*$/i, ""), description: c.seo.meta_description, keywords: c.seo.keywords, focus: c.seo.focus_keyword },
    stats: { lessons: ur.reduce((s, u) => s + u.lessons.length, 0), examples: ur.reduce((s, u) => s + u.lessons.reduce((a, l) => a + (l.worked_examples?.length ?? 0), 0), 0), quizQuestions: modules.reduce((s, m) => s + (m.quiz?.questions.length ?? 0), 0) + capstone.quiz.questions.length, numericals: c.question_bank.numericals.length, glossary: c.glossary.length },
  };

  return { key, title: `${c.course.title} for ${c.course.programme}`, tagline: c.course.subtitle, level: "Beginner", hours: ur.reduce((s, u) => s + u.hours, 0), summary: c.description, modules, capstone, landing };
}
