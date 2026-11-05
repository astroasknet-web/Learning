"use client";

import { useState } from "react";
import { CourseThumb } from "./CourseThumb";

/**
 * The course's own thumbnail (640 and 1920 pixel WebP, lazy, with its real dimensions so nothing shifts), falling back to the generated vector cover if the picture
 * cannot be loaded. The picture repeats the course title that sits next to it, so it is decorative for assistive technology (empty alt).
 */
export default function CourseImage({ course, className = "", priority = false }: { course: { slug: string; icon: string; c1: string; c2: string }; className?: string; priority?: boolean }) {
  const [bad, setBad] = useState(false);
  if (bad) return <CourseThumb course={course} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/course-thumbs/${course.slug}-640.webp`}
      srcSet={`/course-thumbs/${course.slug}-640.webp 640w, /course-thumbs/${course.slug}.webp 1920w`}
      sizes="(min-width: 1280px) 380px, (min-width: 640px) 46vw, 100vw"
      width={640}
      height={360}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setBad(true)}
      className={`block h-full w-full object-cover ${className}`}
    />
  );
}
