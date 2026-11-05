"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chunkText, DEFAULTS, MAX_FONTSCALE, parseSettings, pickVoice, RATES, STORAGE_KEY, type A11ySettings } from "@/lib/a11y/read-aloud";

/** Elements that are chrome, not lesson content: never read aloud. */
const SKIP = "#a11y-root,nav,aside,header,footer,button,select,script,style,[aria-hidden='true'],[hidden]";
const BLOCKS = "h1,h2,h3,h4,p,li,td,th,blockquote,dt,dd,figcaption,legend";

function applyToPage(s: A11ySettings): void {
  const r = document.documentElement;
  if (s.fontscale) r.setAttribute("data-fontscale", String(s.fontscale));
  else r.removeAttribute("data-fontscale");
  const flag = (k: string, on: boolean) => (on ? r.setAttribute(k, "1") : r.removeAttribute(k));
  flag("data-contrast", s.contrast);
  flag("data-dyslexia", s.dyslexia);
  flag("data-reduce-motion", s.reduceMotion);
}

function readableBlocks(): HTMLElement[] {
  const root = document.querySelector<HTMLElement>("[data-read-root]") ?? document.querySelector<HTMLElement>("main#main") ?? document.querySelector<HTMLElement>("main") ?? document.body;
  return Array.from(root.querySelectorAll<HTMLElement>(BLOCKS)).filter((n) => !n.closest(SKIP) && n.getClientRects().length > 0 && (n.innerText ?? "").trim().length > 1 && !n.querySelector(BLOCKS));
}

/** Accessibility and display panel plus read-aloud (browser Web Speech API) for the learning pages. Settings are kept on this device only. */
export default function A11yPanel() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<A11ySettings>(DEFAULTS);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [supported, setSupported] = useState(true);
  const run = useRef(0);
  const sRef = useRef(s);
  sRef.current = s;
  const fab = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
    const init = parseSettings(saved);
    setS(init);
    applyToPage(init);
    const ok = "speechSynthesis" in window;
    setSupported(ok);
    if (!ok) return;
    const load = () => setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en")));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const update = useCallback((patch: Partial<A11ySettings>) => {
    const next = { ...sRef.current, ...patch };
    sRef.current = next;
    setS(next);
    applyToPage(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(() => {
    run.current++;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    document.querySelectorAll(".a11y-reading").forEach((e) => e.classList.remove("a11y-reading"));
    setSpeaking(false);
    setPaused(false);
  }, []);

  const start = useCallback(
    (blocks: HTMLElement[]) => {
      if (!blocks.length || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const id = ++run.current;
      setSpeaking(true);
      setPaused(false);
      const voice = pickVoice(Array.from(window.speechSynthesis.getVoices()), sRef.current.voice);
      let bi = 0;
      const nextBlock = () => {
        document.querySelectorAll(".a11y-reading").forEach((e) => e.classList.remove("a11y-reading"));
        if (id !== run.current) return;
        if (bi >= blocks.length) {
          setSpeaking(false);
          setPaused(false);
          return;
        }
        const el = blocks[bi++];
        const chunks = chunkText(el.innerText ?? "");
        if (!chunks.length) return nextBlock();
        el.classList.add("a11y-reading");
        el.scrollIntoView({ block: "center", behavior: sRef.current.reduceMotion ? "auto" : "smooth" });
        let ci = 0;
        const nextChunk = () => {
          if (id !== run.current) return;
          if (ci >= chunks.length) return nextBlock();
          const u = new SpeechSynthesisUtterance(chunks[ci++]);
          u.rate = sRef.current.rate;
          u.lang = voice?.lang ?? "en-IN";
          if (voice) u.voice = voice;
          u.onend = nextChunk;
          u.onerror = () => {
            if (id === run.current) stop();
          };
          window.speechSynthesis.speak(u);
        };
        nextChunk();
      };
      nextBlock();
    },
    [stop],
  );

  const readPage = () => (speaking ? stop() : start(readableBlocks()));
  const readFrom = () => {
    const sel = window.getSelection();
    const node = sel && sel.anchorNode ? (sel.anchorNode.nodeType === 1 ? (sel.anchorNode as HTMLElement) : sel.anchorNode.parentElement) : null;
    const all = readableBlocks();
    const at = node ? all.findIndex((b) => b === node || b.contains(node)) : -1;
    start(at >= 0 ? all.slice(at) : all);
  };
  const pause = () => {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        fab.current?.focus();
      }
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const btn = "min-h-[44px] px-3 rounded-lg border border-black/[0.15] bg-white text-[14px] font-medium text-ink hover:bg-cream-2 aria-pressed:bg-orange-deep aria-pressed:text-white aria-pressed:border-orange-deep";

  return (
    <div id="a11y-root" className="print:hidden">
      <button
        ref={fab}
        type="button"
        aria-label="Accessibility and read-aloud settings"
        aria-expanded={open}
        aria-controls="a11y-panel"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-[60] w-12 h-12 rounded-full bg-ink text-white shadow-lg grid place-items-center text-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
      >
        <span aria-hidden="true">&#9855;</span>
      </button>
      {open ? (
        <div id="a11y-panel" role="dialog" aria-label="Accessibility settings" className="fixed bottom-20 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto rounded-2xl bg-white border border-black/[0.12] shadow-2xl p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-bold text-ink">Accessibility and reading</p>
              <p className="text-[13px] text-ink-3">Saved on this device only.</p>
            </div>
            <button type="button" aria-label="Close" onClick={() => { setOpen(false); fab.current?.focus(); }} className="min-h-[44px] min-w-[44px] text-[22px] text-ink-3">&times;</button>
          </div>

          <section aria-labelledby="a11y-read-h">
            <h2 id="a11y-read-h" className="text-[13px] font-semibold text-ink-3 uppercase tracking-wide mb-2">Read aloud</h2>
            {!supported ? (
              <p className="text-[13px] text-ink-3">This browser cannot read aloud. Try Chrome, Edge or Safari.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={readPage} className={`${btn} col-span-2`}>{speaking ? "■ Stop reading" : "▶ Read this page"}</button>
                  <button type="button" onClick={readFrom} className={btn} title="Select some text first to start from there">Read from selection</button>
                  <button type="button" onClick={pause} disabled={!speaking} aria-pressed={paused} className={`${btn} disabled:opacity-40`}>{paused ? "Resume" : "Pause"}</button>
                </div>
                <div className="mt-3">
                  <span className="block text-[13px] text-ink-3 mb-1" id="a11y-rate">Speed</span>
                  <div className="flex gap-2" role="group" aria-labelledby="a11y-rate">
                    {RATES.map((r) => (
                      <button key={r} type="button" aria-pressed={s.rate === r} onClick={() => update({ rate: r })} className={`${btn} flex-1 px-0`}>{r}x</button>
                    ))}
                  </div>
                </div>
                {voices.length > 1 ? (
                  <div className="mt-3">
                    <label htmlFor="a11y-voice" className="block text-[13px] text-ink-3 mb-1">Voice</label>
                    <select id="a11y-voice" value={s.voice} onChange={(e) => update({ voice: e.target.value })} className="w-full min-h-[44px] px-3 rounded-lg border border-black/[0.15] bg-white text-[14px]">
                      <option value="">Automatic (Indian English if available)</option>
                      {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                    </select>
                  </div>
                ) : voices.length === 0 ? (
                  <p className="text-[12px] text-ink-3 mt-2">No English voice found on this device. Install one in your system settings.</p>
                ) : null}
              </>
            )}
          </section>

          <section aria-labelledby="a11y-disp-h">
            <h2 id="a11y-disp-h" className="text-[13px] font-semibold text-ink-3 uppercase tracking-wide mb-2">Display</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[14px] text-ink-2 flex-1">Text size</span>
              <button type="button" aria-label="Decrease text size" disabled={s.fontscale <= 0} onClick={() => update({ fontscale: Math.max(0, s.fontscale - 1) })} className={`${btn} w-12 px-0 disabled:opacity-40`}>A&minus;</button>
              <button type="button" aria-label="Increase text size" disabled={s.fontscale >= MAX_FONTSCALE} onClick={() => update({ fontscale: Math.min(MAX_FONTSCALE, s.fontscale + 1) })} className={`${btn} w-12 px-0 disabled:opacity-40`}>A+</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={s.contrast} onClick={() => update({ contrast: !s.contrast })} className={btn}>High contrast</button>
              <button type="button" aria-pressed={s.dyslexia} onClick={() => update({ dyslexia: !s.dyslexia })} className={btn}>Easy-read font</button>
              <button type="button" aria-pressed={s.reduceMotion} onClick={() => update({ reduceMotion: !s.reduceMotion })} className={`${btn} col-span-2`}>Reduce motion</button>
            </div>
          </section>
          <button type="button" onClick={() => { stop(); update({ ...DEFAULTS }); }} className="text-[13px] underline text-ink-3 min-h-[44px]">Reset all</button>
        </div>
      ) : null}
    </div>
  );
}
