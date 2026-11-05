/* eslint-disable @next/next/no-img-element -- fixed pre-built WebP files; two sizes via srcset */
/** The picture for one exam-preparation product (public/exam-thumbs, drawn by scripts/thumbs/exams.mjs). */
export default function ExamThumb({ examKey, alt, className = "", priority = false, sizes }: { examKey: string; alt: string; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <img
      src={`/exam-thumbs/${examKey}-640.webp`}
      srcSet={`/exam-thumbs/${examKey}-640.webp 640w, /exam-thumbs/${examKey}.webp 1920w`}
      sizes={sizes ?? "(min-width: 1024px) 380px, (min-width: 640px) 45vw, 100vw"}
      alt={alt}
      width={640}
      height={360}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`block object-cover ${className}`}
    />
  );
}
