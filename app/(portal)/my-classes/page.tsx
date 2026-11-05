import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/portal/guard";
import * as classes from "@/lib/lms/classes";
import * as parents from "@/lib/lms/parents";
import { Card, PortalPage } from "@/components/portal/shell";
import { Alert } from "@/components/portal/ui";
import { joinClassAction, leaveClassAction } from "./actions";

export const metadata: Metadata = { title: "My classes | GrowQR" };
export const dynamic = "force-dynamic";

const field = "min-h-[44px] px-3 rounded-lg border border-black/[0.2] bg-white text-[15px]";
const STATE = { done: "bg-emerald-50 text-emerald-900", started: "bg-amber-50 text-amber-900", none: "bg-cream-2 text-ink-3" } as const;

export default async function MyClasses({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser("student");
  const sp = await searchParams;
  const [mine, code] = await Promise.all([classes.classesOfStudent(me.id), parents.learnerCode(me.id)]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <PortalPage user={me} active="classes" title="My classes" subtitle="Join your teacher's class with the code they gave you, then work through what they assign." wide>
      {sp.e ? <Alert>{sp.e}</Alert> : null}
      {sp.ok === "joined" ? <Alert kind="success">You have joined the class.</Alert> : null}
      {sp.ok === "left" ? <Alert kind="success">You have left the class.</Alert> : null}

      <Card title="Join a class">
        <form action={joinClassAction} className="flex flex-wrap items-end gap-3">
          <div><label htmlFor="code" className="block text-[14px] font-medium text-ink mb-1">Class code</label>
            <input id="code" name="code" required minLength={4} maxLength={10} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="K7M2QX" className={`${field} w-44 font-mono uppercase tracking-widest`} /></div>
          <button type="submit" className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[14px]">Join class</button>
        </form>
      </Card>

      {!mine.length ? <Card><p className="text-[14px] text-ink-3">You are not in a class yet.</p></Card> : mine.map((c) => (
        <Card key={c.id} title={c.name}>
          <p className="text-[13px] text-ink-3 -mt-2 mb-3">Teacher: {c.teacher}</p>
          {!c.items.length ? <p className="text-[14px] text-ink-3">Nothing assigned yet.</p> : (
            <ul className="divide-y divide-black/[0.07]">
              {c.items.map((a) => {
                const late = a.due_date && a.due_date < today && a.cell.state !== "done";
                return (
                  <li key={a.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14px]"><Link className="font-semibold text-ink underline underline-offset-2" href={classes.hrefFor(a)}>{a.title}</Link>
                      <span className="text-ink-3"> · {a.kind === "course" ? "course" : "practice test"}</span>
                      {a.due_date ? <span className={late ? "text-red-800 font-semibold" : "text-ink-3"}> · due {a.due_date}{late ? " (overdue)" : ""}</span> : null}
                      {a.note ? <span className="block text-ink-3">{a.note}</span> : null}</span>
                    <span className={`px-2.5 py-1 rounded-md text-[13px] ${STATE[a.cell.state]}`}>{a.cell.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={leaveClassAction} className="mt-3"><input type="hidden" name="class_id" value={c.id} /><button type="submit" className="min-h-[44px] text-[13px] underline text-ink-3">Leave this class<span className="sr-only">: {c.name}</span></button></form>
        </Card>
      ))}

      <Card title="Share your progress with a parent">
        <p className="text-[14px] text-ink-3">Your parent can create a free Parent account and enter this code to see your courses, practice-test results and class assignments. They cannot see anything else. Only share it with someone you trust.</p>
        <p className="mt-3">Your learner code <b className="font-mono text-[20px] tracking-widest text-ink">{code}</b></p>
      </Card>
    </PortalPage>
  );
}
