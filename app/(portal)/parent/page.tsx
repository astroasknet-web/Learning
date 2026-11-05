import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/portal/guard";
import * as parents from "@/lib/lms/parents";
import { Card, PortalPage } from "@/components/portal/shell";
import { Alert } from "@/components/portal/ui";
import { linkChildAction, unlinkChildAction } from "./actions";

export const metadata: Metadata = { title: "My children | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ParentHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser("parent");
  const sp = await searchParams;
  const kids = await parents.children(me.id);
  return (
    <PortalPage user={me} active="parent" title="My children" subtitle="Follow your child's courses, practice-test results and class assignments." wide>
      {sp.e ? <Alert>{sp.e}</Alert> : null}
      {sp.ok === "linked" ? <Alert kind="success">Child added.</Alert> : null}
      {sp.ok === "unlinked" ? <Alert kind="success">You no longer follow that child.</Alert> : null}
      <Card title="Add a child">
        <p className="text-[14px] text-ink-3 mb-3">Ask your child to open <b>My classes</b> in their GrowQR account and read you their learner code.</p>
        <form action={linkChildAction} className="flex flex-wrap items-end gap-3">
          <div><label htmlFor="code" className="block text-[14px] font-medium text-ink mb-1">Learner code</label>
            <input id="code" name="code" required minLength={8} maxLength={10} autoComplete="off" autoCapitalize="characters" spellCheck={false} className="min-h-[44px] px-3 rounded-lg border border-black/[0.2] bg-white text-[15px] w-44 font-mono uppercase tracking-widest" /></div>
          <button type="submit" className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[14px]">Add child</button>
        </form>
      </Card>
      <Card title={`Children (${kids.length})`}>
        {!kids.length ? <p className="text-[14px] text-ink-3">No children added yet.</p> : (
          <ul className="divide-y divide-black/[0.07]">
            {kids.map((k) => (
              <li key={k.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <Link className="text-[16px] font-semibold text-ink underline underline-offset-2" href={`/parent/child/${k.id}`}>{k.name}</Link>
                <form action={unlinkChildAction}><input type="hidden" name="student_id" value={k.id} /><button type="submit" className="min-h-[44px] text-[13px] underline text-ink-3">Stop following<span className="sr-only"> {k.name}</span></button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PortalPage>
  );
}
