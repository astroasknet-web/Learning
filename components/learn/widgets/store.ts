"use client";

import { useSyncExternalStore } from "react";
import { award, emptyProgress, type ProgressState } from "@/lib/learn/widgets/engine";

/**
 * Lesson progress for the interactive widgets, kept in the visitor's own browser (localStorage). It is a motivation layer (XP, levels,
 * lesson ticks) and never replaces the server-graded module quizzes and activities that drive real course completion.
 * Falls back to memory when storage is blocked (private windows, strict settings).
 */
const mem = new Map<string, ProgressState>();
const listeners = new Set<() => void>();
const gainListeners = new Set<(g: { xp: number; label: string }) => void>();
const key = (slug: string) => `cw:v1:${slug}`;

function load(slug: string): ProgressState {
  const cached = mem.get(slug);
  if (cached) return cached;
  let st = emptyProgress();
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (raw) {
      const j = JSON.parse(raw) as ProgressState;
      if (j && typeof j.xp === "number" && j.done && typeof j.done === "object") st = { xp: Math.max(0, Math.min(1_000_000, Math.trunc(j.xp))), done: Object.fromEntries(Object.keys(j.done).slice(0, 2000).map((k) => [k, true as const])) };
    }
  } catch { /* storage unavailable or corrupt: start fresh */ }
  mem.set(slug, st);
  return st;
}
function save(slug: string, st: ProgressState) {
  mem.set(slug, st);
  try { window.localStorage.setItem(key(slug), JSON.stringify(st)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function awardXp(slug: string, id: string, xp: number, label = ""): number {
  const { state, gained } = award(load(slug), id, xp);
  if (gained > 0) { save(slug, state); gainListeners.forEach((l) => l({ xp: gained, label })); }
  return gained;
}
export function markDone(slug: string, id: string, xp = 0, label = ""): void { awardXp(slug, id, xp, label); }
export function unmark(slug: string, id: string): void {
  const st = load(slug);
  if (!st.done[id]) return;
  const done = { ...st.done };
  delete done[id];
  save(slug, { ...st, done });
}
export function isDone(slug: string, id: string): boolean { return Boolean(load(slug).done[id]); }

const EMPTY = emptyProgress();
export function useProgress(slug: string): ProgressState {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => load(slug),
    () => EMPTY,
  );
}
export function onGain(cb: (g: { xp: number; label: string }) => void): () => void { gainListeners.add(cb); return () => { gainListeners.delete(cb); }; }
