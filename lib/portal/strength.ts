/**
 * A quick, offline password strength estimate for the sign-up meter. It only guides the person: the server still applies the real
 * rules (length, blocklist, no name or email in it, and a data-breach check). Score 0 to 4.
 */
export interface Strength { score: 0 | 1 | 2 | 3 | 4; label: string; tips: string[] }

const SEQ = ["abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm", "0123456789"];
const COMMON_BITS = ["password", "qwerty", "letmein", "welcome", "iloveyou", "admin", "login", "growqr", "internship", "student"];

function hasSequence(s: string): boolean {
  const l = s.toLowerCase();
  for (const seq of SEQ) for (let i = 0; i + 4 <= seq.length; i++) { const bit = seq.slice(i, i + 4); if (l.includes(bit) || l.includes([...bit].reverse().join(""))) return true; }
  return false;
}

export function estimate(pw: string, email = "", name = ""): Strength {
  const tips: string[] = [];
  if (!pw) return { score: 0, label: "", tips: [] };
  const len = Array.from(pw).length;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const distinct = new Set(pw.toLowerCase()).size;
  let pts = Math.min(len, 20) * 3 + classes * 6 + Math.min(distinct, 12) * 2;
  const l = pw.toLowerCase();
  const local = email.includes("@") ? email.slice(0, email.indexOf("@")).toLowerCase() : "";
  if (len < 8) tips.push("Use at least 8 characters.");
  if (COMMON_BITS.some((c) => l.includes(c))) { pts -= 30; tips.push("Avoid common words."); }
  if (local.length >= 4 && l.includes(local)) { pts -= 30; tips.push("Do not use your email name."); }
  if (name.trim().split(/\s+/).some((p) => p.length >= 4 && l.includes(p.toLowerCase()))) { pts -= 30; tips.push("Do not use your name."); }
  if (/(.)\1{2,}/.test(pw)) { pts -= 12; tips.push("Avoid repeated characters."); }
  if (hasSequence(pw)) { pts -= 12; tips.push("Avoid keyboard or number runs."); }
  if (len < 12 && tips.length === 0) tips.push("A longer phrase is stronger.");
  const score = (len < 8 ? 0 : pts < 45 ? 1 : pts < 70 ? 2 : pts < 95 ? 3 : 4) as Strength["score"];
  return { score, label: ["Too short", "Weak", "Okay", "Good", "Strong"][score], tips: tips.slice(0, 2) };
}
