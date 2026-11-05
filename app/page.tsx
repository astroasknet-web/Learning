import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/layout/SiteChrome";

export const metadata: Metadata = {
  title: "GrowQR Learning",
  description: "Career courses, exam preparation, school classes, Vedic maths, olympiads and AI-assisted practice studios, with classrooms for teachers and progress views for parents.",
};

const CARDS = [
  { href: "/courses", title: "Courses", text: "The full course catalogue with lessons, activities and certificates." },
  { href: "/exam-prep", title: "Exam preparation", text: "Structured preparation tracks and practice tests." },
  { href: "/school", title: "School classes", text: "Chapter-wise lessons and quizzes for school students." },
  { href: "/vedic-math", title: "Vedic maths", text: "A guided Vedic maths programme." },
  { href: "/olympiad/imo", title: "Olympiads", text: "IMO practice, mock tests and papers." },
  { href: "/my-courses", title: "My learning", text: "Pick up where you left off." },
  { href: "/my-classes", title: "Classroom", text: "Join and follow your classes; teachers manage them from /teacher." },
];

export default function Home() {
  return (
    <SiteChrome>
      <main className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-orange-deep">GrowQR Learning</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">Courses, classroom and practice in one place</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-2">Career courses, exam preparation, school classes, Vedic maths, olympiads and AI-assisted practice studios, with classrooms for teachers and progress views for parents.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/courses" className="inline-flex min-h-[48px] items-center rounded-full bg-orange px-6 font-semibold text-white">Browse courses</Link>
          <Link href="/login" className="inline-flex min-h-[48px] items-center rounded-full border border-black/15 px-6 font-semibold">Sign in</Link>
        </div>
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <li key={c.href}>
              <Link href={c.href} className="block h-full rounded-2xl border border-black/10 p-6 transition hover:border-orange hover:shadow-md">
                <h2 className="text-xl font-semibold">{c.title}</h2>
                <p className="mt-2 text-[15px] text-ink-2">{c.text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </SiteChrome>
  );
}
