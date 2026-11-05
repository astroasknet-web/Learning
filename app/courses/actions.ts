"use server";

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/portal/guard";
import { safeNext } from "@/lib/portal/security";
import { PayError } from "@/lib/pay/orders";
import { pickCourse } from "@/lib/pay/plans";
import { planRecommended } from "@/lib/pay/plan-recommend";
import { buyHref, canStudy } from "@/lib/pay/course-access";
import * as courses from "@/lib/market/courses";
import * as learning from "@/lib/market/learning";
import * as lessons from "@/lib/market/lessons";

/** Enrol, leave, save progress or attach a certificate. Students only; the course is looked up here, never trusted from the form. */
export async function courseAction(fd: FormData): Promise<void> {
  const back = safeNext(String(fd.get("back") ?? ""), "/my-courses");
  const sep = back.includes("?") ? "&" : "?";
  const me = await currentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (me.role !== "student") redirect(back);
  const slug = String(fd.get("slug") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const course = slug ? await courses.bySlug(slug) : null;
  if (!course) redirect(back);
  const act = String(fd.get("act") ?? "");
  let msg = "";
  let err = "";
  switch (act) {
    case "enrol":
      if (!lessons.isNative(course.slug)) redirect(back); // lessons for the other courses are not on GrowQR yet
      if (!(await canStudy(me.id, course.id, course.slug))) redirect(buyHref(course.slug)); // a course with a fee is enrolled by paying for it
      await learning.enrol(me.id, course.id);
      msg = "enrolled";
      break;
    case "pick": {
      if (!lessons.isNative(course.slug)) redirect(back); // only courses with lessons on GrowQR can be picked
      try {
        await pickCourse(me.id, { id: course.id, slug: course.slug }, (await planRecommended(me.id)).list.map((x) => x.slug));
        msg = "picked";
      } catch (e) {
        if (!(e instanceof PayError)) throw e;
        msg = "pick_err";
        err = e.message;
      }
      break;
    }
    case "unenrol":
      await learning.unenrol(me.id, course.id);
      msg = "left";
      break;
    case "save": {
      if (lessons.isNative(course.slug)) {
        msg = "locked"; // progress in these courses comes only from passing the module quizzes
        break;
      }
      if (!(await canStudy(me.id, course.id, course.slug))) redirect(buyHref(course.slug));
      await learning.enrol(me.id, course.id); // saving progress implies enrolment
      const r = await learning.setDone(me.id, course, fd.getAll("done"));
      msg = r === null ? "locked" : r.status === "completed" ? "completed" : "saved";
      break;
    }
    case "certificate": {
      const e = await learning.attachCertificate(me.id, course, String(fd.get("cert_url") ?? ""), String(fd.get("cert_code") ?? ""));
      msg = e === null ? "cert_ok" : "cert_err";
      err = e ?? "";
      break;
    }
    default:
      redirect(back);
  }
  const anchor = act === "enrol" || act === "unenrol" ? "progress" : `c-${course.slug}`;
  redirect(`${back}${sep}c=${msg}${err ? "&e=" + encodeURIComponent(err) : ""}#${anchor}`);
}
