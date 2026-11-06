import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "./Mark";

const LINKS: [string, string][] = [["courses", "Courses"], ["paths", "Career paths"], ["studios", "Studios & classes"], ["exams", "Exams"], ["faq", "FAQ"]];

export function Nav() {
  return (
    <header className="dv-nav">
      <div className="dv-nav-in">
        <Link href="/" className="dv-brand" aria-label="YugtyLearning home">
          <Mark size={28} />
          <span>YUGTY</span>
          <b>LEARNING</b>
        </Link>
        <nav className="dv-links" aria-label="Sections">
          {LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
        <Link className="vl-btn vl-btn-ghost vl-btn-sm yl-signin" href="/login">Sign in</Link>
        <Link className="vl-btn vl-btn-primary vl-btn-sm dv-cta" href="/courses">Start learning</Link>
        <details className="dv-menu">
          <summary aria-label="Menu"><span /><span /></summary>
          <div className="dv-menu-panel">
            {LINKS.map(([id, label]) => (
              <a key={id} href={`#${id}`}>{label}</a>
            ))}
            <hr />
            <Link href="/my-courses">My courses</Link>
            <Link href="/my-classes">My classes</Link>
            <Link href="/pricing">Plans</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Create a free account</Link>
          </div>
        </details>
      </div>
    </header>
  );
}

export function SectionHead({ kicker, title, text }: { kicker: string; title: ReactNode; text?: string }) {
  return (
    <div className="dv-head dv-rv">
      <p className="vl-kicker">{kicker}</p>
      <h2 className="vl-h2">{title}</h2>
      {text ? <p className="vl-sublead">{text}</p> : null}
    </div>
  );
}

export function Faq({ items }: { items: [string, string][] }) {
  return (
    <div className="dv-faq">
      {items.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}

export function Ticker({ items }: { items: string[] }) {
  const row = (p: string) => items.map((t, i) => <span key={p + i}><i aria-hidden="true" />{t}</span>);
  return (
    <div className="vl-ticker" role="group" aria-label="What you can learn on YugtyLearning">
      <div className="vl-ticker-track">
        {row("a")}
        <div style={{ display: "contents" }} aria-hidden="true">{row("b")}</div>
      </div>
    </div>
  );
}
