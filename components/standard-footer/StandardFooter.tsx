"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaTelegram, FaWhatsapp, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { ArrowRight, ArrowUp, Check, Link2, Mail, MapPin, Share2 } from "lucide-react";
import Icon from "./Icon";
import { STANDARD_LEGAL, STANDARD_OFFICES } from "./defaults";
import type { FooterColumn, FooterConfig } from "./types";

const SOCIAL_ICON = { linkedin: <FaLinkedinIn />, x: <FaXTwitter />, instagram: <FaInstagram />, youtube: <FaYoutube />, facebook: <FaFacebookF /> };

const linkCls = "group inline-flex items-center gap-1.5 rounded py-0.5 text-[15px] font-medium leading-6 tracking-[0.005em] text-white/75 underline decoration-transparent decoration-1 underline-offset-[6px] transition-all duration-200 ease-out hover:text-white hover:decoration-orange/70 [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";
const roundBtn = "grid h-11 w-11 place-items-center rounded-full bg-white/10 text-[17px] text-white ring-1 ring-white/15 transition duration-300 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange";

function Col({ col }: { col: FooterColumn }) {
  return (
    <nav aria-label={col.title}>
      <h3 className="mb-5 border-b border-white/10 pb-3 text-[17px] font-semibold leading-6 tracking-[0.005em] text-orange sm:text-[18px]">{col.title}</h3>
      <ul className="space-y-3.5">
        {col.links.map((l) => (
          <li key={l.href + l.label}>
            {l.external ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer" className={linkCls}>
                {l.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
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
}

/**
 * The standard footer of every Yugty web application: a call-to-action panel with the app family, the brand with newsletter and social links,
 * four link columns, a share card, the company offices and a legal bar. Only the config differs between apps.
 */
export default function StandardFooter({ config }: { config: FooterConfig }) {
  const { brand, cta, apps, newsletter, columns, social, share, supportEmail } = config;
  const offices = config.offices ?? STANDARD_OFFICES;
  const legal = config.legal ?? STANDARD_LEGAL;
  const shownApps = apps.filter((a) => a.href);
  const showApps = shownApps.length >= 2;

  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (honeypot) return setOk("Thanks for subscribing.");
    if (!email) return setErr("Please enter your email.");
    setBusy(true);
    try {
      const r = await fetch(newsletter.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "newsletter", email, source: newsletter.source }) });
      const j = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!r.ok) throw new Error(j.message || j.error || "Could not subscribe. Please try again.");
      setOk("Thanks for subscribing.");
      setEmail("");
      setTimeout(() => setOk(null), 5000);
    } catch (x) {
      setErr((x as Error).message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const enc = encodeURIComponent;
  const url = config.siteUrl;
  const shares = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${share.text} ${url}`)}`, icon: <FaWhatsapp />, hover: "hover:bg-[#25D366]" },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${enc(share.text)}&url=${enc(url)}`, icon: <FaXTwitter />, hover: "hover:bg-black" },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, icon: <FaLinkedinIn />, hover: "hover:bg-[#0A66C2]" },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, icon: <FaFacebookF />, hover: "hover:bg-[#1877F2]" },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(share.text)}`, icon: <FaTelegram />, hover: "hover:bg-[#229ED9]" },
    { label: "Email", href: `mailto:?subject=${enc(share.subject)}&body=${enc(`${share.text}\n\n${url}`)}`, icon: <Mail />, hover: "hover:bg-orange" },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <footer id="company" className="relative overflow-hidden bg-ink text-white antialiased [font-family:var(--font-footer),system-ui,sans-serif]" aria-label="Site footer">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-orange/25 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-1/3 h-[480px] w-[480px] rounded-full bg-[#7c5cff]/25 blur-[130px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "26px 26px" }} />

      <div className="relative mx-auto max-w-[1340px] px-6 pb-8 pt-16 md:px-14 md:pt-20">
        {/* call to action */}
        <section aria-labelledby="footer-cta" className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange via-[#ff4d6d] to-[#7c5cff] p-8 shadow-[0_30px_80px_-30px_rgba(255,106,47,0.7)] md:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
          <div className={`relative grid items-center gap-8 ${showApps ? "lg:grid-cols-[1.4fr,1fr]" : ""}`}>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/85">{cta.eyebrow}</p>
              <h2 id="footer-cta" className="mt-3 text-[clamp(1.6rem,3.2vw,2.4rem)] font-semibold leading-[1.15] tracking-[-0.015em] text-white">{cta.title}</h2>
              <p className="mt-3 max-w-[34em] text-[15px] leading-7 text-white/90 sm:text-[16px]">{cta.text}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={cta.primary.href} className="inline-flex min-h-[50px] items-center gap-2 rounded-full bg-white px-6 text-[15px] font-bold text-ink transition hover:scale-[1.03] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  {cta.primary.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href={cta.secondary.href} className="inline-flex min-h-[50px] items-center rounded-full border border-white/70 px-6 text-[15px] font-bold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  {cta.secondary.label}
                </Link>
                {cta.tertiary ? (
                  <Link href={cta.tertiary.href} className="inline-flex min-h-[50px] items-center rounded-full px-4 text-[15px] font-semibold text-white underline underline-offset-4 hover:text-white/90">
                    {cta.tertiary.label}
                  </Link>
                ) : null}
              </div>
            </div>
            {showApps ? (
              <div aria-label={`${brand.name} apps`}>
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/85">{config.appsTitle}</p>
                <ul className="grid grid-cols-2 gap-2.5">
                  {shownApps.map((a) => (
                    <li key={a.key}>
                      <Link href={a.href} {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="group flex min-h-[56px] items-center gap-2.5 rounded-2xl bg-white/15 px-3 py-2.5 ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-orange"><Icon name={a.icon} size={18} /></span>
                        <span className="text-[14px] font-semibold leading-tight text-white">{a.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* brand and the link columns */}
        <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-12">
          <div className="col-span-2 lg:col-span-4">
            <div className="inline-block rounded-2xl bg-white px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={brand.logoSrc} alt={brand.logoAlt} className="h-10 w-auto" />
            </div>
            <p className="mt-5 max-w-[22em] text-[15px] leading-7 text-white/75">{brand.tagline}</p>

            <form className="mt-6 w-full max-w-[360px]" onSubmit={subscribe} aria-label={`Join the ${brand.name} newsletter`}>
              <label htmlFor="footer-email" className="mb-2 block text-[14px] font-semibold text-white">{newsletter.label}</label>
              <div className="flex items-center gap-2">
                <input id="footer-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" required maxLength={190} disabled={busy} autoComplete="email"
                  className="h-11 w-full min-w-0 rounded-full border border-white/20 bg-white/10 px-4 text-[14px] text-white placeholder:text-white/50 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/40" />
                <input type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
                <button type="submit" disabled={busy} className="h-11 shrink-0 rounded-full bg-orange px-5 text-[14px] font-bold text-white transition hover:bg-orange-dark disabled:opacity-60">
                  {busy ? "Joining..." : newsletter.button}
                </button>
              </div>
            </form>
            <div aria-live="polite">
              {ok && <p className="mt-2 text-[13px] leading-5 text-emerald-300">{ok}</p>}
              {err && <p className="mt-2 text-[13px] text-orange">{err}</p>}
            </div>

            <h3 className="mb-3 mt-8 text-[17px] font-semibold leading-6 tracking-[0.005em] text-orange sm:text-[18px]">Follow {brand.name}</h3>
            <ul className="flex flex-wrap gap-2.5">
              {social.filter((s) => s.href).map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`${brand.name} on ${s.label} (opens in a new tab)`} className={`${roundBtn} hover:bg-orange hover:ring-orange`}>
                    {SOCIAL_ICON[s.icon]}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${supportEmail}?subject=${enc(`${brand.name} Enquiry`)}`} aria-label={`Email ${brand.name} support`} className={`${roundBtn} hover:bg-orange hover:ring-orange`}>
                  <Mail className="h-[18px] w-[18px]" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>

          {columns.map((c) => (
            <div key={c.title} className="lg:col-span-2">
              <Col col={c} />
            </div>
          ))}
        </div>

        {/* share */}
        <section aria-labelledby="footer-share" className="mt-14 flex flex-col items-start justify-between gap-5 rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 md:flex-row md:items-center md:p-7">
          <div>
            <h3 id="footer-share" className="text-[18px] font-semibold leading-snug tracking-[-0.01em] text-white">{share.title}</h3>
            <p className="mt-1 text-[14px] leading-6 text-white/75">Share it with your friends, classmates and family.</p>
          </div>
          <ul className="flex flex-wrap items-center gap-2.5">
            {shares.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={`Share ${brand.name} on ${s.label} (opens in a new tab)`} className={`${roundBtn} hover:ring-transparent ${s.hover}`}>{s.icon}</a>
              </li>
            ))}
            <li>
              <button type="button" onClick={copy} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-ink transition hover:bg-orange hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange">
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Link copied" : "Copy link"}
              </button>
              <span className="sr-only" role="status">{copied ? "Link copied to the clipboard" : ""}</span>
            </li>
            {canNativeShare ? (
              <li>
                <button type="button" onClick={() => void navigator.share?.({ title: brand.name, text: share.text, url }).catch(() => undefined)} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/30 px-4 text-[14px] font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange">
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                  Share
                </button>
              </li>
            ) : null}
          </ul>
        </section>

        {/* offices */}
        <section aria-labelledby="footer-offices" className="mt-10">
          <h3 id="footer-offices" className="mb-4 text-[17px] font-semibold leading-6 tracking-[0.005em] text-orange sm:text-[18px]">Our offices</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {offices.map((o) => {
              const body = (
                <>
                  <span className="flex items-center gap-2 text-[15px] font-semibold leading-6 text-white">
                    <MapPin className="h-4 w-4 text-orange" aria-hidden="true" />
                    {o.city}
                    {o.hq ? <span className="rounded bg-orange px-1.5 py-0.5 text-[9px] font-extrabold text-white">HQ</span> : null}
                  </span>
                  <span className="mt-1.5 block text-[14px] leading-6 text-white/70">{o.addr}</span>
                </>
              );
              return (
                <li key={o.city}>
                  {o.href ? (
                    <a href={o.href} target="_blank" rel="noopener noreferrer" className="block h-full rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.09] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange">
                      {body}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <div className="h-full rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* legal bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-6 md:flex-row">
          <p className="text-[13px] leading-6 text-white/70">© {new Date().getFullYear()} {brand.name}. All rights reserved.</p>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] font-medium">
            {legal.map((l) => (
              <Link key={l.href} href={l.href} className="text-white/75 hover:text-white">{l.label}</Link>
            ))}
          </nav>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-[12.5px] font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange">
            Back to top <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
