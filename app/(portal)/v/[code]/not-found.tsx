import Image from "next/image";
import Link from "next/link";

export default function PassportNotFound() {
  return (
    <main id="main" className="min-h-screen bg-cream-2 grid place-items-center px-4">
      <article className="max-w-md w-full bg-white rounded-2xl border border-black/[0.1] shadow-card p-8 text-center">
        <Image src="/growqr-logo.png" alt="GrowQR" width={120} height={34} className="h-8 w-auto mx-auto mb-6" />
        <h1 className="text-[22px] font-bold text-ink mb-2">Passport not found</h1>
        <p className="text-[15px] text-ink-3 mb-6">There is no passport with this code. Check the QR code or link you were given.</p>
        <Link href="/verify" className="inline-flex items-center min-h-[44px] px-5 rounded-lg border border-black/[0.15] text-[14px] font-medium hover:bg-cream-2">Verify a credential</Link>
      </article>
    </main>
  );
}
