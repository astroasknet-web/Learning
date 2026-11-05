import type { Metadata } from "next";
import Link from "next/link";
import { MarketShell } from "@/components/market/shell";
import { curriculum } from "@/lib/lms/vedic";
import { courseFee } from "@/lib/pay/course-access";
import { formatMoney } from "@/lib/pay/money";

export const dynamic = "force-dynamic"; // the price comes from the shop

export const metadata: Metadata = {
  title: "Vedic Mathematics Course: 30 Modules, Module 1 Free | GrowQR",
  description: "A Vedic Mathematics course in 30 modules across three levels, with the 16 Sutras and 13 Sub-Sutras, theory, worked examples, practice and test banks, in English and Hindi.",
  alternates: { canonical: "/vedic-math" },
};

export default async function VedicHome() {
  const c = curriculum();
  const fee = await courseFee("vedic-mathematics").catch(() => null);
  return (
    <MarketShell user={null} active="courses">
      <h1 className="font-sans text-[clamp(1.8rem,4vw,2.6rem)] font-semibold text-ink">Vedic Mathematics</h1>
      <p className="mt-2 max-w-[46em] rounded-lg bg-cream-2 px-3 py-2 text-[14px] text-ink-2">Module 1 is free. The complete course comes with the <Link href="/pricing" className="font-semibold underline">Pro, Silver and Gold plans</Link>{fee ? <>, or you can <Link href="/checkout?sku=course-vedic-mathematics" className="font-semibold underline">buy it on its own for {formatMoney(fee.amountMinor, "INR").replace(/.00$/, "")}</Link></> : null}.</p>
      <p className="mt-2 max-w-[46em] text-ink-3">A course in {c.modules.length} modules across three levels: mental arithmetic, multiplication and division shortcuts, squares and roots, algebra, geometry, calculus and more. Every module has theory, worked examples, practice and a test bank, in English and Hindi.</p>

      {c.levels.map((l) => (
        <section key={l.n} className="mt-10" aria-label={`Level ${l.n}`}>
          <h2 className="text-[1.3rem] font-bold text-ink">{l.emoji} Level {l.n}: {l.name}</h2>
          <p className="text-[13.5px] text-ink-3">{l.tag} · {l.hours}</p>
          <p className="mt-1 max-w-3xl text-[14.5px] text-ink-3">{l.blurb}</p>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.modules.filter((m) => m.level === l.n).map((m) => (
              <li key={m.slug}>
                <Link href={`/vedic-math/${m.slug}`} className="block h-full rounded-xl border border-black/[0.08] bg-white p-4 transition hover:border-orange">
                  <span className="text-[12px] text-ink-4">Module {m.num}{m.hasHindi ? " · English and Hindi" : ""}</span>
                  <b className="mt-0.5 block text-[15px] text-ink">{m.title}</b>
                  <span className="mt-1 block text-[12.5px] text-orange-dark">{m.sutra}</span>
                  <span className="mt-1.5 block text-[12.5px] leading-snug text-ink-3">{m.topics.join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="mt-12" aria-label="The 16 Sutras">
        <h2 className="text-[1.3rem] font-bold text-ink">The 16 Sutras</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-black/[0.08] bg-white">
          <table className="w-full text-left text-[14px]"><thead className="bg-cream-2 text-ink-3"><tr><th className="p-2.5">#</th><th className="p-2.5">Sutra</th><th className="p-2.5">Meaning</th></tr></thead>
            <tbody>{c.sutras.map((s) => <tr key={s.n} className="border-t border-black/[0.06]"><td className="p-2.5 text-ink-4">{s.n}</td><td className="p-2.5"><b className="text-ink">{s.translit}</b>{s.sanskrit ? <span className="ml-2 text-ink-4">{s.sanskrit}</span> : null}</td><td className="p-2.5 text-ink-2">{s.meaning}</td></tr>)}</tbody></table>
        </div>
      </section>
      <section className="mt-8" aria-label="The 13 Sub-Sutras">
        <h2 className="text-[1.3rem] font-bold text-ink">The 13 Sub-Sutras</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{c.subSutras.map((s) => <li key={s.n} className="rounded-lg border border-black/[0.08] bg-white px-3 py-2 text-[14px]"><b className="text-ink">{s.n}. {s.translit}</b><span className="block text-ink-3">{s.meaning}</span></li>)}</ul>
      </section>
    </MarketShell>
  );
}
