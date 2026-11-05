"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const HomeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const BackIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M19 12H5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal nav */}
      <header className="w-full px-6 py-5 flex items-center">
        <Link href="/">
          <Image src="/onlylogo.png" alt="GrowQR" width={140} height={48} className="h-7 w-auto" priority />
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 text-center">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-orange/[0.07] blur-[100px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col items-center gap-6 max-w-lg"
        >
          {/* 404 number */}
          <p className="text-[120px] md:text-[160px] font-bold leading-none tracking-tight text-ink/[0.06] select-none">
            404
          </p>

          <div className="-mt-6 flex flex-col gap-3">
            <h1 className="text-ink text-3xl md:text-4xl font-semibold leading-tight tracking-tight">
              Page not found
            </h1>
            <p className="text-black/55 text-lg leading-relaxed">
              This page doesn&apos;t exist or has moved.
            </p>
          </div>

          {/* Primary actions: home, or back to where you came from */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                href="/"
                className="group inline-flex items-center gap-2 rounded-full bg-orange px-6 py-3 text-[15px] font-bold text-white shadow-[0_12px_24px_-12px_rgba(255,106,47,0.4)] transition-all hover:bg-orange-dark hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/60 focus-visible:ring-offset-2"
              >
                <span className="text-white/80">{HomeIcon}</span>
                Back to Home
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => router.back()}
                className="group inline-flex items-center gap-2 rounded-full border border-black/[0.11] bg-white/60 px-6 py-3 text-[15px] font-bold text-ink-3 transition-all hover:border-black/20 hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/50 focus-visible:ring-offset-2"
              >
                <span className="text-ink-3/70 group-hover:text-ink/70">{BackIcon}</span>
                Go Back
              </button>
            </motion.div>
          </div>
        </motion.div>
      </main>

      <footer className="w-full px-6 py-5 text-center">
        <p className="text-sm text-black/30">© {new Date().getFullYear()} GrowQR</p>
      </footer>
    </div>
  );
}
