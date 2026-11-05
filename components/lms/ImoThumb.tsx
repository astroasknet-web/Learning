/* eslint-disable @next/next/no-img-element -- fixed pre-built WebP files; two sizes via srcset */
/** The picture for one Maths Olympiad class (public/olympiad-thumbs, drawn by scripts/thumbs/olympiad.mjs). */
export default function ImoThumb({ cls, className = "", priority = false, full = false }: { cls: number; className?: string; priority?: boolean; full?: boolean }) {
  return (
    <img
      src={`/olympiad-thumbs/class-${cls}-640.webp`}
      srcSet={`/olympiad-thumbs/class-${cls}-640.webp 640w, /olympiad-thumbs/class-${cls}.webp 1920w`}
      sizes={full ? "(min-width: 1024px) 480px, 100vw" : "(min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw"}
      alt={`Class ${cls} Maths Olympiad`}
      width={640}
      height={360}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`block object-cover ${className}`}
    />
  );
}
