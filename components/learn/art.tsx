/** Small illustrations for the learning pages: skill icons and a hero picture of the three playgrounds. Decorative SVG, no image files. */
const P: Record<string, string> = {
  computer: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  word: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  slides: '<path d="M2 3h20M4 3v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3M12 16v5M9 21h6"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  safety: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.5 1.5A3.5 3.5 0 0 1 17.5 18z"/>',
  ai: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  sort: '<path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3"/>',
};
export function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className} dangerouslySetInnerHTML={{ __html: P[name] ?? P.sparkles ?? P.computer }} />;
}

/** Three overlapping windows (document, spreadsheet, presentation) on a soft background: the three things this course teaches by doing. */
export function HeroArt() {
  return (
    <svg viewBox="0 0 520 360" role="img" aria-label="Illustration of a document, a spreadsheet with a chart and a slide, side by side" className="h-auto w-full">
      <defs>
        <linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff1e8" /><stop offset="1" stopColor="#ffd9c2" /></linearGradient>
        <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#7c2d12" floodOpacity="0.18" /></filter>
      </defs>
      <rect width="520" height="360" rx="28" fill="url(#hg)" />
      <circle cx="450" cy="60" r="60" fill="#fff" opacity="0.5" />
      <g filter="url(#sh)">
        <rect x="28" y="52" width="190" height="246" rx="10" fill="#fff" />
        <rect x="28" y="52" width="190" height="24" rx="10" fill="#2b579a" /><rect x="28" y="66" width="190" height="10" fill="#2b579a" />
        <rect x="46" y="94" width="110" height="10" rx="3" fill="#14213d" />
        <g fill="#cbd5e1"><rect x="46" y="116" width="150" height="6" rx="3" /><rect x="46" y="130" width="140" height="6" rx="3" /><rect x="46" y="144" width="150" height="6" rx="3" /></g>
        <rect x="46" y="166" width="70" height="8" rx="3" fill="#2b579a" opacity="0.8" />
        <g fill="#94a3b8"><circle cx="52" cy="190" r="3" /><rect x="62" y="187" width="100" height="6" rx="3" /><circle cx="52" cy="204" r="3" /><rect x="62" y="201" width="86" height="6" rx="3" /><circle cx="52" cy="218" r="3" /><rect x="62" y="215" width="94" height="6" rx="3" /></g>
        <rect x="46" y="238" width="150" height="40" rx="3" fill="none" stroke="#94a3b8" /><path d="M46 252h150M46 265h150M96 238v40M146 238v40" stroke="#cbd5e1" />
      </g>
      <g filter="url(#sh)">
        <rect x="176" y="110" width="210" height="196" rx="10" fill="#fff" />
        <rect x="176" y="110" width="210" height="24" rx="10" fill="#217346" /><rect x="176" y="124" width="210" height="10" fill="#217346" />
        <g stroke="#d1d5db"><path d="M176 156h210M176 178h210M176 200h210M216 134v72M266 134v72M316 134v72" /></g>
        <rect x="270" y="157" width="44" height="20" fill="#dcfce7" /><text x="292" y="172" textAnchor="middle" fontSize="12" fill="#166534" fontFamily="monospace">=SUM</text>
        <rect x="190" y="214" width="12" height="74" rx="2" fill="#d95d2b" /><rect x="214" y="236" width="12" height="52" rx="2" fill="#2563eb" /><rect x="238" y="222" width="12" height="66" rx="2" fill="#059669" /><rect x="262" y="246" width="12" height="42" rx="2" fill="#7c3aed" />
        <polyline points="296,270 318,246 340,252 364,226" fill="none" stroke="#d95d2b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g filter="url(#sh)">
        <rect x="300" y="28" width="196" height="132" rx="10" fill="#fff" />
        <rect x="300" y="28" width="196" height="22" rx="10" fill="#c43e1c" /><rect x="300" y="40" width="196" height="10" fill="#c43e1c" />
        <rect x="312" y="60" width="172" height="90" rx="4" fill="#14213d" />
        <rect x="324" y="72" width="90" height="10" rx="3" fill="#fff" /><g fill="#cbd5e1"><rect x="324" y="92" width="70" height="6" rx="3" /><rect x="324" y="104" width="80" height="6" rx="3" /></g>
        <circle cx="448" cy="112" r="20" fill="#ffb703" /><path d="M424 138l16-16 12 10 16-14 16 20z" fill="#2563eb" opacity="0.9" />
      </g>
    </svg>
  );
}
