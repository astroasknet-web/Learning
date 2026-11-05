import type { ReactNode } from "react";
import A11yPanel from "@/components/a11y/A11yPanel";

/** Read-aloud and display settings on every course page (catalogue, course, lessons). */
export default function CoursesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <A11yPanel />
    </>
  );
}
