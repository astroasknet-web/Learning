import glyphs from "@/lib/market/data/course-glyphs.json";
import { thumbSpec, type ThumbSpec } from "@/lib/market/thumb";

/** A course's own cover: category colours, its subject glyph, and a pattern chosen from its slug (see lib/market/thumb.ts). Decorative: the title sits right next to it. */
export function CourseThumb({ course, className = "" }: { course: { slug: string; icon: string; c1: string; c2: string }; className?: string }) {
  const s: ThumbSpec = thumbSpec(course.slug, course.icon, course.c1, course.c2);
  const gid = `g-${course.slug}`;
  const glyph = (glyphs as Record<string, string>)[course.icon] ?? (glyphs as Record<string, string>).sparkles;
  const gx = s.side === "left" ? 28 : 228;
  const stroke = "#fff";
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={`block w-full h-full ${className}`}>
      <defs>
        <linearGradient id={gid} gradientTransform={`rotate(${s.angle} .5 .5)`}>
          <stop offset="0" stopColor={s.from} />
          <stop offset="1" stopColor={s.to} />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx={s.side === "left" ? "0.25" : "0.75"} cy="0.45" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${gid})`} />
      <g fill="none" stroke="#fff" strokeWidth="2">
        {s.pattern === "rings" ? s.shapes.map((p, i) => <circle key={i} cx={s.side === "left" ? 300 : 20} cy={150} r={40 + i * 34} strokeOpacity={0.2 - i * 0.04} />) : null}
        {s.pattern === "stripes" ? s.shapes.map((p, i) => <line key={i} x1={-20 + i * 62} y1={190} x2={80 + i * 62} y2={-10} strokeOpacity={p.o + 0.04} strokeWidth={6 + (i % 3) * 4} />) : null}
        {s.pattern === "waves" ? s.shapes.slice(0, 4).map((p, i) => <path key={i} d={`M-10 ${60 + i * 34} Q 80 ${20 + i * 34 + p.r / 2} 160 ${60 + i * 34} T 330 ${60 + i * 34}`} strokeOpacity={0.16 + i * 0.03} />) : null}
      </g>
      {s.pattern === "dots" ? <g fill="#fff">{Array.from({ length: 8 * 4 }, (_, i) => <circle key={i} cx={30 + (i % 8) * 38 + (s.shapes[0].x % 12)} cy={30 + Math.floor(i / 8) * 40 + (s.shapes[0].y % 10)} r="2.4" fillOpacity={0.28} />)}</g> : null}
      {s.pattern === "bubbles" ? <g fill="#fff">{s.shapes.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fillOpacity={p.o} />)}</g> : null}
      {s.pattern === "blocks" ? <g fill="#fff">{s.shapes.map((p, i) => <rect key={i} x={p.x - p.r} y={p.y - p.r} width={p.r * 1.6} height={p.r * 1.6} rx="8" transform={`rotate(${p.rot} ${p.x} ${p.y})`} fillOpacity={p.o} />)}</g> : null}
      <rect width="320" height="180" fill={`url(#${gid}-glow)`} />
      <g transform={`translate(${gx} 42)`}>
        <rect width="64" height="64" rx="16" fill="#fff" fillOpacity="0.16" stroke="#fff" strokeOpacity="0.35" />
        <g transform="translate(10 10) scale(1.83)" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: glyph }} />
      </g>
    </svg>
  );
}
