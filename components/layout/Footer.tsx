"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaFacebookF, FaInstagram, FaLinkedin, FaLinkedinIn, FaTelegram, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { ArrowRight, ArrowUp, Check, Link2, Mail, MapPin, Share2 } from "lucide-react";
import Logo from "./Logo";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/ui/TurnstileWidget";
import { useIsIndia } from "@/components/layout/CurrencyProvider";
import { trackGenerateLead, trackFormError } from "@/lib/analytics";
import { CLASSROOM_URL } from "@/lib/links";
import { RESUME_SCORE_URL } from "@/components/home-options/data";
import { SITE_URL } from "@/lib/seo";
import { VERTICALS } from "@/components/home-v3/data";

const FOOTER_APP_NAME: Record<string, string> = { math: "Maths Speed Studio", writing: "English Writing Studio", abroad: "Study Abroad", classes: "Live Classes" };

// Pricing is a B2C (self-serve, individual) concept — GrowQR's B2B surfaces
// (Enterprises/Institutes/Recruiters/Startups solution pages, /enterprise and
// its agent pages, and everything else: About, Vision, Contact, Experts,
// Events, Community, ...) sell on a custom quote via "Book a Call", not a
// public price list. Rather than denylist every B2B/other page, this is an
// allowlist of the B2C pages where the footer's Pricing link should appear —
// anything not listed here hides the link by default. Listed pages render
// their own #pricing section, so the footer link jumps straight to it.
const B2C_PAGES_WITH_PRICING = new Set([
  "/",
  "/solutions/coaches",
  "/solutions/consultants",
  "/solutions/freelancers",
  "/solutions/professionals",
  "/solutions/students",
  "/ai-roleplay-coach",
  "/ai-learning-curator",
  "/ai-interviewer",
  "/ai-opportunity-finder",
  "/ai-resume-expert",
  "/ai-brand-builder",
  "/ai-skill-trainer",
]);

function usePricingHref() {
  const pathname = usePathname() ?? "/";
  if (!B2C_PAGES_WITH_PRICING.has(pathname)) return null;
  return `${pathname === "/" ? "" : pathname}#pricing`;
}

export default function Footer() {
  const pricingHref = usePricingHref();
  const isIndia = useIsIndia();
  // Experts, events and community are India-specific, so they are listed in the "Go global" column for Indian visitors only.
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => { setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function"); }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [shouldSubmit, setShouldSubmit] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  // Turnstile injects ~250KB of Cloudflare scripts the moment it mounts. The
  // footer is on every page, so we don't mount it until the user engages the
  // newsletter field — keeping that payload off the initial page load.
  const [turnstileArmed, setTurnstileArmed] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const processSubscription = useCallback(async () => {
    if (!email) {
      setErrorMessage("Please enter your email.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/send-newsletter-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer", token: turnstileToken }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error("You are already subscribed.");
        }
        throw new Error(data.error || "Could not subscribe. Please try again.");
      }

      trackGenerateLead("newsletter");
      setSuccessMessage("Thanks for subscribing.");
      setErrorMessage(null);
      setEmail("");
      setTurnstileToken(null);
      turnstileRef.current?.reset();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error: any) {
      // "Already subscribed" is a benign duplicate, not a submission failure.
      if (error?.message !== "You are already subscribed.") {
        trackFormError("newsletter", "submit_failed");
      }
      setErrorMessage(error?.message || "Something went wrong. Please try again.");
      setSuccessMessage(null);
    } finally {
      setIsLoading(false);
    }
  }, [email, turnstileToken]);

  useEffect(() => {
    if (shouldSubmit && turnstileToken) {
      processSubscription();
      setShouldSubmit(false);
    }
  }, [processSubscription, shouldSubmit, turnstileToken]);

  // Once the widget has mounted (armed) and we're mid-submit without a token,
  // kick off the invisible challenge. Runs here (not inline in the submit
  // handler) so it also works when submit is what first armed the widget.
  useEffect(() => {
    if (turnstileArmed && shouldSubmit && !turnstileToken) {
      turnstileRef.current?.execute();
    }
  }, [turnstileArmed, shouldSubmit, turnstileToken]);

  const handleNewsletterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    if (honeypot) {
      setIsLoading(false);
      setSuccessMessage("Thanks for subscribing.");
      return;
    }

    if (!turnstileToken) {
      // Arm + flag submit; the effect above runs the challenge once the widget
      // is mounted (covers the case where the user never focused the field).
      setTurnstileArmed(true);
      setShouldSubmit(true);
      return;
    }

    await processSubscription();
  };

  const shareUrl = SITE_URL;
  const shareText = "GrowQR: courses, exam prep, resume score and study abroad help for students";
  const enc = encodeURIComponent;
  const shares = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${shareText} ${shareUrl}`)}`, icon: <FaWhatsapp />, hover: "hover:bg-[#25D366]" },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(shareUrl)}`, icon: <FaXTwitter />, hover: "hover:bg-black" },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`, icon: <FaLinkedinIn />, hover: "hover:bg-[#0A66C2]" },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}`, icon: <FaFacebookF />, hover: "hover:bg-[#1877F2]" },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(shareText)}`, icon: <FaTelegram />, hover: "hover:bg-[#229ED9]" },
    { label: "Email", href: `mailto:?subject=${enc("Have a look at GrowQR")}&body=${enc(`${shareText}\n\n${shareUrl}`)}`, icon: <Mail />, hover: "hover:bg-orange" },
  ];
  const follow = [
    { label: "LinkedIn", href: "https://www.linkedin.com/company/growqr", icon: <FaLinkedin /> },
    { label: "X", href: "https://x.com/Growqr", icon: <FaXTwitter /> },
    { label: "Instagram", href: "https://www.instagram.com/growqr.ai", icon: <FaInstagram /> },
  ];

  const linkCls = "group inline-flex items-center gap-1.5 rounded text-[14px] text-white/70 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";
  const Col = ({ title, links }: { title: string; links: Array<{ href: string; label: string; tag?: string; external?: boolean }> }) => (
    <nav aria-label={title}>
      <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-orange">{title}</h3>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.href + l.label}>
            {l.external ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkCls}>{l.label}<span className="sr-only"> (opens in a new tab)</span></a>
            ) : (
              <Link href={l.href} className={linkCls}>
                {l.label}
                {l.tag ? <span className="rounded-full bg-orange/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange">{l.tag}</span> : null}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link", shareUrl);
    }
  };
  const nativeShare = () => { void navigator.share?.({ title: "GrowQR", text: shareText, url: shareUrl }).catch(() => undefined); };

  return (
    <footer id="company" className="relative overflow-hidden bg-ink text-white" aria-label="Site footer">
      {/* soft colour glows */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-orange/25 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-1/3 h-[480px] w-[480px] rounded-full bg-[#7c5cff]/25 blur-[130px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "26px 26px" }} />

      <div className="relative mx-auto max-w-[1340px] px-6 pb-8 pt-16 md:px-14 md:pt-20">
        {/* call to action */}
        <section aria-labelledby="footer-cta" className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange via-[#ff4d6d] to-[#7c5cff] p-8 shadow-[0_30px_80px_-30px_rgba(255,106,47,0.7)] md:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr,1fr]">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/80">Learn. Prove it. Get hired.</p>
              <h2 id="footer-cta" className="mt-3 text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-white">Your whole career, in one place.</h2>
              <p className="mt-3 max-w-[34em] text-[15.5px] leading-relaxed text-white/90">Courses, exam prep, a resume that scores well, a verified Skill Passport and a path to study abroad. Start free, no card needed.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/signup" className="inline-flex min-h-[50px] items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-ink transition hover:scale-[1.03] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Start free <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/pricing" className="inline-flex min-h-[50px] items-center rounded-full border border-white/70 px-6 text-[15px] font-bold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">See plans</Link>
                <Link href={RESUME_SCORE_URL} className="inline-flex min-h-[50px] items-center rounded-full px-4 text-[15px] font-semibold text-white underline underline-offset-4 hover:text-white/90">Score my resume</Link>
              </div>
            </div>
            <div aria-label="GrowQR apps">
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-white/80">{VERTICALS.length} apps. One account.</p>
              <ul className="grid grid-cols-2 gap-2.5">
                {VERTICALS.map((v) => (
                  <li key={v.key}>
                    <Link href={v.href} {...(v.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="group flex min-h-[56px] items-center gap-2.5 rounded-2xl bg-white/15 px-3 py-2.5 ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-orange"><v.icon className="h-[18px] w-[18px]" aria-hidden /></span>
                      <span className="text-[13px] font-semibold leading-tight text-white">{FOOTER_APP_NAME[v.key] ?? v.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* brand and the product columns */}
        <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-12">
          <div className="col-span-2 lg:col-span-4">
            <div className="inline-block rounded-2xl bg-white px-4 py-3"><Logo width={124} height={58} /></div>
            <p className="mt-5 max-w-[22em] text-[15px] leading-relaxed text-white/75">Learn the skills, prove them with a QR-verified Skill Passport, and get matched to internships, jobs and universities.</p>

            <form className="mt-6 w-full max-w-[360px]" onSubmit={handleNewsletterSubmit} aria-label="Join the GrowQR newsletter">
              <label htmlFor="footer-email" className="mb-2 block text-[13px] font-semibold text-white">Get tips, offers and new courses</label>
              <div className="flex items-center gap-2">
                <input
                  id="footer-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onFocus={() => setTurnstileArmed(true)}
                  placeholder="Your email"
                  required
                  disabled={isLoading}
                  className="h-11 w-full min-w-0 rounded-full border border-white/20 bg-white/10 px-4 text-[14px] text-white placeholder:text-white/50 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/40"
                />
                <input type="text" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <button type="submit" disabled={isLoading} className="h-11 shrink-0 rounded-full bg-orange px-5 text-[14px] font-bold text-white transition hover:bg-orange-dark disabled:opacity-60">
                  {isLoading ? "Joining..." : "Join"}
                </button>
              </div>
            </form>
            {turnstileArmed && (
              <TurnstileWidget
                ref={turnstileRef}
                className="mt-2"
                execution="execute"
                onVerify={(token) => setTurnstileToken(token)}
                onError={() => {
                  setErrorMessage("Security check failed. Please try again.");
                  setIsLoading(false);
                  setShouldSubmit(false);
                }}
              />
            )}
            <div aria-live="polite">
              {successMessage && <p className="mt-2 text-[13px] text-emerald-300">{successMessage}</p>}
              {errorMessage && <p className="mt-2 text-[13px] text-orange">{errorMessage}</p>}
            </div>

            <h3 className="mb-3 mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Follow GrowQR</h3>
            <ul className="flex flex-wrap gap-2.5">
              {follow.map((f) => (
                <li key={f.label}>
                  <a href={f.href} target="_blank" rel="noopener noreferrer" aria-label={`GrowQR on ${f.label} (opens in a new tab)`}
                    className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-[17px] text-white ring-1 ring-white/15 transition duration-300 hover:-translate-y-0.5 hover:bg-orange hover:ring-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange">{f.icon}</a>
                </li>
              ))}
              <li>
                <a href="mailto:support@growqr.ai?subject=GrowQR%20Enquiry" aria-label="Email GrowQR support"
                  className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-[17px] text-white ring-1 ring-white/15 transition duration-300 hover:-translate-y-0.5 hover:bg-orange hover:ring-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"><Mail className="h-[18px] w-[18px]" aria-hidden="true" /></a>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <Col title="Learn" links={[
              { href: "/courses", label: "All courses" },
              { href: "/math-speed", label: "Math Speed Enhancement Studio" },
              { href: "/reading-studio", label: "English Reading Studio" },
              { href: "/math-studio", label: "Mathematics Studio" },
              { href: "/vedic-math", label: "Vedic Mathematics" },
              { href: "/olympiad/imo", label: "Maths Olympiad (IMO)" },
              { href: "/exam-prep", label: "Exam prep (JEE, NEET, UPSC)" },
              { href: "/ielts", label: "IELTS practice" },
              { href: "/writing-clinic", label: "English Writing Studio (IELTS, SAT, GRE, GMAT)" },
              { href: CLASSROOM_URL, label: "Online classes", external: true },
            ]} />
          </div>
          <div className="lg:col-span-2">
            <Col title="Career" links={[
              { href: RESUME_SCORE_URL, label: "Free resume score" },
              { href: "/ai-resume-expert", label: "AI Resume Expert" },
              { href: "/ai-interviewer", label: "AI Interviewer" },
              { href: "/internships", label: "Internships" },
              { href: "/growqr-internship", label: "GrowQR Internship" },
              { href: "/ai-skill-trainer", label: "AI Skill Trainer" },
              { href: "/solutions/students", label: "For students" },
            ]} />
          </div>
          <div className="lg:col-span-2">
            <Col title="Go global" links={[
              { href: "/study-abroad", label: "Study abroad" },
              { href: "/universities", label: "Universities" },
              ...(isIndia ? [{ href: "/experts", label: "Experts" }, { href: "/events", label: "Events" }, { href: "/community", label: "Community" }] : []),
              { href: "/ambassadors", label: "Ambassadors" },
              { href: "/pricing", label: "Plans and pricing" },
            ]} />
          </div>
          <div className="lg:col-span-2">
            <Col title="Company" links={[
              { href: "/about", label: "About us" },
              { href: "/vision", label: "Vision" },
              { href: "/gallery", label: "Gallery" },
              { href: "/blog", label: "Blog" },
              { href: "/enterprise", label: "For enterprises" },
              { href: "/solutions/institutes", label: "For institutes" },
              { href: "/solutions/recruiters", label: "For recruiters" },
              { href: "/support", label: "Support" },
              { href: "/contact", label: "Contact us" },
              ...(pricingHref ? [{ href: pricingHref, label: "Pricing on this page" }] : []),
            ]} />
          </div>
        </div>

        {/* share */}
        <section aria-labelledby="footer-share" className="mt-14 flex flex-col items-start justify-between gap-5 rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 md:flex-row md:items-center md:p-7">
          <div>
            <h3 id="footer-share" className="text-[18px] font-bold text-white">Know someone who should try GrowQR?</h3>
            <p className="mt-1 text-[14px] text-white/70">Share it with your friends, classmates and family.</p>
          </div>
          <ul className="flex flex-wrap items-center gap-2.5">
            {shares.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Share GrowQR on ${s.label} (opens in a new tab)`}
                  className={`grid h-11 w-11 place-items-center rounded-full bg-white/10 text-[17px] text-white ring-1 ring-white/15 transition duration-300 hover:-translate-y-0.5 hover:ring-transparent ${s.hover} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange`}>{s.icon}</a>
              </li>
            ))}
            <li>
              <button type="button" onClick={copy} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-bold text-ink transition hover:bg-orange hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange">
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}{copied ? "Link copied" : "Copy link"}
              </button>
              <span className="sr-only" role="status">{copied ? "Link copied to the clipboard" : ""}</span>
            </li>
            {canNativeShare ? (
              <li><button type="button" onClick={nativeShare} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-4 text-[14px] font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"><Share2 className="h-4 w-4" aria-hidden="true" />Share</button></li>
            ) : null}
          </ul>
        </section>

        {/* offices */}
        <section aria-labelledby="footer-offices" className="mt-10">
          <h3 id="footer-offices" className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Our offices</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { city: "New Jersey, USA", addr: "103 Carnegie Center Drive, Princeton, NJ 08540", hq: true },
              { city: "Noida, India", addr: "4th Floor, Wesource Building, Sector 125, Noida, UP 201313", href: "https://share.google/OeH9CLBjeBa3VssRT" },
              { city: "Oslo, Norway", addr: "Odalsgata 42, 2003 Lillestrom" },
              { city: "St Julian's, Malta", addr: "Dragonara Business Centre, 5th Floor, Dragonara Road, St Julian's" },
            ].map((o) => {
              const body = (
                <>
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-white"><MapPin className="h-4 w-4 text-orange" aria-hidden="true" />{o.city}{o.hq ? <span className="rounded bg-orange px-1.5 py-0.5 text-[9px] font-extrabold text-white">HQ</span> : null}</span>
                  <span className="mt-1.5 block text-[12.5px] leading-relaxed text-white/60">{o.addr}</span>
                </>
              );
              return (
                <li key={o.city}>
                  {o.href ? <a href={o.href} target="_blank" rel="noopener noreferrer" className="block h-full rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange">{body}<span className="sr-only"> (opens in a new tab)</span></a>
                    : <div className="h-full rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">{body}</div>}
                </li>
              );
            })}
          </ul>
        </section>

        {/* The three legal links are ungated on purpose: the Privacy Policy covers global processing and has to be reachable from the newsletter field and for Meta and Google reviews; the Refund Policy must be visible to paying customers in every market. Do not hide them behind a country check. */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:flex-row">
          <p className="text-[12.5px] text-white/55">© {new Date().getFullYear()} GrowQR. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12.5px]">
            <Link href="/privacy-policy" className="text-white/65 hover:text-white">Privacy Policy</Link>
            <Link href="/refund-policy" className="text-white/65 hover:text-white">Refund Policy</Link>
            <Link href="/data-deletion" className="text-white/65 hover:text-white">Data Deletion</Link>
            <Link href="/editorial-policy" className="text-white/65 hover:text-white">Editorial Policy</Link>
          </nav>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-[12.5px] font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange">
            Back to top <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
