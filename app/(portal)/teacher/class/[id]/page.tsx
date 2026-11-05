import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/portal/guard";
import * as classes from "@/lib/lms/classes";
import * as lessons from "@/lib/market/lessons";
import { Card, PortalPage } from "@/components/portal/shell";
import { Alert } from "@/components/portal/ui";
import { classAction } from "../../actions";

export const metadata: Metadata = { title: "Class | GrowQR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const field = "min-h-[44px] px-3 rounded-lg border border-black/[0.2] bg-white text-[15px]";
const btn = "inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-orange-deep hover:bg-ink text-white font-semibold text-[14px]";
const ghost = "inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg border border-black/[0.15] hover:bg-cream-2 text-[14px] font-medium text-ink";
const STATE = { done: "bg-emerald-50 text-emerald-900", started: "bg-amber-50 text-amber-900", none: "bg-cream-2 text-ink-3" } as const;
const OK: Record<string, string> = { created: "Class created. Share the join code with your students.", assigned: "Assignment added.", removed: "Assignment removed.", student_removed: "Student removed from the class.", restored: "Class restored." };

export default async function ClassPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser("teacher", "admin");
  const id = Math.trunc(Number((await params).id));
  const sp = await searchParams;
  const cls = Number.isInteger(id) ? await classes.ownedClass(me, id) : null;
  if (!cls) notFound();
  const [g, opts] = await Promise.all([classes.gradebook(cls.id), classes.courseOptions(lessons.nativeSlugs())]);
  const hidden = (act: string, extra: Record<string, string | number> = {}) => (
    <>
      <input type="hidden" name="class_id" value={cls.id} /><input type="hidden" name="act" value={act} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );
  const doneCount = (aid: number) => g.students.filter((s) => g.cells.get(classes.cellKey(aid, s.id))?.state === "done").length;

  return (
    <PortalPage user={me} active="teacher" title={cls.name} subtitle={<><Link href="/teacher" className="underline">All classes</Link> · {g.students.length} students · {cls.archived ? "Archived" : <>Join code <b className="font-mono tracking-widest text-ink">{cls.join_code}</b></>}</>} wide="full">
      {sp.e ? <Alert>{sp.e}</Alert> : null}
      {sp.ok && OK[sp.ok] ? <Alert kind="success">{OK[sp.ok]}</Alert> : null}

      <Card title="Gradebook">
        {!g.assignments.length ? <p className="text-[14px] text-ink-3">Nothing assigned yet. Add a course or practice test below.</p> : !g.students.length ? <p className="text-[14px] text-ink-3">No students have joined yet. Give them the code <b className="font-mono">{cls.join_code}</b>: they enter it on their My classes page.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] min-w-[40rem]">
              <thead>
                <tr className="text-left text-ink-3"><th scope="col" className="py-2 pr-3 font-medium">Student</th>
                  {g.assignments.map((a) => <th key={a.id} scope="col" className="py-2 pr-3 font-medium align-bottom"><Link className="text-ink hover:underline" href={classes.hrefFor(a)}>{a.title}</Link><span className="block text-[12px] font-normal">{a.due_date ? `Due ${a.due_date} · ` : ""}{doneCount(a.id)}/{g.students.length} done</span></th>)}</tr>
              </thead>
              <tbody>
                {g.students.map((s) => (
                  <tr key={s.id} className="border-t border-black/[0.07]">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">{s.name}<span className="block text-[12px] font-normal text-ink-3">{s.email}</span></th>
                    {g.assignments.map((a) => { const c = g.cells.get(classes.cellKey(a.id, s.id))!; return <td key={a.id} className="pr-3"><span className={`inline-block px-2 py-1 rounded-md text-[13px] ${STATE[c.state]}`}>{c.label}</span></td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {g.assignments.length && g.students.length ? <p className="mt-4"><a className={ghost} href={`/teacher/class/${cls.id}/csv`}>Download gradebook (CSV)</a></p> : null}
      </Card>

      {!cls.archived ? (
        <Card title="Assign a course or practice test">
          <form action={classAction} className="grid gap-4 max-w-2xl">
            {hidden("assign")}
            <fieldset><legend className="text-[14px] font-medium text-ink mb-1">What to assign</legend>
              <div className="flex gap-4 text-[14px]"><label className="inline-flex items-center gap-2 min-h-[44px]"><input type="radio" name="kind" value="course" defaultChecked className="accent-orange" /> A course</label>
                <label className="inline-flex items-center gap-2 min-h-[44px]"><input type="radio" name="kind" value="test" className="accent-orange" /> A practice test</label></div></fieldset>
            <div><label htmlFor="course" className="block text-[14px] font-medium text-ink mb-1">Course (if assigning a course)</label>
              <select id="course" name="course" className={`${field} w-full`} defaultValue="">
                <option value="">Choose a course</option>
                <optgroup label="Taught on GrowQR">{opts.filter((o) => o.native).map((o) => <option key={o.slug} value={o.slug}>{o.title}</option>)}</optgroup>
                <optgroup label="Rest of the catalogue">{opts.filter((o) => !o.native).map((o) => <option key={o.slug} value={o.slug}>{o.title}</option>)}</optgroup>
              </select></div>
            <div className="flex flex-wrap gap-3">
              <div><label htmlFor="exam" className="block text-[14px] font-medium text-ink mb-1">Test (if assigning a test)</label>
                <select id="exam" name="exam" className={field} defaultValue="">
                  <option value="">Choose a test</option>
                  {Object.entries(classes.TEST_EXAMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select></div>
              <div><label htmlFor="test_no" className="block text-[14px] font-medium text-ink mb-1">Test number (1 to 30)</label>
                <input id="test_no" name="test_no" type="number" min={1} max={30} className={`${field} w-28`} /></div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div><label htmlFor="due" className="block text-[14px] font-medium text-ink mb-1">Due date (optional)</label><input id="due" name="due" type="date" className={field} /></div>
              <div className="grow"><label htmlFor="note" className="block text-[14px] font-medium text-ink mb-1">Note for students (optional)</label><input id="note" name="note" maxLength={400} className={`${field} w-full`} /></div>
            </div>
            <div><button type="submit" className={btn}>Assign</button></div>
          </form>
        </Card>
      ) : null}

      <Card title={`Assignments (${g.assignments.length})`}>
        {!g.assignments.length ? <p className="text-[14px] text-ink-3">None yet.</p> : (
          <ul className="divide-y divide-black/[0.07]">
            {g.assignments.map((a) => (
              <li key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px]"><b>{a.title}</b> <span className="text-ink-3">· {a.kind === "course" ? "course" : "practice test"}{a.due_date ? ` · due ${a.due_date}` : ""}</span>{a.note ? <span className="block text-ink-3">{a.note}</span> : null}</span>
                <form action={classAction}>{hidden("unassign", { assignment_id: a.id })}<button type="submit" className={ghost}>Remove<span className="sr-only"> {a.title}</span></button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Students (${g.students.length})`}>
        {!g.students.length ? <p className="text-[14px] text-ink-3">Waiting for students to join with the code.</p> : (
          <ul className="divide-y divide-black/[0.07]">
            {g.students.map((s) => (
              <li key={s.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[14px]"><b>{s.name}</b> <span className="text-ink-3">{s.email}</span></span>
                <form action={classAction}>{hidden("remove_student", { student_id: s.id })}<button type="submit" className={ghost}>Remove<span className="sr-only"> {s.name}</span></button></form></li>
            ))}
          </ul>
        )}
      </Card>

      <form action={classAction}>{cls.archived ? hidden("restore") : hidden("archive")}<button type="submit" className={ghost}>{cls.archived ? "Restore this class" : "Archive this class"}</button></form>
    </PortalPage>
  );
}
