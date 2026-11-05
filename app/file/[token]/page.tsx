import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Script from "next/script";
import { all } from "@/lib/portal/db";
import { dropSessionData, getSession } from "@/lib/portal/session";
import * as DC from "@/lib/crm/docs";
import * as LD from "@/lib/crm/leads";
import * as PT from "@/lib/crm/path";
import * as VF from "@/lib/crm/verify";
import * as VP from "@/lib/crm/verify-pay";
import { fieldCls } from "@/components/crm/crm-page";
import { fileAction } from "./actions";

// A private page: the secret link is the only key, so it must never be indexed or leak through a referrer.
export const metadata: Metadata = { title: "Your application file | GrowQR", robots: { index: false, follow: false, nocache: true }, referrer: "same-origin" };
export const dynamic = "force-dynamic";

const box = "bg-white rounded-2xl border border-black/[0.08] shadow-card p-5 sm:p-6 mb-5";
const btn = "min-h-[44px] px-5 rounded-lg bg-orange hover:bg-orange-dark text-white text-[15px] font-semibold";
const ghost = "min-h-[44px] px-4 rounded-lg border border-black/[0.15] text-[14px] font-medium hover:bg-cream-2";
const inr = (n: number) => `₹${Math.trunc(n).toLocaleString("en-IN")}`;
const day = (d: unknown) => new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const STAGE_LABEL: Record<string, string> = {
  new: "We have your enquiry", contacted: "In touch with your counsellor", counselling_scheduled: "Counselling booked", counselling_done: "Counselling complete", interested: "Shortlisting universities",
  app_started: "Applications in preparation", app_submitted: "Applications submitted", offer: "Offer received", deposit_paid: "Offer accepted and deposit paid", visa_applied: "Visa applied",
  visa_approved: "Visa approved", enrolled: "Enrolled. Congratulations!", on_hold: "On hold", lost: "Closed",
};
const DOC_STATUS: Record<string, [string, string]> = {
  uploaded: ["Uploaded", "bg-cream-3 text-ink-3"], in_verification: ["Being verified", "bg-blue-50 text-blue-800"], verified: ["Verified", "bg-emerald-50 text-emerald-800"], rejected: ["Needs attention", "bg-red-50 text-red-800"],
};

export default async function StudentFile({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lead = /^[a-f0-9]{32}$/.test(token) ? await LD.findByToken(token) : null;
  if (!lead) notFound(); // the same answer for a wrong guess and an old link
  const s = await getSession();
  const flash = s?.data?.crmfile_flash as [string, string] | undefined;
  if (flash) await dropSessionData("crmfile_flash");

  const [ms, docs, apps, allVers, sub, counsellor] = await Promise.all([
    PT.forLead(lead.id), DC.forLead(lead.id), LD.applications(lead.id), VF.forLead(lead.id), VF.submittable(lead.id),
    lead.counsellor_id ? all<{ name: string }>("SELECT name FROM users WHERE id = $1", [lead.counsellor_id]) : Promise.resolve([]),
  ]);
  const vers = allVers.filter((v) => v.status !== "cancelled");
  const itemsBy = new Map(await Promise.all(vers.map(async (v) => [v.id, await VF.items(v.id)] as const)));
  const payOn = VP.enabled();
  const dueVer = vers.filter((v) => v.status === "awaiting_payment");
  const prog = PT.progress(ms);
  const base = VF.fee(0);
  const perDoc = VF.fee(1) - base;
  const first = lead.name.trim().split(/\s+/)[0] ?? "";
  const stageGood = ["offer", "deposit_paid", "visa_approved", "enrolled"].includes(lead.stage);

  return (
    <div className="min-h-screen bg-cream-2">
      <header className="bg-white border-b border-black/[0.08]"><div className="mx-auto max-w-3xl px-4 h-16 flex items-center"><Image src="/growqr-logo.png" alt="GrowQR" width={120} height={34} className="h-8 w-auto" priority /></div></header>
      <main id="main" className="mx-auto max-w-3xl px-4 sm:px-6 py-8" data-crm-file data-token={token}>
        <h1 className="text-[26px] sm:text-[30px] font-bold text-ink tracking-tight">Hello {first}, this is your application file</h1>
        <p className="text-[15px] text-ink-3 mt-1.5 mb-6">Private to you. Upload your documents, see what is still needed, and track your progress. Do not share this link.</p>
        {flash ? <p role={flash[0] === "err" ? "alert" : "status"} className={`mb-5 rounded-lg border px-3.5 py-3 text-[14px] ${flash[0] === "err" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{flash[1]}</p> : null}
        <p data-pay-msg role="status" hidden className="mb-5 rounded-lg border border-black/[0.12] bg-white px-3.5 py-3 text-[14px]" />

        <section className={box} aria-labelledby="st-h"><h2 id="st-h" className="text-[18px] font-semibold text-ink mb-3">Where you are</h2>
          <p className="mb-2"><span className={`px-2.5 py-1 rounded-full text-[13px] font-semibold ${stageGood ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{STAGE_LABEL[lead.stage] ?? "In progress"}</span>{lead.pref_country ? <span className="text-[14px] text-ink-3 ml-2">Target: {lead.pref_country}{lead.pref_course ? `, ${lead.pref_course}` : ""}</span> : null}</p>
          <p className="text-[14px] text-ink-3 mb-3">Your counsellor: <b className="text-ink">{counsellor[0]?.name ?? "to be assigned"}</b></p>
          <div role="progressbar" aria-valuenow={prog} aria-valuemin={0} aria-valuemax={100} aria-label="Preparation progress" className="h-2.5 rounded bg-cream-3"><div className="h-2.5 rounded bg-orange" style={{ width: `${prog}%` }} /></div>
          <p className="text-[13px] text-ink-3 mt-1.5">{prog}% of your preparation checklist is complete.</p>
        </section>

        <section className={box} aria-labelledby="ck-h"><h2 id="ck-h" className="text-[18px] font-semibold text-ink mb-3">Your checklist</h2>
          <ul className="divide-y divide-black/[0.07]">
            {Object.entries(PT.KINDS).map(([k, [label]]) => {
              const m = ms[k];
              const st = m?.status ?? "not_started";
              if (["toefl", "pte", "duolingo", "act", "gmat"].includes(k) && st === "not_started") return null;
              const when = m?.exam_date ? ` · ${day(m.exam_date)}` : m?.target_date ? ` · target ${day(m.target_date)}` : "";
              return (
                <li key={k} className="py-2.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[14px]"><b className="text-ink">{label}</b><br /><small className="text-ink-3">{`${m?.score ?? ""} ${m?.detail ?? ""}`.trim()}{when}</small></span>
                  <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${["completed", "certified"].includes(st) ? "bg-emerald-50 text-emerald-800" : st === "not_started" ? "bg-cream-3 text-ink-3" : "bg-amber-50 text-amber-900"}`}>{PT.STATUS[st]}</span></li>
              );
            })}
          </ul>
          <p className="text-[13px] text-ink-3 mt-3">Your counsellor updates this as you complete each step. IELTS or another English test, SAT/GRE where your course needs it, an internship and an NGO community-service certificate all strengthen your application.</p>
        </section>

        {apps.length ? (
          <section className={box} aria-labelledby="ap-h"><h2 id="ap-h" className="text-[18px] font-semibold text-ink mb-3">Your universities</h2>
            <ul className="divide-y divide-black/[0.07]">{apps.map((a) => (
              <li key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[14px]"><b className="text-ink">{a.university}</b><br /><small className="text-ink-3">{a.program} {a.intake}</small></span>
                <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${["offer", "accepted"].includes(a.status) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{LD.APP_STATUS[a.status] ?? a.status}{a.offer_type ? ` (${a.offer_type})` : ""}</span></li>
            ))}</ul></section>
        ) : null}

        <section className={box} aria-labelledby="dc-h"><h2 id="dc-h" className="text-[18px] font-semibold text-ink mb-3">Your documents</h2>
          {!docs.length ? <p className="text-[14px] text-ink-3 mb-3">Nothing uploaded yet. Start with your passport and marksheets.</p> : null}
          <ul className="divide-y divide-black/[0.07] mb-4">{docs.map((d) => {
            const [label, cls] = DOC_STATUS[d.status] ?? [d.status, "bg-cream-3 text-ink-3"];
            return (
              <li key={d.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2"><span className="text-[14px]"><b className="text-ink">{DC.TYPES[d.doc_type] ?? d.doc_type}</b><br /><small className="text-ink-3">{d.original_name}</small></span>
                <span className="flex flex-wrap items-center gap-2"><span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${cls}`}>{label}</span>
                  <a className={ghost + " inline-flex items-center"} href={`/file/${token}/doc/${d.id}`} target="_blank" rel="noopener noreferrer">Open</a>
                  {d.uploaded_by === null && d.status === "uploaded" ? <form action={fileAction}><input type="hidden" name="t" value={token} /><input type="hidden" name="act" value="delete" /><input type="hidden" name="doc" value={d.id} /><button className={ghost} type="submit">Remove</button></form> : null}</span></li>
            );
          })}</ul>
          <form action={fileAction} className="grid sm:grid-cols-2 gap-3 items-end"><input type="hidden" name="t" value={token} /><input type="hidden" name="act" value="upload" />
            <div><label htmlFor="u-type" className="block text-[13px] font-medium text-ink-2 mb-1">Document</label><select id="u-type" name="doc_type" className={fieldCls}>{Object.entries(DC.TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label htmlFor="u-file" className="block text-[13px] font-medium text-ink-2 mb-1">File (PDF, JPG, PNG or DOCX, up to 8 MB)</label><input id="u-file" type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.docx" required className="text-[14px]" /></div>
            <div className="sm:col-span-2"><button className={btn} type="submit">Upload</button></div>
          </form>
          <p className="text-[13px] text-ink-3 mt-3">Your files are stored privately, scanned on upload, and only your counsellors can open them.</p>
        </section>

        <section className={box} id="verify" aria-labelledby="vf-h"><h2 id="vf-h" className="text-[18px] font-semibold text-ink mb-2">Document verification</h2>
          <p className="text-[14px] text-ink-2 mb-2">Universities and visa offices check that your documents are genuine. A third-party verification partner confirms them with the issuing school, board or test body, so problems are found before you apply.</p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[14px] text-amber-900 mb-4"><b>This service is paid by you.</b> The fee is {base > 0 ? `${inr(base)} plus ` : ""}{inr(perDoc)} per document. Your documents are sent to the partner only after the fee is paid.</p>

          {vers.map((v) => (
            <article key={v.id} className="rounded-xl border border-black/[0.08] bg-cream-2/50 p-4 mb-3">
              <p className="text-[14px]"><b>Verification #{v.id}</b> <span className={`ml-1 px-2.5 py-1 rounded-full text-[12px] font-semibold ${v.status === "verified" ? "bg-emerald-50 text-emerald-800" : v.status === "discrepancy" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>{VF.STATUS[v.status] ?? v.status}</span> <span className="text-ink-3">Fee {inr(v.fee_inr)}</span></p>
              <ul className="divide-y divide-black/[0.07] my-2">{(itemsBy.get(v.id) ?? []).map((it) => (
                <li key={it.id} className="py-2 flex justify-between gap-2 text-[14px]"><span>{DC.TYPES[it.doc_type] ?? it.doc_type}<br /><small className="text-ink-3">{it.note}</small></span>
                  <span className={`self-start px-2.5 py-1 rounded-full text-[12px] font-semibold ${it.result === "verified" ? "bg-emerald-50 text-emerald-800" : it.result === "pending" ? "bg-cream-3 text-ink-3" : "bg-red-50 text-red-800"}`}>{VF.RESULT[it.result] ?? it.result}</span></li>
              ))}</ul>
              {v.status === "awaiting_payment" ? (
                payOn ? (
                  <><p className="mt-3"><button className={btn} type="button" data-pay-verify={v.id}>Pay {inr(v.fee_inr)} securely</button></p>
                    <p className="text-[13px] text-ink-3 mt-1.5">Payment is handled by Razorpay (UPI, cards, netbanking). We never see your card details. You can also pay at our office; your counsellor will record it.</p></>
                ) : <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[14px] text-amber-900">Please pay {inr(v.fee_inr)} at our office or by the method your counsellor shares. They will record it and your documents will go to the partner.</p>
              ) : null}
            </article>
          ))}

          {sub.length && !dueVer.length ? (
            <form action={fileAction} className="mt-3"><input type="hidden" name="t" value={token} /><input type="hidden" name="act" value="verify" />
              <fieldset><legend className="text-[14px] font-medium text-ink mb-1">Choose the documents to verify:</legend>
                {sub.map((d) => <label key={d.id} className="flex items-center gap-2.5 min-h-[40px] text-[14px]"><input type="checkbox" name="docs" value={d.id} />{DC.TYPES[d.doc_type] ?? d.doc_type} <small className="text-ink-4">({d.original_name})</small></label>)}</fieldset>
              <label className="flex items-center gap-2.5 min-h-[44px] text-[14px] mt-1"><input type="checkbox" name="agree" value="1" required />I understand I pay the verification fee shown above.</label>
              <button className={`${btn} mt-2`} type="submit">Submit for verification</button></form>
          ) : !sub.length && !vers.length ? <p className="text-[14px] text-ink-3">Upload your passport, marksheets and certificates, then come back here to submit them.</p> : null}
        </section>
      </main>
      {payOn && dueVer.length ? <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" /> : null}
      <Script src="/crm-file.js?v=1" strategy="afterInteractive" />
    </div>
  );
}
