import { phpTrim } from "../qrscore/php";

/** Line-by-line comparison of two resume texts, for the before/after view (port of PHP Studio\Diff). */
export type DiffKind = "same" | "add" | "del";
export type DiffLine = [DiffKind, string];

/** PCRE \R under /u: CRLF, LF, CR, VT, FF, NEL, LS and PS. */
export const NEWLINE = new RegExp("\r\n|\n|\r|\x0B|\f|\x85|\u2028|\u2029");

export function lines(before: string, after: string, cap = 500): DiffLine[] {
  const a = phpTrim(before).split(NEWLINE).slice(0, cap);
  const b = phpTrim(after).split(NEWLINE).slice(0, cap);
  const n = a.length;
  const m = b.length;
  // Longest common subsequence table.
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push(["same", a[i]]);
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      out.push(["del", a[i++]]);
    } else {
      out.push(["add", b[j++]]);
    }
  }
  while (i < n) out.push(["del", a[i++]]);
  while (j < m) out.push(["add", b[j++]]);
  return out;
}

export function stats(diff: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const [k] of diff) {
    if (k === "add") added++;
    if (k === "del") removed++;
  }
  return { added, removed };
}
