"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { TurnstileWidget } from "@/components/ui/TurnstileWidget";
import CalButton from "@/components/ui/CalButton";
import { getAttributionPayload } from "@/lib/attribution";
import { trackGenerateLead, trackFormError } from "@/lib/analytics";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ────────────────────────────────────────────────────────────────────────
 * Context — lets any seeker-side CTA (Pricing cards, FinalCTA, persona Hero/
 * Pricing) open the waitlist modal instead of routing to the live app. Mount
 * once near the root (see app/layout.tsx) so no per-page wiring is needed.
 * `source` is recorded with the signup so we know which CTA it came from.
 * ──────────────────────────────────────────────────────────────────────── */

interface SeekerWaitlistValue {
  openWaitlist: (source: string) => void;
}

const SeekerWaitlistContext = createContext<SeekerWaitlistValue | null>(null);

export function useSeekerWaitlist(): SeekerWaitlistValue {
  return (
    useContext(SeekerWaitlistContext) ?? { openWaitlist: () => {} }
  );
}

export function SeekerWaitlistProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");

  const openWaitlist = (src: string) => {
    setSource(src);
    setOpen(true);
  };

  return (
    <SeekerWaitlistContext.Provider value={{ openWaitlist }}>
      {children}
      <SeekerWaitlistModal source={source} open={open} onClose={() => setOpen(false)} />
    </SeekerWaitlistContext.Provider>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function SeekerWaitlistModal({
  source,
  open,
  onClose,
}: {
  source: string;
  open: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyOnList, setAlreadyOnList] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setHoneypot("");
    setEmailError(null);
    setTurnstileToken(null);
    setDone(false);
    setAlreadyOnList(false);
    setServerError(null);
  };

  const handleClose = () => {
    onClose();
    // Reset after the close animation finishes.
    setTimeout(reset, 250);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setServerError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setEmailError("Email is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }

    // Honeypot — silently succeed for bots.
    if (honeypot) { setDone(true); return; }

    if (!turnstileToken) {
      setServerError("Security check not ready. Please wait a moment and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/seeker-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          token: turnstileToken,
          source,
          attribution: getAttributionPayload(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) { setAlreadyOnList(true); setDone(true); return; }
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      trackGenerateLead("seeker_waitlist");
      setDone(true);
    } catch (err) {
      trackFormError("seeker_waitlist", "submit_failed");
      setServerError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-black/[0.09] bg-white px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-3/70 focus:border-orange/60 focus:ring-2 focus:ring-orange/15";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleClose}
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-ink/70 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Join the GrowQR waitlist"
        >
          <motion.div
            initial={reduce ? undefined : { opacity: 0, scale: 0.97, y: 12 }}
            animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.24, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative my-auto w-full max-w-[440px] rounded-[24px] bg-white p-6 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.35)] sm:p-8"
          >
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-ink-3 transition-colors hover:bg-black/[0.05] hover:text-ink"
            >
              <X className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </button>

            {done ? (
              <div className="py-4 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-green-600">
                  <CheckCircle2 className="h-7 w-7" strokeWidth={2} aria-hidden />
                </span>
                <h3 className="mt-5 text-[22px] font-bold tracking-[-0.02em] text-ink">
                  {alreadyOnList ? "Already on the list!" : "You're on the list!"}
                </h3>
                <p className="mx-auto mt-3 max-w-[320px] text-[15px] leading-[1.6] text-ink-2">
                  We&apos;ll email <span className="font-semibold text-ink">{email}</span> when signup opens in your region.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-6 inline-flex items-center justify-center rounded-xl bg-orange px-6 py-3 text-[15px] font-bold text-white transition-colors hover:bg-orange-dark"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-orange/25 bg-orange-light/40 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-orange-deep">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange" aria-hidden />
                  Early Access
                </span>

                <h3 className="mt-4 text-[24px] font-bold leading-[1.15] tracking-[-0.03em] text-ink">
                  Join the waitlist
                </h3>
                <p className="mt-2 text-[15px] leading-[1.6] text-ink-2">
                  Self-serve signup isn&apos;t live in your region yet — join the waitlist and we&apos;ll email you the moment it is.
                </p>

                <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-3.5">
                  {/* Honeypot — hidden from real users */}
                  <input
                    type="text"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                  />

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="sw-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="sw-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(null); setServerError(null); }}
                      className={fieldClass}
                    />
                  </div>

                  {emailError && (
                    <p className="text-[12.5px] font-medium text-red-500">{emailError}</p>
                  )}
                  {serverError && (
                    <p className="text-[12.5px] font-medium text-red-500">{serverError}</p>
                  )}

                  <TurnstileWidget
                    onVerify={setTurnstileToken}
                    onError={() => setServerError("Security check failed. Please refresh and try again.")}
                  />

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-1 inline-flex items-center justify-center gap-2.5 rounded-xl bg-orange py-3.5 text-[16px] font-bold text-white shadow-[0_14px_30px_-12px_rgba(255,106,47,0.6)] transition-all hover:-translate-y-0.5 hover:bg-orange-dark disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join the waitlist"}
                  </button>
                </form>

                {/* Prefer to skip the wait? Book a slot directly. */}
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-black/[0.07]" aria-hidden />
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-4">
                    or
                  </span>
                  <div className="h-px flex-1 bg-black/[0.07]" aria-hidden />
                </div>
                <CalButton
                  label="Book a 15-minute call"
                  source="seeker-waitlist-modal"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.1] py-3 text-[15px] font-bold text-ink transition-colors hover:border-orange/40 hover:text-orange-deep"
                />
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
