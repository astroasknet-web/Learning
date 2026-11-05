import { readFileSync } from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { heuristics } from "./scanner";

/**
 * Study abroad on a real database: profile, shortlist, applications through the counselor pipeline, the document vault with its security
 * scan and signed links, stages and counselor access.
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/abroad/abroad-db.test.ts
 */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-host": "growqr.test", "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.9" }),
}));
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF");
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);

describe("upload scanner", () => {
  it("passes plain documents", () => {
    expect(heuristics(PDF, "pdf")).toBeNull();
    expect(heuristics(PNG, "png")).toBeNull();
    expect(heuristics(zipSync({ "word/document.xml": strToU8("<w:document/>") }), "docx")).toBeNull();
  });
  it("blocks executables, test malware, scripts, active PDFs, fake images and macro documents", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(heuristics(enc("MZ\x90\x00 program"), "pdf")).toMatch(/Executable/);
    expect(heuristics(enc("#!/bin/sh\necho hi"), "pdf")).toMatch(/Executable/);
    expect(heuristics(enc("%PDF-1.4 X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST-FILE!"), "pdf")).toMatch(/Test malware/);
    expect(heuristics(enc("%PDF-1.4 <script>alert(1)</script>"), "pdf")).toMatch(/script/i);
    expect(heuristics(enc("%PDF-1.4 <?php system($_GET[1]); ?>"), "pdf")).toMatch(/script/i);
    expect(heuristics(enc("%PDF-1.4\n1 0 obj<</S /JavaScript /JS (app.alert(1))>>endobj"), "pdf")).toMatch(/active or embedded/);
    expect(heuristics(enc("not a pdf at all"), "pdf")).toMatch(/Not a valid PDF/);
    expect(heuristics(enc("GIF89a not an allowed image"), "png")).toMatch(/Not a valid image/);
    expect(heuristics(enc("plain text pretending to be a jpeg"), "jpg")).toMatch(/Not a valid image/);
    expect(heuristics(zipSync({ "word/vbaProject.bin": strToU8("x") }), "docx")).toMatch(/macros/);
    expect(heuristics(zipSync({ "evil.exe": strToU8("x") }), "docx")).toMatch(/macros or executable/);
    expect(heuristics(enc("this is not a zip"), "docx")).toMatch(/Not a valid Word/);
    expect(heuristics(new Uint8Array(0), "pdf")).toMatch(/could not be read/);
    expect(heuristics(zipSync({ "a.xml": new Uint8Array(30 * 1024 * 1024) }, { level: 9 }), "docx")).toMatch(/zip bomb/);
  });
});

const DB = process.env.PORTAL_TEST_DATABASE_URL;

describe.skipIf(!DB)("study abroad on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  const sEmail = `ab-s-${tag}@portal-test.invalid`;
  const cEmail = `ab-c-${tag}@portal-test.invalid`;
  let sid = 0;
  let cid = 0;
  let other = 0;
  let db: typeof import("../portal/db");
  let A: typeof import("./catalogue");
  let S: typeof import("./store");
  let V: typeof import("./vault");
  let C: typeof import("./counsel");
  let uniId = 0;
  let appId = 0;
  const profileInput = { level: "PG", field: "Computer Science & IT", score_type: "percentage", score_value: 78, english_test: "IELTS", english_score: 7, gre: 320, budget_inr: 3000000, countries: ["usa", "canada"], intake: "Fall 2027", goal: "Research in machine learning" };
  const audit = async () => undefined;

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.PORTAL_APP_URL = "https://growqr.test";
    process.env.STORAGE_DIR = path.join(process.env.TEMP ?? "/tmp", `abroad-test-${tag}`);
    delete process.env.RESEND_API_KEY;
    db = await import("../portal/db");
    A = await import("./catalogue");
    S = await import("./store");
    V = await import("./vault");
    C = await import("./counsel");
    await A.sync(JSON.parse(readFileSync(path.resolve(__dirname, "data/study-abroad.json"), "utf8")));
    const auth = await import("../portal/auth");
    const mk = async (email: string, role: "student") => {
      const r = await auth.register({ role, name: "Abroad " + tag, email, password: "blue-kettle-orbit-nine", college: "Test College" }, "198.51.100.94");
      if (!r.ok) throw new Error(r.error);
      return r.userId;
    };
    sid = await mk(sEmail, "student");
    other = await mk(`ab-o-${tag}@portal-test.invalid`, "student");
    cid = await mk(cEmail, "student");
    await db.run("UPDATE users SET role = 'counselor' WHERE id = $1", [cid]);
  });

  afterAll(async () => {
    if (!db) return;
    await db.run("DELETE FROM users WHERE email LIKE $1", [`%${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM mail_outbox WHERE to_email LIKE $1", [`%${tag}@portal-test.invalid`]);
    await db.run("DELETE FROM auth_throttle WHERE bucket = 'reg:198.51.100.94'");
    await db.run("DELETE FROM sa_audit WHERE actor_user_id IN ($1,$2,$3) OR subject_user_id IN ($1,$2,$3)", [sid, other, cid]);
    await db.closePool();
  });

  it("loads the catalogue and filters universities", async () => {
    const cs = await A.countries();
    expect(Object.keys(cs).length).toBeGreaterThanOrEqual(7);
    expect(cs.usa.tuition.mid).toBeGreaterThan(0);
    expect(await A.totalUniversities()).toBeGreaterThanOrEqual(58);
    const mit = await A.university("mit");
    expect(mit).toMatchObject({ band: 5, english_taught: true });
    expect(mit?.level_list).toEqual(["UG", "PG"]);
    uniId = mit!.id;
    expect((await A.universityById(uniId))?.slug).toBe("mit");
    expect((await A.universities({ country: "usa" })).every((u) => u.country_key === "usa")).toBe(true);
    expect((await A.universities({ type: "public" })).every((u) => u.type === "public")).toBe(true);
    expect((await A.universities({ level: "UG" })).every((u) => u.level_list.includes("UG"))).toBe(true); // the PHP version errors here on Postgres
    expect((await A.universities({ field: "Design & Arts" })).every((u) => u.fields.includes("Design & Arts"))).toBe(true);
    expect((await A.universities({ q: "massachusetts" })).map((u) => u.slug)).toContain("mit");
    const sel = await A.universities({ sort: "selective" });
    expect(sel[0].band).toBeGreaterThanOrEqual(sel[sel.length - 1].band);
    expect((await A.recommend({ ...profileInput, academic_index: 78, english_eq: 7, countries: "usa" }, cs, { country: "usa" })).every((u) => u.country_key === "usa")).toBe(true);
  });

  it("saves a profile only with consent and moves the stage", async () => {
    expect(await S.profile(sid)).toBeNull();
    await S.saveProfile(sid, profileInput, false);
    let p = await S.profile(sid);
    expect(p?.academic_index).toBe(78);
    expect(p?.english_eq).toBe(7);
    expect(S.isComplete(p)).toBe(false); // no consent yet
    expect(p?.stage).toBe("ONBOARDING");
    await S.saveProfile(sid, { ...profileInput, score_type: "cgpa10", score_value: 8.2 }, true);
    p = await S.profile(sid);
    expect(p?.academic_index).toBe(77.9);
    expect(p?.consent_version).toBe(S.CONSENT_VERSION);
    expect(S.isComplete(p)).toBe(true);
    expect(p?.country_list).toEqual(["usa", "canada"]);
    expect(p?.stage).toBe("DOC_COLLECTION");
    await S.saveProfile(sid, profileInput, false); // saving again never withdraws the consent
    expect(S.isComplete(await S.profile(sid))).toBe(true);
    expect((await S.historyFor(sid)).some((h) => h.to_status === "DOC_COLLECTION")).toBe(true);
  });

  it("shortlists and starts an application once", async () => {
    expect(await S.toggleShortlist(sid, uniId)).toBe(true);
    expect(await S.shortlistIds(sid)).toContain(uniId);
    expect(await S.toggleShortlist(sid, uniId)).toBe(false);
    expect(await S.toggleShortlist(sid, 2147483000)).toBe(false);
    expect(await S.createApplication(sid, 2147483000, "MS", "Fall")).toBe("University not found.");
    expect(await S.createApplication(sid, uniId, "ab", "Fall 2027")).toBe("Enter the program you want to apply for.");
    const id = await S.createApplication(sid, uniId, "MS Computer Science", "Fall 2027");
    expect(typeof id).toBe("number");
    appId = id as number;
    expect(await S.createApplication(sid, uniId, "MS again", "Fall 2027")).toBe("You already have an application for this university.");
    expect((await S.applications(sid))[0]).toMatchObject({ status: "draft", uni_slug: "mit", visa_done: [] });
  });

  it("keeps the vault safe: types, signature, size, scan, ownership", async () => {
    const f = (name: string, bytes: Uint8Array) => ({ name, size: bytes.length, bytes });
    expect(await V.upload(sid, "nope", f("a.pdf", PDF), audit)).toBe("Choose a document type.");
    expect(await V.upload(sid, "passport", f("a.exe", PDF), audit)).toMatch(/PDF, JPG, PNG or DOCX/);
    expect(await V.upload(sid, "passport", f("a.pdf", new TextEncoder().encode("MZ not a pdf")), audit)).toMatch(/PDF, JPG, PNG or DOCX/); // extension says pdf, bytes do not
    expect(await V.upload(sid, "passport", { name: "big.pdf", size: V.MAX_BYTES + 1, bytes: PDF }, audit)).toMatch(/too large/);
    const bad = new TextEncoder().encode("%PDF-1.4 /JavaScript (app.alert)");
    const audits: string[] = [];
    expect(await V.upload(sid, "passport", f("evil.pdf", bad), async (a) => void audits.push(a))).toMatch(/security check/);
    expect(audits).toEqual(["doc.blocked"]);
    expect(await V.missingRequired(sid)).toEqual(["passport", "transcripts", "sop"]);
    for (const t of ["passport", "transcripts"]) expect(typeof (await V.upload(sid, t, f("My Doc (1).pdf", PDF), audit))).toBe("number");
    expect(await V.missingRequired(sid)).toEqual(["sop"]);
    const docs = await V.forUser(sid);
    expect(docs).toHaveLength(2);
    expect(docs[0].stored_name).toMatch(/^[0-9a-f]{40}\.pdf$/);
    expect(docs[0].original_name).toBe("My Doc (1).pdf");
    expect(docs[0].scan_status).toBe("clean");
  });

  it("signs short-lived document links for one viewer", async () => {
    const d = (await V.forUser(sid))[0];
    const url = new URL("https://x" + (await V.link(d.id, sid)));
    const exp = Number(url.searchParams.get("exp"));
    const sig = url.searchParams.get("sig") as string;
    expect(await V.validLink(d.id, sid, exp, sig)).toBe(true);
    expect(await V.validLink(d.id, other, exp, sig)).toBe(false); // another viewer
    expect(await V.validLink(d.id + 1, sid, exp, sig)).toBe(false); // another document
    expect(await V.validLink(d.id, sid, exp, sig.replace(/.$/, "0"))).toBe(false);
    expect(await V.validLink(d.id, sid, exp - 1000, sig)).toBe(false); // expired
    expect(await V.validLink(d.id, sid, exp + 1000, sig)).toBe(false); // too far ahead
  });

  it("will not submit until profile, English score and documents are in place", async () => {
    expect(await S.submitForReview(other, appId)).toBe("Application not found."); // somebody else's
    expect(await S.submitForReview(sid, appId)).toMatch(/Upload these required documents first: statement of purpose/);
    const sop = await V.upload(sid, "sop", { name: "sop.pdf", size: PDF.length, bytes: PDF }, audit);
    expect(typeof sop).toBe("number");
    expect(await S.submitForReview(sid, appId)).toBeNull();
    expect((await S.application(appId))?.status).toBe("in_review");
    expect((await S.profile(sid))?.stage).toBe("IN_REVIEW");
    expect(await S.submitForReview(sid, appId)).toMatch(/already with our team/);
  });

  it("lets only the assigned counselor act, and enforces the pipeline", async () => {
    const counselor = { id: cid, role: "counselor" };
    expect(await C.canAccess(counselor, sid)).toBe(false);
    expect(await C.canAccess({ id: other, role: "student" }, sid)).toBe(false);
    expect(await C.canAccess({ id: 1, role: "admin" }, sid)).toBe(true);
    expect((await C.unassigned(500)).some((r) => r.user_id === sid)).toBe(true);
    expect(await C.assign(sid, other, 1)).toBe("Choose a valid counselor.");
    expect(await C.claim(cid, sid)).toBeNull();
    expect(await C.claim(cid, sid)).toMatch(/taken by someone else/);
    expect(await C.canAccess(counselor, sid)).toBe(true);
    expect((await C.counselorOf(sid))?.id).toBe(cid);
    expect(await C.addNote(sid, cid, "  ")).toBe("Write a note first.");
    expect(await C.addNote(sid, cid, "Strong profile.")).toBeNull();
    expect((await C.notes(sid))[0].body).toBe("Strong profile.");
    expect((await C.caseload(cid))[0]).toMatchObject({ user_id: sid, apps_review: 1 });

    expect(await S.adminMove(appId, "offer", cid)).toMatch(/not allowed from "in_review"/);
    expect(await S.adminMove(appId, "draft", cid, "  ")).toMatch(/explaining what/);
    expect(await S.adminMove(appId, "applied", cid)).toMatch(/Verify these required documents first/);
    for (const d of await V.forUser(sid)) expect(await C.reviewDoc(cid, d.id, true, "")).toBeNull();
    expect(await C.reviewDoc(cid, 2147483000, true, "")).toBe("Document not found.");
    expect(await V.unverifiedRequired(sid)).toEqual([]);
    expect(await S.adminMove(appId, "applied", cid)).toBeNull();
    expect((await S.profile(sid))?.stage).toBe("APPLIED");
    expect(await S.adminMove(appId, "offer", cid, "Scholarship included", "maybe")).toMatch(/conditional or unconditional/);
    expect(await S.adminMove(appId, "offer", cid, "Scholarship included", "conditional")).toBeNull();
    expect((await S.profile(sid))?.stage).toBe("OFFER_RECEIVED");
    expect((await S.application(appId))).toMatchObject({ status: "offer", offer_type: "conditional", offer_note: "Scholarship included" });
  });

  it("lets the student answer an offer, then tick visa steps", async () => {
    expect(await S.answerOffer(other, appId, true)).toBe("There is no offer to answer.");
    expect(await S.toggleVisaItem(sid, appId, 0)).toBe(false); // not accepted yet
    expect(await S.answerOffer(sid, appId, true)).toBeNull();
    expect((await S.profile(sid))?.stage).toBe("VISA_PREP");
    expect(await S.toggleVisaItem(sid, appId, 2)).toBe(true);
    expect(await S.toggleVisaItem(sid, appId, 0)).toBe(true);
    expect((await S.application(appId))?.visa_done).toEqual([0, 2]);
    expect(await S.toggleVisaItem(sid, appId, 2)).toBe(true);
    expect((await S.application(appId))?.visa_done).toEqual([0]);
    expect(await S.toggleVisaItem(other, appId, 1)).toBe(false);
    expect(await S.markAlumni(other, 1)).toMatch(/visa stage/);
    expect(await S.markAlumni(sid, 1)).toBeNull();
    expect((await S.profile(sid))?.stage).toBe("ALUMNI");
    await S.saveProfile(sid, profileInput, false);
    expect((await S.profile(sid))?.stage).toBe("ALUMNI"); // never moves back
  });

  it("emails the student about each decision and writes an audit trail", async () => {
    const kinds = (await db.all<{ kind: string }>("SELECT kind FROM mail_outbox WHERE to_email = $1", [sEmail])).map((m) => m.kind);
    for (const k of ["abroad_applied", "abroad_offer", "abroad_doc_ok", "abroad_counselor"]) expect(kinds, k).toContain(k);
    const actions = (await db.all<{ action: string }>("SELECT action FROM sa_audit WHERE subject_user_id = $1", [sid])).map((a) => a.action);
    for (const a of ["profile.create", "application.create", "application.submit", "doc.verify", "application.applied", "counselor.claim", "offer.accepted", "stage.alumni"]) expect(actions, a).toContain(a);
    const row = await db.one<{ ip_hash: string }>("SELECT ip_hash FROM sa_audit WHERE subject_user_id = $1 LIMIT 1", [sid]);
    expect(row?.ip_hash).toMatch(/^[0-9a-f]{16}$/); // only a hash of the IP is kept
    expect(await V.remove(other, (await V.forUser(sid))[0].id)).toBe(false);
    expect(await V.remove(sid, (await V.forUser(sid))[0].id)).toBe(true);
    expect(await V.deleteAllFor(sid)).toBe(2);
  });
});
