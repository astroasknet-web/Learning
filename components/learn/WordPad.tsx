"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeDoc, docToHtmlFile, sanitizeDoc } from "@/lib/learn/doc";

/**
 * A small word processor that runs in the browser. It edits real content (contentEditable) so students see their formatting happen.
 * Everything that leaves the editor goes through sanitizeDoc(); pasted text is inserted as plain text. document.execCommand is old but
 * is still the one API every browser supports for rich-text editing without a heavy library.
 */
const SIZES = [12, 14, 16, 18, 24, 32];
const btn = "inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-black/[0.14] bg-white px-2 text-[14px] text-ink hover:bg-cream-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-deep disabled:opacity-40";

export default function WordPad({ html, onChange, label }: { html: string; onChange: (html: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState(() => analyzeDoc(html));
  const [tbl, setTbl] = useState({ open: false, rows: 3, cols: 3 });
  const initial = useRef(html);

  useEffect(() => {
    if (ref.current) { ref.current.innerHTML = sanitizeDoc(initial.current) || "<p><br></p>"; setStats(analyzeDoc(ref.current.innerHTML)); }
  }, []);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const clean = sanitizeDoc(ref.current.innerHTML);
    setStats(analyzeDoc(clean));
    onChange(clean);
  }, [onChange]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const block = (tag: string) => exec("formatBlock", `<${tag}>`);
  const size = (px: number) => {
    ref.current?.focus();
    document.execCommand("fontSize", false, "7"); // then turn the legacy <font size=7> it makes into a px style
    ref.current?.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      span.innerHTML = f.innerHTML;
      f.replaceWith(span);
    });
    emit();
  };
  const insertTable = () => {
    const r = Math.max(1, Math.min(12, tbl.rows)), c = Math.max(1, Math.min(8, tbl.cols));
    const cell = (tag: string) => `<${tag}>&nbsp;</${tag}>`;
    const rows = Array.from({ length: r }, (_, i) => `<tr>${Array.from({ length: c }, () => cell(i === 0 ? "th" : "td")).join("")}</tr>`).join("");
    exec("insertHTML", `<table>${rows}</table><p><br></p>`);
    setTbl({ ...tbl, open: false });
  };
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").slice(0, 20000);
    document.execCommand("insertText", false, text);
    emit();
  };
  const download = (kind: "html" | "doc") => {
    const body = docToHtmlFile(ref.current?.innerHTML ?? "", label);
    const blob = new Blob([body], { type: kind === "doc" ? "application/msword" : "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "document"}.${kind}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div>
      <style>{`@media print{body *{visibility:hidden}.wp-page,.wp-page *{visibility:visible}.wp-page{position:absolute;left:0;top:0;width:100%;box-shadow:none!important;border:0!important}}
.wp-page h1{font-size:1.8em;font-weight:700;margin:.4em 0}.wp-page h2{font-size:1.4em;font-weight:700;margin:.5em 0}.wp-page h3{font-size:1.15em;font-weight:700;margin:.5em 0}.wp-page p,.wp-page div{margin:.35em 0}.wp-page ul{list-style:disc;padding-left:1.5em}.wp-page ol{list-style:decimal;padding-left:1.5em}.wp-page table{border-collapse:collapse;width:100%;margin:.5em 0}.wp-page td,.wp-page th{border:1px solid #6b7280;padding:.3em .5em;min-width:3em}.wp-page th{background:#f3f4f6}`}</style>
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1.5 rounded-t-xl border border-black/[0.12] bg-cream-2 p-2">
        <button type="button" className={btn} aria-label="Undo" onClick={() => exec("undo")}>&#8630;</button>
        <button type="button" className={btn} aria-label="Redo" onClick={() => exec("redo")}>&#8631;</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <label className="sr-only" htmlFor="wp-style">Paragraph style</label>
        <select id="wp-style" className={`${btn} pr-6`} defaultValue="" onChange={(e) => { if (e.target.value) block(e.target.value); e.target.value = ""; }}>
          <option value="">Style</option><option value="p">Normal text</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option>
        </select>
        <label className="sr-only" htmlFor="wp-size">Font size</label>
        <select id="wp-size" className={`${btn} pr-6`} defaultValue="" onChange={(e) => { if (e.target.value) size(Number(e.target.value)); e.target.value = ""; }}>
          <option value="">Size</option>{SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={`${btn} font-bold`} aria-label="Bold" onClick={() => exec("bold")}>B</button>
        <button type="button" className={`${btn} italic`} aria-label="Italic" onClick={() => exec("italic")}>I</button>
        <button type="button" className={`${btn} underline`} aria-label="Underline" onClick={() => exec("underline")}>U</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={btn} aria-label="Align left" onClick={() => exec("justifyLeft")}>&#8676;</button>
        <button type="button" className={btn} aria-label="Centre" onClick={() => exec("justifyCenter")}>&#8596;</button>
        <button type="button" className={btn} aria-label="Align right" onClick={() => exec("justifyRight")}>&#8677;</button>
        <button type="button" className={btn} aria-label="Justify" onClick={() => exec("justifyFull")}>&#9776;</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={btn} aria-label="Bulleted list" onClick={() => exec("insertUnorderedList")}>&#8226; List</button>
        <button type="button" className={btn} aria-label="Numbered list" onClick={() => exec("insertOrderedList")}>1. List</button>
        <button type="button" className={btn} aria-expanded={tbl.open} onClick={() => setTbl({ ...tbl, open: !tbl.open })}>Table</button>
        <span className="mx-1 h-6 w-px bg-black/[0.15]" aria-hidden="true" />
        <button type="button" className={btn} onClick={() => window.print()}>Print</button>
        <button type="button" className={btn} onClick={() => download("doc")}>Download .doc</button>
        <button type="button" className={btn} onClick={() => download("html")}>Download .html</button>
      </div>
      {tbl.open ? (
        <div className="flex flex-wrap items-end gap-3 border-x border-black/[0.12] bg-white p-3">
          <div><label htmlFor="wp-rows" className="block text-[12px] text-ink-3">Rows</label><input id="wp-rows" type="number" min={1} max={12} value={tbl.rows} onChange={(e) => setTbl({ ...tbl, rows: Number(e.target.value) })} className="min-h-[40px] w-20 rounded-md border border-black/[0.2] px-2 text-[14px]" /></div>
          <div><label htmlFor="wp-cols" className="block text-[12px] text-ink-3">Columns</label><input id="wp-cols" type="number" min={1} max={8} value={tbl.cols} onChange={(e) => setTbl({ ...tbl, cols: Number(e.target.value) })} className="min-h-[40px] w-20 rounded-md border border-black/[0.2] px-2 text-[14px]" /></div>
          <button type="button" className="min-h-[40px] rounded-md bg-orange-deep px-4 text-[14px] font-semibold text-white hover:bg-ink" onClick={insertTable}>Insert table</button>
          <p className="text-[12px] text-ink-3">The first row becomes the heading row.</p>
        </div>
      ) : null}
      <div className="overflow-auto rounded-b-xl border border-t-0 border-black/[0.12] bg-[#e9e7e1] p-3 sm:p-6">
        <div
          ref={ref}
          className="wp-page mx-auto min-h-[420px] max-w-[794px] bg-white p-6 text-[16px] leading-relaxed text-black shadow-[0_2px_12px_rgba(0,0,0,0.18)] outline-none focus-visible:ring-2 focus-visible:ring-orange-deep sm:p-12"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={`${label}: document editor`}
          spellCheck
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
        />
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3" aria-live="polite">{stats.words} word{stats.words === 1 ? "" : "s"} &middot; {stats.chars} characters</p>
    </div>
  );
}
