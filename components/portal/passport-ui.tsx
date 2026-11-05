"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, SubmitButton } from "./ui";
import { publishPassportAction, scoreResumeAction, type PassportState } from "@/app/(portal)/passport/actions";

const none: PassportState = {};

/** Upload a resume file or paste its text. */
export function ScoreForm({ hasPassport }: { hasPassport: boolean }) {
  const [s, action] = useActionState(scoreResumeAction, none);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (s.ok) form.current?.reset();
  }, [s]);
  return (
    <form ref={form} action={action} encType="multipart/form-data">
      {s.error ? <Alert>{s.error}</Alert> : null}
      {s.ok ? <Alert kind="success">{s.message}</Alert> : null}
      <label htmlFor="resume" className="block text-[14px] font-medium text-ink-2 mb-2">Upload your resume (PDF, DOCX or TXT, up to 5 MB)</label>
      <input id="resume" name="resume" type="file" accept=".pdf,.docx,.txt" className="block w-full text-[14px] mb-5 file:mr-4 file:min-h-[44px] file:rounded-lg file:border-0 file:bg-orange-light file:px-4 file:font-medium file:text-orange-deep" />
      <label htmlFor="resume_text" className="block text-[14px] font-medium text-ink-2 mb-2">or paste the text</label>
      <textarea id="resume_text" name="resume_text" rows={7} maxLength={60000} placeholder="Paste your resume here" className="w-full px-4 py-3 rounded-lg border border-black/[0.12] text-[15px] mb-5 outline-none focus:ring-2 focus:ring-orange/25 focus:border-orange/60" />
      <SubmitButton pendingText="Scoring your resume...">{hasPassport ? "Score again and update my passport" : "Score my resume"}</SubmitButton>
      <p className="text-[12px] text-ink-4 mt-3">Scoring is rule-based: the same resume always gets the same score. Nothing is shared until you publish your passport.</p>
    </form>
  );
}

/** Choose what the public passport shows, then publish (or refresh) it. */
export function PublishForm({ styles, current }: { styles: Record<string, string>; current: { name_style: string; show_skills: boolean; show_courses: boolean; show_college: boolean; is_public: boolean } }) {
  const [s, action] = useActionState(publishPassportAction, none);
  return (
    <form action={action}>
      {s.error ? <Alert>{s.error}</Alert> : null}
      {s.ok ? <Alert kind="success">{s.message}</Alert> : null}
      <fieldset className="mb-5">
        <legend className="text-[14px] font-medium text-ink-2 mb-2">How should your name appear?</legend>
        {Object.entries(styles).map(([k, label]) => (
          <label key={k} className="flex items-center gap-3 min-h-[44px] text-[15px] text-ink-2">
            <input type="radio" name="name_style" value={k} defaultChecked={current.name_style === k} className="w-5 h-5 accent-orange" />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="mb-6">
        <legend className="text-[14px] font-medium text-ink-2 mb-2">What else should it show? (the RQ Score is always shown)</legend>
        <label className="flex items-center gap-3 min-h-[44px] text-[15px] text-ink-2"><input type="checkbox" name="show_skills" defaultChecked={current.show_skills} className="w-5 h-5 accent-orange" /> My skills</label>
        <label className="flex items-center gap-3 min-h-[44px] text-[15px] text-ink-2"><input type="checkbox" name="show_courses" defaultChecked={current.show_courses} className="w-5 h-5 accent-orange" /> My completed courses</label>
        <label className="flex items-center gap-3 min-h-[44px] text-[15px] text-ink-2"><input type="checkbox" name="show_college" defaultChecked={current.show_college} className="w-5 h-5 accent-orange" /> My college</label>
      </fieldset>
      <p className="text-[13px] text-ink-3 mb-4">Your email, phone number and resume text are never shown. The passport is signed by GrowQR, so nobody can change what it says. You can withdraw it at any time.</p>
      <SubmitButton pendingText="Publishing...">{current.is_public ? "Update my public passport" : "Publish my passport"}</SubmitButton>
    </form>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  const id = "copy-" + label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-2 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 px-3 min-h-[44px] rounded-lg border border-black/[0.12] bg-cream text-[14px]" />
        <button
          type="button"
          className="min-h-[44px] px-4 rounded-lg border border-black/[0.15] text-[14px] font-medium hover:bg-cream-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setDone(true);
              setTimeout(() => setDone(false), 1800);
            } catch {
              /* the field is selectable: the person can copy by hand */
            }
          }}
        >
          {done ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const b64u = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Checks the signature on the visitor's own device with WebCrypto (Ed25519), so they need not trust this server's own check. */
export function ClientCheck({ jwt, jwksUrl }: { jwt: string; jwksUrl: string }) {
  const [state, setState] = useState<{ ok: boolean | null; text: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.crypto?.subtle) return;
      const parts = jwt.split(".");
      if (parts.length !== 3) return;
      try {
        const header = JSON.parse(new TextDecoder().decode(b64u(parts[0]))) as { kid?: string };
        const kid = String(header.kid ?? "").split("#").pop();
        const set = (await (await fetch(jwksUrl, { credentials: "omit" })).json()) as { keys?: Array<{ kid: string; kty: string; crv: string; x: string }> };
        const jwk = (set.keys ?? []).find((k) => k.kid === kid);
        if (!jwk) return void (!cancelled && setState({ ok: false, text: `The signing key ${kid} is not in GrowQR’s published key list.` }));
        const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, crv: jwk.crv, x: jwk.x }, { name: "Ed25519" }, false, ["verify"]);
        const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
        if (!cancelled) setState({ ok, text: ok ? "Double-checked on your own device: the signature matches GrowQR’s published public key." : "Your device found that the signature does NOT match. Do not rely on this passport." });
      } catch {
        /* browsers without Ed25519: the server-side check shown above still applies */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jwt, jwksUrl]);
  if (!state) return null;
  return (
    <p role="status" className={`mb-4 rounded-lg px-3.5 py-3 text-[14px] ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
      {state.text}
    </p>
  );
}
