import type { ReactNode } from "react";
import A11yPanel from "@/components/a11y/A11yPanel";

/** Same read-aloud and display settings as the course pages. */
export default function PracticeTestsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <A11yPanel />
    </>
  );
}
