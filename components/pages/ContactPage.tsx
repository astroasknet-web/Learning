"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Building2, Clock3, Loader2, Mail, MapPin, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { HumanCheck, type CaptchaInfo } from "@/components/portal/auth-controls";
import Reveal from "@/components/ui/Reveal";
import { formatPersonName } from "@/lib/format-person-name";
import { getAttributionPayload } from "@/lib/attribution";
import { trackGenerateLead, trackFormError } from "@/lib/analytics";

/** Only signed-in members can write to us: guests see a log-in prompt, members see the form with a human check. */
export default function ContactPage({ user, captcha }: { user: { name: string; email: string } | null; captcha: CaptchaInfo }) {
  const [formData, setFormData] = useState({ name: user?.name ?? "", email: user?.email ?? "", subject: "", message: "", type: "general" });
  const [humanOk, setHumanOk] = useState(captcha.mode === "off");
  const [checkKey, setCheckKey] = useState(0);
  const onReady = useCallback((ok: boolean) => setHumanOk(ok), []);
  const [honeypot, setHoneypot] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactInfo = [
    { icon: Mail, title: "Email", value: "support@growqr.ai", href: "mailto:support@growqr.ai" },
    { icon: Clock3, title: "Hours", value: "Mon - Fri, 9AM - 6PM IST", href: "#" },
    { icon: MapPin, title: "US Office", value: "Princeton, NJ", href: "#" },
    { icon: MapPin, title: "India Office", value: "Noida, India", href: "https://share.google/OeH9CLBjeBa3VssRT" },
  ];

  const inquiryTypes = [
    { value: "general", label: "General enquiry", icon: MessageSquare },
    { value: "sales", label: "Sales enquiry", icon: Building2 },
  ];

  // Clears the success banner once the visitor starts a new message, so the
  // form doesn't stay permanently locked after the first send (previously
  // required a page refresh to send a second enquiry).
  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (isSuccess) setIsSuccess(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      setError("Please fill in all required fields.");
      return;
    }

    if (honeypot) {
      setIsSuccess(true);
      return;
    }

    if (!humanOk) {
      setError("Please complete the security check.");
      return;
    }
    const fd = new FormData(event.currentTarget as HTMLFormElement);
    const check = Object.fromEntries(["captchaToken", "captcha", "cf-turnstile-response", "pow"].map((k) => [k, String(fd.get(k) ?? "")]));

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/send-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formatPersonName(formData.name),
          email: formData.email,
          subject: formData.subject || "General Inquiry",
          message: formData.message,
          type: formData.type,
          ...check,
          attribution: getAttributionPayload(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCheckKey((n) => n + 1);
        setError(res.status === 401 ? "Please log in to send us a message." : res.status === 403 ? "The security check was not right. Please try again with the new code." : typeof data.error === "string" && data.error ? data.error : "Something went wrong. Please try again.");
        return;
      }

      trackGenerateLead("contact");
      setIsSuccess(true);
      setFormData((prev) => ({ ...prev, subject: "", message: "", type: "general" }));
      setCheckKey((n) => n + 1);
    } catch (submitError) {
      console.error("Contact form error:", submitError);
      trackFormError("contact", "submit_failed");
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="relative overflow-hidden pt-32 md:pt-40 pb-14 md:pb-20 px-6 md:px-14">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(26,26,26,0.05),transparent_55%),linear-gradient(to_bottom,rgba(250,248,244,0.92),rgba(250,248,244,0))] pointer-events-none" />
        <div className="mx-auto max-w-[1280px] text-center relative z-10">
          <Reveal direction="left" offset={60}>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange/15 bg-orange/5 px-4 py-2 text-sm font-semibold text-orange-deep mb-6">
              Get in Touch
            </div>
            <h1 className="mx-auto max-w-[1100px] text-[40px] sm:text-[56px] md:text-[76px] font-medium leading-[0.95] tracking-[-0.04em] text-ink">
              Let&apos;s Build <span className="text-orange">Something Useful</span>.
            </h1>
          </Reveal>
        </div>
      </section>

      <section className="px-6 md:px-14 pb-16 md:pb-24">
        <div className="mx-auto max-w-[1280px] grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {contactInfo.map((info) => {
            const isLink = info.href !== "#";
            const Tag = isLink ? "a" : "div";
            return (
            <Tag key={info.title} {...(isLink ? { href: info.href } : {})} className={`flex items-center gap-4 rounded-2xl border border-black/8 bg-white p-4 md:p-5 shadow-[0_8px_20px_-12px_rgba(26,26,26,0.08)] ${isLink ? "hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-14px_rgba(26,26,26,0.12)]" : ""} transition-all duration-300`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-ink-2 border border-black/5">
                <info.icon className="h-5 w-5" />
              </div>
              <div className="text-[15px] md:text-[16px] font-medium text-ink leading-tight break-all md:break-normal">{info.value}</div>
            </Tag>
            );
          })}
        </div>
      </section>

      <section className="px-6 md:px-14 pb-20 md:pb-28">
        <div className="mx-auto max-w-[860px] rounded-[30px] border border-black/8 bg-white p-5 md:p-8 shadow-[0_22px_60px_-36px_rgba(26,26,26,0.15)]">
          <div className="mb-7 text-center">
            <h2 className="text-3xl md:text-[44px] font-medium tracking-[-0.03em] text-ink">Send Us a <span className="text-orange">Message</span></h2>
            <p className="mt-3 text-sm md:text-base text-ink-4">Use the form below for general questions, sales enquiries, or partnership requests.</p>
          </div>

          {!user ? (
            <div className="rounded-[24px] border border-black/8 bg-cream p-6 text-center md:p-10">
              <p className="text-[17px] font-semibold text-ink">Log in to send us a message</p>
              <p className="mx-auto mt-2 max-w-[34em] text-[15px] text-ink-3">To keep our inbox free of spam, messages can only be sent by registered members. It takes a minute to sign up, and it is free.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/login?next=%2Fcontact" className="inline-flex min-h-[48px] items-center rounded-full bg-orange px-6 text-[15px] font-semibold text-white hover:bg-orange-dark">Log in</Link>
                <Link href="/signup" className="inline-flex min-h-[48px] items-center rounded-full border border-black/15 px-6 text-[15px] font-semibold text-ink hover:bg-white">Create a free account</Link>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-[24px] bg-cream p-4 md:p-7 border border-black/8">
              <div className="flex flex-wrap gap-3">
              {inquiryTypes.map((typeOption) => {
                const ActiveIcon = typeOption.icon;
                const selected = formData.type === typeOption.value;
                return (
                  <button key={typeOption.value} type="button" onClick={() => updateField("type", typeOption.value)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${selected ? "bg-white text-orange-deep border border-orange/35 shadow-[0_10px_20px_-16px_rgba(255,106,47,0.45)]" : "bg-white text-ink-3 border border-black/8 hover:bg-black/[0.03]"}`}>
                    <ActiveIcon className="h-4 w-4" />
                    {typeOption.label}
                  </button>
                );
              })}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink-2">Your name <span className="text-ink-4">*</span></span>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    autoCapitalize="words"
                    value={formData.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    onBlur={() => updateField("name", formatPersonName(formData.name))}
                    className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 capitalize text-ink outline-none transition focus:border-orange/40 focus:bg-white"
                    placeholder="John Doe"
                    readOnly
                    required
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink-2">Email address <span className="text-ink-4">*</span></span>
                  <input type="email" readOnly value={formData.email} onChange={(event) => updateField("email", event.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-orange/40 focus:bg-white" placeholder="john@email.com" required />
                </label>
              </div>

              <label className="space-y-2 block">
                <span className="text-sm font-medium text-ink-2">Subject</span>
                <input type="text" value={formData.subject} onChange={(event) => updateField("subject", event.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-orange/40 focus:bg-white" placeholder="How can we help?" />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm font-medium text-ink-2">Your message <span className="text-ink-4">*</span></span>
                <textarea value={formData.message} onChange={(event) => updateField("message", event.target.value)} rows={6} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-orange/40 focus:bg-white resize-none" placeholder="Tell us a little about your project, team, or question." required />
              </label>

              <input type="text" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

              <HumanCheck captcha={captcha} onReady={onReady} resetKey={checkKey} />

              {error ? <div className="rounded-2xl border border-orange/30 bg-orange/10 px-4 py-3 text-sm text-orange-deep">{error}</div> : null}
              {isSuccess ? <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Message sent successfully.</div> : null}

              <button type="submit" disabled={isSubmitting} className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-orange/60 bg-transparent px-6 py-4 text-sm font-semibold text-orange-deep transition hover:bg-orange/5 disabled:cursor-not-allowed disabled:opacity-60 mt-1">
                {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" />Sending...</> : <><Send className="h-5 w-5" />Send message</>}
              </button>

              
            </form>
          )}
        </div>
      </section>
    </>
  );
}
