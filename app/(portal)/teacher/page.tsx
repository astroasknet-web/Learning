import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/portal/guard";
import * as classes from "@/lib/lms/classes";
import { Card, PortalPage } from "@/components/portal/shell";
import { Alert } from "@/components/portal/ui";
import { createClassAction } from "./actions";

export const metadata: Metadata = { title: "My classes | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const field = "min-h-[44px] px-3 rounded-lg border border-black/[0.2] bg-white text-[15px]";
const btn = "inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[14px]";

export default async function TeacherHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser("teacher", "admin");
  const sp = await searchParams;
  const rows = await classes.classesOf(me.id);
  const active = rows.filter((c) => !c.archived);
  const archived = rows.filter((c) => c.archived);
  return (
    <PortalPage user={me} active="teacher" title="My classes" subtitle="Create a class, share its code with your students, then assign courses and practice tests and watch the gradebook fill in." wide>
      {sp.e ? <Alert>{sp.e}</Alert> : null}
      {sp.ok === "archived" ? <Alert kind="success">Class archived. Students can no longer join it.</Alert> : null}
      <Card title="Start a class">
        <form action={createClassAction} className="flex flex-wrap gap-3 items-end">
          <div className="grow max-w-md"><label htmlFor="cname" className="block text-[14px] font-medium text-ink mb-1">Class name</label>
            <input id="cname" name="name" required minLength={2} maxLength={120} placeholder="Grade 11 IELTS, Section B" className={`${field} w-full`} /></div>
          <button type="submit" className={btn}>Create class</button>
        </form>
      </Card>
      <Card title={`Active classes (${active.length})`}>
        {!active.length ? <p className="text-[14px] text-ink-3">No classes yet. Create one above.</p> : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {active.map((c) => (
              <li key={c.id} className="rounded-xl border border-black/[0.1] p-4">
                <h3 className="text-[16px] font-semibold text-ink"><Link className="hover:underline" href={`/teacher/class/${c.id}`}>{c.name}</Link></h3>
                <p className="text-[13px] text-ink-3 mt-1">{c.students} students · {c.assignments} assignments</p>
                <p className="text-[13px] mt-2">Join code <b className="font-mono text-[16px] tracking-widest text-ink">{c.join_code}</b></p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {archived.length ? (
        <Card title="Archived"><ul className="text-[14px] space-y-1">{archived.map((c) => <li key={c.id}><Link className="underline" href={`/teacher/class/${c.id}`}>{c.name}</Link> <span className="text-ink-3">({c.students} students)</span></li>)}</ul></Card>
      ) : null}
    </PortalPage>
  );
}
