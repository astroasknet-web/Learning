import type { Metadata } from "next";
import Link from "next/link";
import { PortalPage } from "@/components/portal/shell";
import { btnPrimary, Card } from "@/components/mathspeed/ui";
import { getEnrolment } from "@/lib/mathspeed/store";
import { studentOnly } from "@/lib/mathspeed/page";
import { AGE_BANDS, COUNTRIES, LANGUAGES, PACES } from "@/lib/mathspeed/personalise";
import { enrolAction } from "../actions";

export const metadata: Metadata = { title: "Start the Mathematics Speed Enhancement Studio | GrowQR" };
export const dynamic = "force-dynamic";

const field = "mt-1 min-h-[48px] w-full rounded-lg border border-black/20 bg-white px-3 text-[15px] text-ink focus:border-orange focus:outline-none";

export default async function EnrolPage() {
  const me = await studentOnly("/math-speed/enrol");
  const en = await getEnrolment(me.id);
  return (
    <PortalPage user={me} active="math-speed" title={en ? "Your learning preferences" : "Start your journey"} subtitle="Four quick questions. They only change the examples and how we pace you. The journey, the levels and the standard are the same for everyone." wide>
      <Card>
        <form action={enrolAction} className="grid gap-6">
          <fieldset>
            <legend className="text-[15px] font-semibold text-ink">Language</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {LANGUAGES.map((l) => (
                <label key={l.id} className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-[14.5px] ${l.available ? "border-black/20" : "border-black/10 text-ink-4"}`}>
                  <input type="radio" name="language" value={l.id} defaultChecked={l.id === (en?.language ?? "en")} disabled={!l.available} /> {l.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] text-ink-4">Lessons are in English today. Other languages are planned and are shown so you can see what is coming.</p>
          </fieldset>
          <div>
            <label htmlFor="country" className="text-[15px] font-semibold text-ink">Where do you live?</label>
            <select id="country" name="country" defaultValue={en?.country ?? "IN"} className={field}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <p className="mt-1.5 text-[13px] text-ink-4">Used for the currency and names in word problems.</p>
          </div>
          <fieldset>
            <legend className="text-[15px] font-semibold text-ink">Your age</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {AGE_BANDS.map((a) => <label key={a.id} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-black/20 px-3 text-[14.5px]"><input type="radio" name="age" value={a.id} defaultChecked={a.id === (en?.ageBand ?? "12-15")} /> {a.label}</label>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-[15px] font-semibold text-ink">How much time can you give each day?</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {PACES.map((p) => <label key={p.id} className="flex min-h-[56px] items-start gap-2 rounded-lg border border-black/20 p-3 text-[14.5px]"><input type="radio" name="pace" value={p.id} defaultChecked={p.id === (en?.pace ?? "regular")} className="mt-1" /><span><b className="block text-ink">{p.label}</b><span className="text-ink-3">{p.blurb}</span></span></label>)}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={btnPrimary}>{en ? "Save" : "Continue"}</button>
            {en ? <Link href="/math-speed/journey" className="text-[14.5px] underline">Back to my journey</Link> : null}
          </div>
        </form>
      </Card>
    </PortalPage>
  );
}
