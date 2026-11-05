import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { hasPurchasedCourse, planInfo } from "@/lib/pay/plans";
import { buyHref, courseFee } from "@/lib/pay/course-access";
import { formatMoney } from "@/lib/pay/money";
import { MarketShell } from "@/components/market/shell";
import { adjacent, curriculum, moduleHtml, vmodule } from "@/lib/lms/vedic";

type P = { params: Promise<{ module: string }>; searchParams: Promise<{ lang?: string }> };
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]/g, "");

// Module 1 is free; the rest open with a Pro, Silver or Gold plan, or after buying the course, so the page is rendered per visitor.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const m = vmodule(clean((await params).module));
  if (!m) return { title: "Module not found | GrowQR", robots: { index: false, follow: true } };
  return { title: `${m.title}: Vedic Mathematics Module ${m.num} | GrowQR`, description: `Vedic Mathematics Module ${m.num}: ${m.title}. ${m.topics.join(", ")}.`.slice(0, 160), alternates: { canonical: `/vedic-math/${m.slug}` } };
}

export default async function VedicModule({ params, searchParams }: P) {
  const m = vmodule(clean((await params).module));
  if (!m) notFound();
  const me = await currentUser();
  const plan = me ? await planInfo(me.id) : null;
  const bought = me ? await hasPurchasedCourse(me.id, "vedic-mathematics") : false;
  const fee = await courseFee("vedic-mathematics").catch(() => null);
  const open = m.num === 1 || plan !== null || bought;
  const wantHindi = (await searchParams).lang === "hi" && m.hasHindi;
  const lang = wantHindi ? "hi" : "en";
  const body = open ? (moduleHtml(m.slug, lang) ?? moduleHtml(m.slug, "en")) : { html: "", toc: [] as Array<{ id: string; text: string; level: number }> };
  if (!body) notFound();
  const { prev, next } = adjacent(m.num);
  const toc = body.toc;
  const tab = (active: boolean) => `inline-flex min-h-[40px] items-center rounded-full px-4 text-[14px] font-semibold ${active ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-black/10"}`;
  return (
    <MarketShell user={null} active="courses">
      <nav aria-label="Breadcrumb" className="mb-4 text-[13px] text-ink-3"><Link href="/vedic-math" className="underline">Vedic Mathematics</Link> / Module {m.num}</nav>
      <p className="text-[0.74rem] font-bold uppercase tracking-wider text-orange-dark">Level {m.level} · Module {m.num} · {m.sutra}</p>
      <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink sm:text-[34px]">{m.title}</h1>
      {m.hasHindi ? (
        <div role="group" aria-label="Language" className="mt-4 flex gap-2">
          <Link href={`/vedic-math/${m.slug}`} aria-current={lang === "en" ? "true" : undefined} className={tab(lang === "en")}>English</Link>
          <Link href={`/vedic-math/${m.slug}?lang=hi`} aria-current={lang === "hi" ? "true" : undefined} className={tab(lang === "hi")} lang="hi">हिन्दी</Link>
        </div>
      ) : null}

      {!open ? (
        <section aria-label="This module is part of a plan" className="mt-6 rounded-2xl border border-black/[0.1] bg-white p-6 shadow-card sm:p-8">
          <h2 className="text-[20px] font-bold text-ink">What is in this module</h2>
          <p className="mt-2 text-ink-3">{m.topics.join(" · ")}</p>
          <p className="mt-1 text-[14px] text-ink-3">Sutra: {m.sutra}</p>
          <div className="mt-6 rounded-xl bg-cream-2 p-5">
            <p className="font-semibold text-ink">Module 1 is free. The full Vedic Mathematics course (all 30 modules) comes with Pro, Silver and Gold{fee ? `, or you can buy it on its own for ${formatMoney(fee.amountMinor, "INR").replace(/.00$/, "")}` : ""}.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {fee ? <Link href={me ? buyHref("vedic-mathematics") : `/login?next=${encodeURIComponent(buyHref("vedic-mathematics"))}`} className="inline-flex min-h-[48px] items-center rounded-lg bg-orange-deep px-6 font-semibold text-white hover:bg-ink">Buy the course · {formatMoney(fee.amountMinor, "INR").replace(/.00$/, "")}</Link> : null}
              <Link href="/pricing" className="inline-flex min-h-[48px] items-center rounded-lg border border-black/[0.15] px-6 font-semibold text-ink hover:bg-cream-2">See plans</Link>
              <Link href="/vedic-math/module-1" className="inline-flex min-h-[48px] items-center rounded-lg border border-black/[0.15] px-6 font-semibold text-ink hover:bg-cream-2">Start the free module 1</Link>
              {!me ? <Link href={`/login?next=${encodeURIComponent(`/vedic-math/${m.slug}`)}`} className="inline-flex min-h-[48px] items-center rounded-lg border border-black/[0.15] px-6 font-semibold text-ink hover:bg-cream-2">Log in</Link> : null}
            </div>
          </div>
        </section>
      ) : null}
      <div className={`mt-6 grid items-start gap-6 lg:grid-cols-[16rem_1fr] ${open ? "" : "hidden"}`}>
        <aside aria-label="Contents" className="max-h-[75vh] overflow-y-auto rounded-2xl border border-black/[0.08] bg-white p-4 text-[13.5px] lg:sticky lg:top-24">
          <h2 className="text-[14px] font-bold text-ink">Contents</h2>
          <ul className="mt-2 space-y-1.5">{toc.map((h) => <li key={h.id} className={h.level === 1 ? "font-semibold" : "pl-3"}><a href={`#${h.id}`} className="text-ink-3 hover:text-orange-deep hover:underline">{h.text}</a></li>)}</ul>
        </aside>
        <article lang={lang} className="vedic-prose min-w-0 rounded-2xl border border-black/[0.08] bg-white p-5 shadow-card sm:p-8 text-[15.5px] leading-relaxed text-ink-2 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-orange [&_blockquote]:bg-orange-lighter [&_blockquote]:px-4 [&_blockquote]:py-2 [&_code]:rounded [&_code]:bg-cream-2 [&_code]:px-1 [&_h1]:mt-10 [&_h1]:scroll-mt-24 [&_h1]:text-[26px] [&_h1]:font-bold [&_h1]:text-ink [&_h2]:mt-8 [&_h2]:scroll-mt-24 [&_h2]:text-[21px] [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-[17px] [&_h3]:font-semibold [&_h3]:text-ink [&_hr]:my-6 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-cream-2 [&_pre]:p-3 [&_strong]:text-ink [&_table]:my-4 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-cream-2 [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: body.html }} />
      </div>

      <nav aria-label="Modules" className="mt-8 flex flex-wrap justify-between gap-3 border-t border-black/10 pt-5 text-[14px]">
        {prev ? <Link href={`/vedic-math/${prev.slug}${lang === "hi" && prev.hasHindi ? "?lang=hi" : ""}`} className="font-semibold text-orange-deep underline">← Module {prev.num}: {prev.title}</Link> : <span />}
        {next ? <Link href={`/vedic-math/${next.slug}${lang === "hi" && next.hasHindi ? "?lang=hi" : ""}`} className="font-semibold text-orange-deep underline">Module {next.num}: {next.title} →</Link> : null}
      </nav>
    </MarketShell>
  );
}
