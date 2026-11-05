"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  bullets, CANVAS, deckToHtmlFile, LAYOUTS, MAX_SHAPES, MAX_SLIDES, newId, newSlide, PALETTE, THEMES, themeOf, type Deck, type Layout, type Shape, type Slide,
} from "@/lib/learn/slides";

/**
 * A presentation builder that runs in the browser: slide thumbnails, a slide you edit in place, layouts, themes, shapes you can drag,
 * a slideshow mode, undo/redo and download. The deck is plain data (see lib/learn/slides.ts); student text is always rendered as text.
 */
const base = "inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md border px-2.5 text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-deep disabled:opacity-40";
const btn = `${base} border-black/[0.14] bg-white text-ink hover:bg-cream-2`;
const btnPrimary = `${base} border-transparent bg-orange-deep font-semibold text-white hover:bg-ink`;

function ShapeEl({ s, selected, onPointerDown }: { s: Shape; selected?: boolean; onPointerDown?: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={s.kind === "circle" ? "rounded-full" : ""}
      style={{ position: "absolute", left: `${(s.x / CANVAS.w) * 100}%`, top: `${(s.y / CANVAS.h) * 100}%`, width: `${(s.w / CANVAS.w) * 100}%`, height: `${(s.h / CANVAS.h) * 100}%`, background: s.fill, opacity: 0.92, clipPath: s.kind === "arrow" ? "polygon(0 30%,60% 30%,60% 0,100% 50%,60% 100%,60% 70%,0 70%)" : undefined, outline: selected ? "2px dashed #d95d2b" : undefined, outlineOffset: 2, cursor: onPointerDown ? "move" : undefined, touchAction: "none" }}
    />
  );
}

/** One slide, drawn at any size (all sizes are in container-relative units). Editable when onChange is given. */
export function SlideView({ slide, deck, onChange, selectedShape, onSelectShape, onShapeMove }: { slide: Slide; deck: Deck; onChange?: (p: Partial<Slide>) => void; selectedShape?: string | null; onSelectShape?: (id: string | null) => void; onShapeMove?: (id: string, x: number, y: number) => void }) {
  const t = themeOf(deck.theme);
  const bg = slide.bg ?? t.bg;
  const edit = Boolean(onChange);
  const root = useRef<HTMLDivElement>(null);
  const centred = slide.layout === "title" || slide.layout === "section";
  const field = "absolute w-full resize-none border-0 bg-transparent p-0 outline-none placeholder:opacity-50 focus:bg-black/[0.04]";
  const text = { color: t.text } as const;
  const title = { color: t.title, fontWeight: 700 } as const;

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    if (!onShapeMove || !root.current) return;
    e.stopPropagation();
    onSelectShape?.(id);
    const rect = root.current.getBoundingClientRect();
    const s = slide.shapes.find((x) => x.id === id);
    if (!s) return;
    const off = { x: ((e.clientX - rect.left) / rect.width) * CANVAS.w - s.x, y: ((e.clientY - rect.top) / rect.height) * CANVAS.h - s.y };
    const move = (ev: PointerEvent) => onShapeMove(id, ((ev.clientX - rect.left) / rect.width) * CANVAS.w - off.x, ((ev.clientY - rect.top) / rect.height) * CANVAS.h - off.y);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const body = (value: string, key: "body" | "body2", box: { x: number; y: number; w: number; h: number }, size: string, ph: string, center = false) => edit ? (
    <textarea
      aria-label={ph}
      placeholder={ph}
      value={value}
      maxLength={1200}
      onChange={(e) => onChange?.({ [key]: e.target.value })}
      className={field}
      style={{ ...text, left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, fontSize: size, textAlign: center ? "center" : "left", lineHeight: 1.45 }}
    />
  ) : (
    <div style={{ ...text, position: "absolute", left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, fontSize: size, textAlign: center ? "center" : "left", lineHeight: 1.45 }}>
      {center ? value : <ul style={{ margin: 0, paddingLeft: "1.1em", listStyle: "disc" }}>{bullets(value).map((b, i) => <li key={i}>{b}</li>)}</ul>}
    </div>
  );
  const ttl = (box: { x: number; y: number; w: number; h: number }, size: string, center: boolean) => edit ? (
    <input aria-label="Slide title" placeholder="Click to add a title" value={slide.title} maxLength={140} onChange={(e) => onChange?.({ title: e.target.value })} className={field} style={{ ...title, left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, fontSize: size, textAlign: center ? "center" : "left" }} />
  ) : (
    <div style={{ ...title, position: "absolute", left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, fontSize: size, textAlign: center ? "center" : "left" }}>{slide.title}</div>
  );

  return (
    <div ref={root} onPointerDown={() => onSelectShape?.(null)} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: bg, containerType: "inline-size", overflow: "hidden" }}>
      {slide.layout === "title" ? <>{ttl({ x: 8, y: 30, w: 84, h: 20 }, "6.2cqw", true)}{body(slide.body, "body", { x: 8, y: 55, w: 84, h: 20 }, "2.8cqw", "Click to add a subtitle", true)}</> : null}
      {slide.layout === "section" ? <>{ttl({ x: 8, y: 38, w: 84, h: 20 }, "5.4cqw", true)}{body(slide.body, "body", { x: 8, y: 58, w: 84, h: 16 }, "2.6cqw", "Optional subtitle", true)}</> : null}
      {slide.layout === "title-content" ? <>{ttl({ x: 7, y: 7, w: 86, h: 16 }, "4.4cqw", false)}{body(slide.body, "body", { x: 7, y: 28, w: 86, h: 62 }, "2.9cqw", "One idea per line. Short bullet points work best.")}</> : null}
      {slide.layout === "two-column" ? <>{ttl({ x: 7, y: 7, w: 86, h: 16 }, "4.4cqw", false)}{body(slide.body, "body", { x: 7, y: 28, w: 41, h: 62 }, "2.7cqw", "Left column: one idea per line")}{body(slide.body2, "body2", { x: 52, y: 28, w: 41, h: 62 }, "2.7cqw", "Right column: one idea per line")}</> : null}
      {slide.shapes.map((s) => <ShapeEl key={s.id} s={s} selected={selectedShape === s.id} onPointerDown={edit ? startDrag(s.id) : undefined} />)}
    </div>
  );
}

export default function SlideStudio({ deck, onChange, label }: { deck: Deck; onChange: (d: Deck) => void; label: string }) {
  const [cur, setCur] = useState(0);
  const [shape, setShape] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [hist, setHist] = useState<{ stack: Deck[]; i: number }>({ stack: [deck], i: 0 });
  const showRef = useRef<HTMLDivElement>(null);
  const slide = deck.slides[Math.min(cur, deck.slides.length - 1)];
  const idx = deck.slides.indexOf(slide);

  const commit = useCallback((d: Deck, record = true) => {
    onChange(d);
    if (record) setHist((h) => { const stack = [...h.stack.slice(0, h.i + 1), d].slice(-60); return { stack, i: stack.length - 1 }; });
  }, [onChange]);
  const patch = (p: Partial<Slide>, record = false) => commit({ ...deck, slides: deck.slides.map((s, i) => (i === idx ? { ...s, ...p } : s)) }, record);
  const undo = () => setHist((h) => { if (h.i === 0) return h; onChange(h.stack[h.i - 1]); return { ...h, i: h.i - 1 }; });
  const redo = () => setHist((h) => { if (h.i >= h.stack.length - 1) return h; onChange(h.stack[h.i + 1]); return { ...h, i: h.i + 1 }; });

  const add = (layout: Layout = "title-content") => { if (deck.slides.length >= MAX_SLIDES) return; const s = newSlide(layout); const slides = [...deck.slides.slice(0, idx + 1), s, ...deck.slides.slice(idx + 1)]; commit({ ...deck, slides }); setCur(idx + 1); setShape(null); };
  const dup = () => { if (deck.slides.length >= MAX_SLIDES) return; const c: Slide = { ...slide, id: newId("s"), shapes: slide.shapes.map((h) => ({ ...h, id: newId("h") })) }; commit({ ...deck, slides: [...deck.slides.slice(0, idx + 1), c, ...deck.slides.slice(idx + 1)] }); setCur(idx + 1); };
  const del = () => { if (deck.slides.length <= 1) return; commit({ ...deck, slides: deck.slides.filter((_, i) => i !== idx) }); setCur(Math.max(0, idx - 1)); setShape(null); };
  const moveSlide = (d: -1 | 1) => { const j = idx + d; if (j < 0 || j >= deck.slides.length) return; const s = [...deck.slides]; [s[idx], s[j]] = [s[j], s[idx]]; commit({ ...deck, slides: s }); setCur(j); };
  const addShape = (kind: Shape["kind"]) => { if (slide.shapes.length >= MAX_SHAPES) return; const h: Shape = { id: newId("h"), kind, x: 600 + slide.shapes.length * 20, y: 330 + slide.shapes.length * 12, w: kind === "arrow" ? 160 : 120, h: kind === "arrow" ? 60 : 90, fill: PALETTE[slide.shapes.length % 4] }; patch({ shapes: [...slide.shapes, h] }, true); setShape(h.id); };
  const selShape = slide.shapes.find((s) => s.id === shape);
  const patchShape = (p: Partial<Shape>, record = false) => patch({ shapes: slide.shapes.map((s) => (s.id === shape ? { ...s, ...p } : s)) }, record);

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([deckToHtmlFile(deck, label)], { type: "text/html" }));
    a.download = `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "presentation"}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const print = () => {
    const url = URL.createObjectURL(new Blob([deckToHtmlFile(deck, label)], { type: "text/html" }));
    const w = window.open(url, "_blank");
    if (w) w.addEventListener("load", () => w.print());
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  useEffect(() => { if (show) showRef.current?.focus(); }, [show]);
  const onShowKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setShow(false);
    else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); setCur((c) => Math.min(deck.slides.length - 1, c + 1)); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); setCur((c) => Math.max(0, c - 1)); }
  };

  return (
    <div>
      <div role="toolbar" aria-label="Presentation tools" className="flex flex-wrap items-center gap-1.5 rounded-t-xl border border-black/[0.12] bg-cream-2 p-2">
        <button type="button" className={btn} aria-label="Undo" onClick={undo} disabled={hist.i === 0}>&#8630;</button>
        <button type="button" className={btn} aria-label="Redo" onClick={redo} disabled={hist.i >= hist.stack.length - 1}>&#8631;</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={btn} onClick={() => add()} disabled={deck.slides.length >= MAX_SLIDES}>+ Add slide</button>
        <button type="button" className={btn} onClick={dup} disabled={deck.slides.length >= MAX_SLIDES}>Duplicate</button>
        <button type="button" className={btn} onClick={del} disabled={deck.slides.length <= 1}>Delete</button>
        <button type="button" className={btn} aria-label="Move slide up" onClick={() => moveSlide(-1)} disabled={idx === 0}>&#8593;</button>
        <button type="button" className={btn} aria-label="Move slide down" onClick={() => moveSlide(1)} disabled={idx === deck.slides.length - 1}>&#8595;</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <label className="sr-only" htmlFor="ss-layout">Layout</label>
        <select id="ss-layout" className={`${btn} pr-6`} value={slide.layout} onChange={(e) => patch({ layout: e.target.value as Layout }, true)}>{LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
        <label className="sr-only" htmlFor="ss-theme">Theme</label>
        <select id="ss-theme" className={`${btn} pr-6`} value={deck.theme} onChange={(e) => commit({ ...deck, theme: e.target.value })}>{THEMES.map((t) => <option key={t.id} value={t.id}>Theme: {t.label}</option>)}</select>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={btn} onClick={() => addShape("rect")}>+ Box</button>
        <button type="button" className={btn} onClick={() => addShape("circle")}>+ Circle</button>
        <button type="button" className={btn} onClick={() => addShape("arrow")}>+ Arrow</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={btnPrimary} onClick={() => setShow(true)}>&#9654; Slideshow</button>
        <button type="button" className={btn} onClick={download}>Download .html</button>
        <button type="button" className={btn} onClick={print}>Print / PDF</button>
      </div>

      <div className="grid gap-3 border border-t-0 border-black/[0.12] bg-white p-3 lg:grid-cols-[150px_1fr_190px]">
        <ol aria-label="Slides" className="flex gap-2 overflow-x-auto lg:max-h-[440px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
          {deck.slides.map((s, i) => (
            <li key={s.id} className="shrink-0 lg:shrink">
              <button type="button" onClick={() => { setCur(i); setShape(null); }} aria-current={i === idx ? "true" : undefined} aria-label={`Slide ${i + 1}${s.title ? `: ${s.title}` : ""}`} className={`block w-[130px] rounded-md border-2 p-0 text-left lg:w-full ${i === idx ? "border-orange-deep" : "border-black/[0.12] hover:border-black/30"}`}>
                <div className="pointer-events-none"><SlideView slide={s} deck={deck} /></div>
                <span className="block bg-cream-2 px-1.5 py-0.5 text-[11px] text-ink-3">{i + 1}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="min-w-0">
          <div className="overflow-hidden rounded-lg border border-black/[0.2] shadow-sm"><SlideView slide={slide} deck={deck} onChange={(p) => patch(p, false)} selectedShape={shape} onSelectShape={setShape} onShapeMove={(id, x, y) => commit({ ...deck, slides: deck.slides.map((s, i) => (i === idx ? { ...s, shapes: s.shapes.map((h) => (h.id === id ? { ...h, x: Math.max(0, Math.min(CANVAS.w - h.w, Math.round(x))), y: Math.max(0, Math.min(CANVAS.h - h.h, Math.round(y))) } : h)) } : s)) }, false)} /></div>
          <p className="mt-1.5 text-[12.5px] text-ink-3">Click a text area to type. Drag a shape to move it. Slide {idx + 1} of {deck.slides.length}.</p>
        </div>

        <div className="space-y-3 text-[13px]">
          <fieldset><legend className="mb-1 font-semibold text-ink">Background</legend>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={btn} onClick={() => patch({ bg: undefined }, true)}>Theme</button>
              {PALETTE.map((c) => <button key={c} type="button" className="h-8 w-8 rounded-md border border-black/[0.25]" style={{ background: c }} aria-label={`Background ${c}`} onClick={() => patch({ bg: c }, true)} />)}
            </div>
          </fieldset>
          {selShape ? (
            <fieldset><legend className="mb-1 font-semibold text-ink">Selected shape</legend>
              <div className="flex flex-wrap gap-1.5">{PALETTE.map((c) => <button key={c} type="button" className="h-8 w-8 rounded-md border border-black/[0.25]" style={{ background: c }} aria-label={`Shape colour ${c}`} onClick={() => patchShape({ fill: c }, true)} />)}</div>
              <label className="mt-2 block text-ink-3" htmlFor="ss-w">Width</label><input id="ss-w" type="range" min={20} max={600} value={selShape.w} onChange={(e) => patchShape({ w: Number(e.target.value) })} onMouseUp={() => patchShape({}, true)} className="w-full" />
              <label className="block text-ink-3" htmlFor="ss-h">Height</label><input id="ss-h" type="range" min={20} max={400} value={selShape.h} onChange={(e) => patchShape({ h: Number(e.target.value) })} onMouseUp={() => patchShape({}, true)} className="w-full" />
              <button type="button" className={`${btn} mt-1`} onClick={() => { patch({ shapes: slide.shapes.filter((s) => s.id !== shape) }, true); setShape(null); }}>Delete shape</button>
            </fieldset>
          ) : <p className="text-ink-3">Add a shape, then click it to change its colour and size.</p>}
        </div>
      </div>

      {show ? (
        <div ref={showRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Slideshow" onKeyDown={onShowKey} className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black p-2 outline-none sm:p-6">
          <div className="w-full max-w-[min(100%,calc((100vh-6rem)*16/9))] overflow-hidden rounded"><SlideView slide={slide} deck={deck} /></div>
          <div className="mt-3 flex items-center gap-3 text-white">
            <button type="button" className="min-h-[44px] rounded-md bg-white/15 px-4 hover:bg-white/25" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={idx === 0}>Previous</button>
            <span aria-live="polite">{idx + 1} / {deck.slides.length}</span>
            <button type="button" className="min-h-[44px] rounded-md bg-white/15 px-4 hover:bg-white/25" onClick={() => setCur((c) => Math.min(deck.slides.length - 1, c + 1))} disabled={idx === deck.slides.length - 1}>Next</button>
            <button type="button" className="min-h-[44px] rounded-md bg-orange-deep px-4 hover:bg-orange-dark" onClick={() => setShow(false)}>Exit (Esc)</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
