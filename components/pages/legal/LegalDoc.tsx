import Link from "next/link";
import Reveal from "@/components/ui/Reveal";

/**
 * LegalDoc — shared shell for the legal pages (privacy policy, refund policy).
 * Each page supplies its header copy and a list of numbered sections; the
 * blocks below cover the shapes those documents actually use.
 */

export type ListItem = string | { term: string; text: string };

export type Block =
  | { type: "para"; text: string }
  | { type: "list"; items: ListItem[] }
  | { type: "contact"; prefix: string; suffix?: string }
  | { type: "link"; prefix: string; href: string; label: string; suffix?: string }
  | { type: "details"; rows: { label: string; value: string; email?: boolean }[] };

export type Section = { id: string; title: string; blocks: Block[] };

const SUPPORT_EMAIL = "support@growqr.ai";

const linkClass =
  "font-semibold text-orange-deep underline decoration-orange/30 underline-offset-2 hover:decoration-orange";

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === "para") {
          return (
            <p key={i} className="text-[15px] md:text-base leading-[1.75] text-ink-3">
              {block.text}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="space-y-3">
              {block.items.map((item) => {
                const key = typeof item === "string" ? item : item.term;
                return (
                  <li key={key} className="flex items-start gap-3 text-[15px] md:text-base leading-[1.7] text-ink-3">
                    <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange/70" />
                    {typeof item === "string" ? (
                      <span>{item}</span>
                    ) : (
                      <span>
                        <span className="font-semibold text-ink">{item.term}:</span> {item.text}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          );
        }
        if (block.type === "link") {
          return (
            <p key={i} className="text-[15px] md:text-base leading-[1.75] text-ink-3">
              {block.prefix}{" "}
              <Link href={block.href} className={linkClass}>
                {block.label}
              </Link>
              {block.suffix}
            </p>
          );
        }
        if (block.type === "details") {
          return (
            <dl key={i} className="space-y-4">
              {block.rows.map((row) => (
                <div key={row.label} className="sm:flex sm:gap-6">
                  <dt className="text-[15px] md:text-base font-semibold leading-[1.7] text-ink sm:w-44 sm:shrink-0">
                    {row.label}
                  </dt>
                  <dd className="text-[15px] md:text-base leading-[1.7] text-ink-3">
                    {row.email ? (
                      <a href={`mailto:${row.value}`} className={linkClass}>
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          );
        }
        return (
          <p key={i} className="text-[15px] md:text-base leading-[1.75] text-ink-3">
            {block.prefix}{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
              {SUPPORT_EMAIL}
            </a>
            {block.suffix}
          </p>
        );
      })}
    </>
  );
}

type LegalDocProps = {
  title: string;
  intro: string;
  lastUpdated: string;
  governingLaw: string;
  sections: Section[];
};

export default function LegalDoc({ title, intro, lastUpdated, governingLaw, sections }: LegalDocProps) {
  return (
    <>
      {/* Header */}
      <section className="border-b border-black/[0.07] pt-32 md:pt-40 pb-12 md:pb-16 px-6 md:px-14">
        <div className="mx-auto max-w-[760px]">
          <Reveal direction="up" offset={40}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-deep">
              Legal
            </p>
            <h1 className="mt-4 text-[34px] sm:text-[44px] md:text-[52px] font-medium leading-[1.05] tracking-[-0.03em] text-ink">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] md:text-base leading-relaxed text-ink-3">
              {intro}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-4">
              <span>
                <span className="text-ink-4">Last updated:</span>{" "}
                <span className="font-medium text-ink-3">{lastUpdated}</span>
              </span>
              <span className="hidden h-3.5 w-px bg-black/10 sm:inline-block" />
              <span>
                <span className="text-ink-4">Governing law:</span>{" "}
                <span className="font-medium text-ink-3">{governingLaw}</span>
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Body */}
      <section className="px-6 md:px-14 py-14 md:py-20">
        <div className="mx-auto max-w-[760px] divide-y divide-black/[0.07]">
          {sections.map((section, index) => (
            <article key={section.id} id={section.id} className="scroll-mt-28 py-10 first:pt-0">
              <div className="mb-4 flex items-baseline gap-3.5">
                <span className="tabular-nums text-xl md:text-2xl font-semibold leading-none text-orange-deep">
                  {index + 1}
                </span>
                <h2 className="text-xl md:text-[26px] font-medium tracking-[-0.01em] text-ink">
                  {section.title}
                </h2>
              </div>
              <div className="space-y-4">
                <Blocks blocks={section.blocks} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
