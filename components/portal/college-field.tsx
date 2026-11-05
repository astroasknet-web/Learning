"use client";

import { useEffect, useId, useRef, useState } from "react";

const inputCls = "w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-ink outline-none transition placeholder:text-ink-4 min-h-[48px] focus:border-[#7857ff] focus:ring-4 focus:ring-[#7857ff]/15 sm:text-[15px]";
const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

type Opt = { name: string; place: string };

/** The typed text, with the first place it appears in the name set in bold. */
function Marked({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<strong className="font-semibold text-ink">{text.slice(i, i + q.length)}</strong>{text.slice(i + q.length)}</>;
}

/**
 * College picker for signup. As the student types, matching colleges drop down (from the approved directory, topped up from the bundled
 * list of Indian colleges); arrow keys, Enter, Escape and the mouse all work. If what they typed is not listed they may choose a state,
 * and the server files it for review.
 */
export function CollegeField({ defaultValue, error, states }: { defaultValue?: string; error?: string; states: string[] }) {
  const id = useId();
  const [text, setText] = useState(defaultValue ?? "");
  const [opts, setOpts] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const picked = useRef(defaultValue ?? "");

  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || q === picked.current) { setOpts([]); setBusy(false); return; }
    const ctl = new AbortController();
    setBusy(true);
    const t = setTimeout(() => {
      fetch(`/api/colleges/suggest?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((j) => { setOpts(Array.isArray(j) ? j : []); setActive(-1); setBusy(false); })
        .catch((e) => { if (e?.name !== "AbortError") setBusy(false); });
    }, 150);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [text]);

  const choose = (o: Opt) => { picked.current = o.name; setText(o.name); setOpts([]); setOpen(false); setActive(-1); };
  const q = text.trim();
  const showList = open && opts.length > 0;
  const listed = opts.some((o) => key(o.name) === key(text)) || picked.current === text;
  const unlisted = q.length >= 4 && !listed && !busy && opts.length === 0;

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!opts.length) return;
      e.preventDefault();
      setOpen(true);
      const n = opts.length;
      setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === "Enter" && showList && active >= 0) {
      e.preventDefault();
      choose(opts[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="mb-4">
      <label htmlFor={`${id}-c`} className="mb-1.5 block text-[13.5px] font-semibold text-ink-2">College or university</label>
      <div className="relative">
        <input id={`${id}-c`} name="college" value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey}
          required maxLength={160} autoComplete="off" spellCheck={false} role="combobox" aria-expanded={showList} aria-controls={`${id}-l`} aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${id}-o${active}` : undefined} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : `${id}-h`}
          placeholder="Start typing your college name" className={`${inputCls} ${error ? "border-red-400" : "border-black/[0.12]"}`} />
        {showList ? (
          <ul id={`${id}-l`} role="listbox" aria-label="Matching colleges" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[300px] overflow-auto rounded-xl border border-black/[0.1] bg-white py-1 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
            {opts.map((o, i) => (
              <li key={`${o.name}|${o.place}`} id={`${id}-o${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-4 py-2.5 text-[14.5px] leading-snug text-ink-2 ${i === active ? "bg-[#7857ff]/10" : ""}`}>
                <span className="block"><Marked text={o.name} q={q} /></span>
                {o.place ? <span className="block text-[12.5px] text-ink-4">{o.place}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? <p id={`${id}-e`} className="text-[13px] text-red-700 mt-1.5">{error}</p> : <p id={`${id}-h`} className="text-[12px] text-ink-4 mt-1.5">Type two letters or more and pick your college from the list. Not listed? Type the name in full.</p>}
      {unlisted ? (
        <div className="mt-3 rounded-lg border border-black/[0.1] bg-cream-2 p-3">
          <label htmlFor={`${id}-s`} className="block text-[13px] text-ink-3 mb-1.5">Not in our list? Choose its state and we will add it for review (optional).</label>
          <select id={`${id}-s`} name="college_state" defaultValue="" className="w-full px-3 py-2.5 rounded-lg border border-black/[0.12] bg-white text-[15px] min-h-[44px]">
            <option value="">Do not add it</option>{states.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      ) : null}
    </div>
  );
}
