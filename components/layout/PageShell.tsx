import type { ReactNode } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function PageShell({
  children,
  hideUseCases = false,
}: {
  children: ReactNode;
  hideUseCases?: boolean;
}) {
  return (
    <>
      <Navbar hideUseCases={hideUseCases} />
      <main id="main-content">{children}</main>
      <Footer />
    </>
  );
}