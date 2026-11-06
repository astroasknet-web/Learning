"use client";

import { useState } from "react";

/** Hero search: sends the query to the course catalogue (/courses?q=). */
export default function CourseSearch({ quick }: { quick: string[] }) {
  const [q, setQ] = useState("");
  const go = (term: string) => window.location.assign(`/courses${term.trim() ? `?q=${encodeURIComponent(term.trim())}` : ""}`);
  return (
    <>
      <form className="yl-search" role="search" onSubmit={(e) => { e.preventDefault(); go(q); }}>
        <label className="yl-field">
          <span className="vl-sr">What do you want to learn?</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to learn? Try Python, IELTS or Excel" autoComplete="off" />
        </label>
        <button type="submit" className="vl-btn vl-btn-primary">Search courses</button>
      </form>
      <p className="yl-quick">
        <span>Popular:</span>
        {quick.map((t) => (
          <a key={t} href={`/courses?q=${encodeURIComponent(t)}`}>{t}</a>
        ))}
      </p>
    </>
  );
}
