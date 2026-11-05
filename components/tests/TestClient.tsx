"use client";

import { useEffect, useRef, useState } from "react";

/** Countdown that submits the form it belongs to when time runs out. The server still grades whatever was filled in. */
export function Countdown({ minutes, formId }: { minutes: number; formId: string }) {
  const [left, setLeft] = useState(minutes * 60);
  const started = useRef(Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, minutes * 60 - Math.round((Date.now() - started.current) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [minutes, formId]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="sticky top-[132px] z-20 bg-white/95 backdrop-blur border border-black/[0.08] rounded-xl px-4 py-2 flex items-center justify-between shadow-card">
      <span className="text-[13px] text-ink-3">Time left</span>
      <b role="timer" aria-live="off" className={`text-[20px] tabular-nums ${left < 300 ? "text-red-700" : "text-ink"}`}>{mm}:{ss}</b>
      <input type="hidden" name="elapsed" value={minutes * 60 - left} readOnly />
    </div>
  );
}

interface Speaker { id: string; name: string; gender: string }
interface Script { n: number; speakers: Speaker[]; lines: Array<{ s: string; text: string }> }

/** Plays one Listening section with the browser's speech voices, one voice per speaker. One play per section, like the real test. */
export function ListeningPlayer({ script }: { script: Script }) {
  const [state, setState] = useState<"idle" | "playing" | "paused" | "done">("idle");
  const [noVoice, setNoVoice] = useState(false);
  const run = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => { if (!("speechSynthesis" in window) || window.speechSynthesis.getVoices().length === 0) setNoVoice(true); }, 1500);
    return () => { clearTimeout(t); run.current++; if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, []);

  const voiceFor = (speaker: Speaker | undefined, idx: number): SpeechSynthesisVoice | null => {
    const en = window.speechSynthesis.getVoices().filter((v) => /^en(-|_|$)/i.test(v.lang));
    if (!en.length) return null;
    const re = speaker?.gender === "female" ? /female|woman|zira|susan|hazel|libby|sonia|aria|jenny|samantha|karen|serena|moira|tessa|kate/i : /male|man|david|mark|george|ryan|guy|daniel|alex|oliver|thomas|james|fred/i;
    const pool = en.filter((v) => re.test(v.name));
    const from = pool.length ? pool : en;
    return from[(script.n + Math.max(0, idx)) % from.length];
  };

  const play = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const id = ++run.current;
    setState("playing");
    let i = 0;
    const next = () => {
      if (id !== run.current) return;
      if (i >= script.lines.length) { setState("done"); return; }
      const line = script.lines[i++];
      const idx = script.speakers.findIndex((s) => s.id === line.s);
      const u = new SpeechSynthesisUtterance(line.text);
      const v = voiceFor(script.speakers[idx], idx);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-GB";
      u.rate = 0.95;
      u.onend = next;
      u.onerror = () => { if (id === run.current) setState("done"); };
      window.speechSynthesis.speak(u);
    };
    next();
  };
  const pause = () => {
    if (state === "playing") { window.speechSynthesis.pause(); setState("paused"); }
    else if (state === "paused") { window.speechSynthesis.resume(); setState("playing"); }
  };
  const btn = "min-h-[44px] px-4 rounded-lg border border-black/[0.15] bg-white text-[14px] font-medium text-ink hover:bg-cream-2 disabled:opacity-40";
  return (
    <div className="rounded-xl bg-cream-2 p-3 flex flex-wrap items-center gap-2" role="group" aria-label={`Audio for section ${script.n}`}>
      <button type="button" className={btn} disabled={state === "playing" || state === "paused" || state === "done"} onClick={play}>{state === "done" ? "Played" : "▶ Play section"}</button>
      <button type="button" className={btn} disabled={state !== "playing" && state !== "paused"} onClick={pause}>{state === "paused" ? "Resume" : "Pause"}</button>
      <span className="text-[13px] text-ink-3" role="status">{state === "playing" ? "Playing. You can only play each section once." : state === "done" ? "Finished." : "Plays once, as in the real test."}</span>
      {noVoice ? <span className="text-[13px] text-red-800 basis-full">No speech voice was found in this browser, so audio cannot play. Use Chrome, Edge or Safari with an English voice installed.</span> : null}
    </div>
  );
}
