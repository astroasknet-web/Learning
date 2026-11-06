import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Space_Grotesk } from "next/font/google";
import Footer from "@/components/layout/Footer";
import LearnHome from "@/components/yugtylearning/LearnHome";
import "@/components/yugtylearning/base.css";
import "@/components/yugtylearning/division.css";
import "@/components/yugtylearning/yugtylearning.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--vl-display", display: "swap" });
const text = Inter({ subsets: ["latin"], variable: "--vl-text", display: "swap" });

export const metadata: Metadata = {
  title: "YugtyLearning: Courses, online classes and practice studios",
  description: "Self-paced courses, live online classes, exam preparation, school classes and practice studios in one place. Start free, no card needed.",
};

export default function Home() {
  return (
    <>
    <div className={`vl ${display.variable} ${text.variable}`}>
      <a className="vl-skip" href="#main-content">Skip to content</a>
      <LearnHome />
      <Script src="/yugtylearning/fx.js" strategy="afterInteractive" />
      <Script src="/yugtylearning/division.js" strategy="afterInteractive" />
      <Script src="/yugtylearning/learn-cosmos.js" strategy="afterInteractive" />
    </div>
    <div className="yl-foot"><Footer /></div>
    </>
  );
}
