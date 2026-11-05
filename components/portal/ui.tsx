"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";

/** Shared building blocks for the account pages (login, sign-up, reset, two-step). Same look as the admin sign-in. */

export function AuthShell({ title, subtitle, children, wide = false }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 bg-cream-2">
      <div className={`w-full ${wide ? "max-w-[560px]" : "max-w-[420px]"} py-8 sm:py-10`}>
        <div className="bg-white rounded-2xl border border-black/[0.1] p-7 sm:p-10 shadow-card">
          <div className="text-center mb-7">
            <Link href="/" aria-label="GrowQR home">
              <Image src="/growqr-logo.png" alt="GrowQR" width={160} height={44} className="h-9 w-auto mx-auto mb-6" priority />
            </Link>
            <h1 className="text-[22px] font-bold text-ink tracking-tight leading-tight mb-1.5">{title}</h1>
            {subtitle ? <p className="text-[14px] text-ink-3">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const tone = kind === "error" ? "bg-red-50 text-red-800 border-red-200" : kind === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-orange-lighter text-ink-2 border-orange/30";
  const Icon = kind === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex gap-2.5 items-start rounded-lg border px-3.5 py-3 text-[14px] leading-snug mb-5 ${tone}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3 rounded-lg border text-[16px] sm:text-[15px] text-ink bg-white outline-none focus:ring-2 focus:ring-orange/25 focus:border-orange/60 transition-all placeholder:text-ink-4 min-h-[44px]";

export function Field({ label, name, type = "text", error, defaultValue, autoComplete, hint, required = true, inputMode, maxLength, autoFocus, placeholder }: {
  label: string; name: string; type?: string; error?: string; defaultValue?: string; autoComplete?: string; hint?: string; required?: boolean;
  inputMode?: "text" | "email" | "numeric"; maxLength?: number; autoFocus?: boolean; placeholder?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="mb-5">
      <label htmlFor={id} className="block text-[13px] sm:text-[14px] font-medium text-ink-2 mb-2">{label}</label>
      <input
        id={id} name={name} type={type} defaultValue={defaultValue} autoComplete={autoComplete} required={required} inputMode={inputMode} maxLength={maxLength}
        autoFocus={autoFocus} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        spellCheck={false} autoCapitalize="none" className={`${inputCls} ${error ? "border-red-400" : "border-black/[0.12]"}`}
      />
      {hint && !error ? <p id={`${id}-hint`} className="text-[12px] text-ink-4 mt-1.5">{hint}</p> : null}
      {error ? <p id={`${id}-err`} className="text-[13px] text-red-700 mt-1.5">{error}</p> : null}
    </div>
  );
}

export function PasswordField({ label = "Password", name = "password", error, autoComplete = "current-password", hint }: { label?: string; name?: string; error?: string; autoComplete?: string; hint?: string }) {
  const [show, setShow] = useState(false);
  const id = `f-${name}`;
  return (
    <div className="mb-5">
      <label htmlFor={id} className="block text-[13px] sm:text-[14px] font-medium text-ink-2 mb-2">{label}</label>
      <div className="relative">
        <input
          id={id} name={name} type={show ? "text" : "password"} required autoComplete={autoComplete} spellCheck={false} autoCapitalize="none"
          aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={`${inputCls} pr-12 ${error ? "border-red-400" : "border-black/[0.12]"}`}
        />
        <button
          type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center text-ink-4 hover:text-ink-2 rounded-md"
        >
          {show ? <EyeOff className="w-[18px] h-[18px]" aria-hidden /> : <Eye className="w-[18px] h-[18px]" aria-hidden />}
        </button>
      </div>
      {hint && !error ? <p id={`${id}-hint`} className="text-[12px] text-ink-4 mt-1.5">{hint}</p> : null}
      {error ? <p id={`${id}-err`} className="text-[13px] text-red-700 mt-1.5">{error}</p> : null}
    </div>
  );
}

export function SubmitButton({ children, pendingText = "Please wait..." }: { children: ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full min-h-[48px] rounded-lg bg-orange hover:bg-orange-dark disabled:opacity-60 text-white font-semibold text-[15px] transition-colors">
      {pending ? pendingText : children}
    </button>
  );
}

/** Cloudflare Turnstile, only when the site has a key (the widget adds its own hidden "cf-turnstile-response" input to the form). */
export function BotCheck() {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;
  return (
    <div className="mb-5 flex justify-center">
      <TurnstileWidget onVerify={() => undefined} />
    </div>
  );
}

/** A field real people never see; bots fill it. */
export function Honeypot() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
      <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
    </div>
  );
}

export function LinkText({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-orange-dark font-medium underline underline-offset-2 hover:text-orange-deep">{children}</Link>;
}
