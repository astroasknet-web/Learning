import Link from "next/link";
import type { Job } from "@/lib/market/jobs";
import { highlight } from "@/lib/market/job-search";
import { toggleSavedAction } from "@/app/internships/actions";

const posted = (n: number) => (n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`);
const rupees = (n: number) => "₹" + n.toLocaleString("en-IN");

export function Avatar({ job, size = "md" }: { job: Pick<Job, "color" | "ini">; size?: "md" | "lg" }) {
  return (
    <span aria-hidden="true" style={{ background: job.color }} className={`grid place-items-center shrink-0 rounded-xl text-white font-bold ${size === "lg" ? "w-16 h-16 text-[22px]" : "w-12 h-12 text-[16px]"}`}>{job.ini}</span>
  );
}

/** A small mark in <mark> tags is the only HTML this renders, and highlight() escapes everything else. */
function Hl({ text, terms }: { text: string; terms: string[] }) {
  return <span dangerouslySetInnerHTML={{ __html: highlight(text, terms) }} />;
}

export function SaveButton({ id, saved, back }: { id: number; saved: boolean; back: string }) {
  return (
    <form action={toggleSavedAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <button type="submit" aria-pressed={saved} aria-label={saved ? "Remove from saved internships" : "Save this internship"} className={`min-h-[44px] min-w-[44px] rounded-lg border text-[13px] font-medium px-3 ${saved ? "bg-orange-light border-orange/40 text-orange-deep" : "border-black/[0.15] text-ink-3 hover:bg-cream-2"}`}>
        {saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}

export function JobCard({ job, terms = [], saved = false, canSave = false, back, applied = false }: { job: Job; terms?: string[]; saved?: boolean; canSave?: boolean; back: string; applied?: boolean }) {
  return (
    <li className="bg-white rounded-2xl border border-black/[0.08] shadow-card p-5">
      <div className="flex gap-4">
        <Avatar job={job} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold text-ink leading-snug">
            <Link href={`/internships/${job.slug}`} className="hover:underline underline-offset-2"><Hl text={job.title} terms={terms} /></Link>
          </h3>
          <p className="text-[14px] text-ink-3"><Hl text={job.company} terms={terms} /> &middot; {job.loc} ({job.mode})</p>
        </div>
        {job.match !== null ? (
          <div className="shrink-0 text-center" title="How well your Skill Passport matches this role">
            <b className="block text-[20px] text-ink leading-none">{job.match}%</b>
            <span className="text-[12px] text-ink-4">match</span>
          </div>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[14px] text-ink-2">
        <li><b>{rupees(job.stipend)}</b> / month</li>
        <li>{job.weeks} weeks</li>
        <li>{job.cat}</li>
        <li>Posted {posted(job.posted)}</li>
      </ul>
      <ul className="flex flex-wrap gap-2 mt-3" aria-label="Skills">
        {job.skills.slice(0, 6).map((s) => <li key={s} className="px-2.5 py-1 rounded-full bg-cream-3 text-[12px] text-ink-2"><Hl text={s} terms={terms} /></li>)}
      </ul>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        {job.badge && job.badge !== "Verified stipend" ? <span className={`px-2.5 py-1 rounded-full text-[12px] font-medium ${job.badge === "Verified stipend" ? "bg-emerald-50 text-emerald-800" : "bg-cream-3 text-ink-3"}`}>{job.badge}</span> : null}
        {job.sample ? <span className="px-2.5 py-1 rounded-full text-[12px] bg-amber-50 text-amber-800">Sample listing</span> : null}
        <span className="ml-auto flex items-center gap-2">
          {applied ? <span className="text-[13px] font-medium text-emerald-700">Applied</span> : null}
          {canSave ? <SaveButton id={job.id} saved={saved} back={back} /> : null}
          <Link href={`/internships/${job.slug}`} className="min-h-[44px] inline-flex items-center px-4 rounded-lg bg-orange hover:bg-orange-dark text-white text-[14px] font-semibold">View details</Link>
        </span>
      </div>
    </li>
  );
}
