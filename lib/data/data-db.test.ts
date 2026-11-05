import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The marketing data layer (query builder, database functions, signed file links) on a real MySQL / MariaDB database.
 *
 *   PORTAL_TEST_DATABASE_URL=mysql://root@127.0.0.1:3307/growqr_test npx vitest run lib/data/data-db.test.ts
 */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const DB = process.env.PORTAL_TEST_DATABASE_URL;

describe.skipIf(!DB)("marketing data layer on a real database", () => {
  const tag = Math.random().toString(16).slice(2, 8);
  let db: typeof import("../portal/db");
  let sb: ReturnType<typeof import("./server").createAdminClient>;
  let signed: typeof import("./storage");

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    const { runPortalMigrations } = await import("../portal/migrate");
    await runPortalMigrations(DB as string);
    db = await import("../portal/db");
    sb = (await import("./server")).createAdminClient();
    signed = await import("./storage");
  });

  afterAll(async () => {
    await db.run("DELETE FROM seeker_waitlist WHERE email LIKE $1", [`%${tag}@data-test.invalid`]);
    await db.run("DELETE FROM contact_messages WHERE email LIKE $1", [`%${tag}@data-test.invalid`]);
    await db.run("DELETE FROM internship_applications WHERE email LIKE $1", [`%${tag}@data-test.invalid`]);
    await db.run("DELETE FROM call_bookings WHERE cal_uid LIKE $1", [`${tag}-%`]);
    await db.run("DELETE FROM bot_leads WHERE conversation_id LIKE $1", [`${tag}-%`]);
    await db.run("DELETE FROM bot_visitors WHERE avuid LIKE $1", [`${tag}-%`]);
    await db.run("DELETE FROM bot_messages WHERE conversation_id LIKE $1", [`${tag}-%`]);
    await db.closePool();
  });

  it("inserts, reads back and counts, with auto ids and plain JS values", async () => {
    const email = `a-${tag}@data-test.invalid`;
    const ins = await sb.from("seeker_waitlist").insert({ email, source: "test" }).select().single();
    expect(ins.error).toBeNull();
    expect(ins.data?.email).toBe(email);
    expect(typeof ins.data?.id).toBe("number");
    expect(ins.data?.crm_sync_status).toBe("pending");
    expect(ins.data?.crm_sync_attempts).toBe(0);
    expect(new Date(ins.data!.created_at).getTime()).toBeGreaterThan(Date.now() - 60_000); // an ISO string in UTC, not shifted by the zone

    const list = await sb.from("seeker_waitlist").select("id, email", { count: "exact" }).like("email", `%${tag}@data-test.invalid`);
    expect(list.count).toBe(1);
    const head = await sb.from("seeker_waitlist").select("id", { count: "exact", head: true }).like("email", `%${tag}@data-test.invalid`);
    expect(head.count).toBe(1);
    expect(head.data).toBeNull();
  });

  it("reports a duplicate as 23505 and names the key, as the routes expect", async () => {
    const email = `dup-${tag}@data-test.invalid`;
    expect((await sb.from("seeker_waitlist").insert({ email })).error).toBeNull();
    const again = await sb.from("seeker_waitlist").insert({ email });
    expect(again.error?.code).toBe("23505");
    expect(again.error?.message).toContain("seeker_waitlist_email_key");
  });

  it("stores true/false, JSON and uuids, and filters with in / or / is / order / range", async () => {
    const mk = (n: number) => ({ name: `N${n}`, email: `c${n}-${tag}@data-test.invalid`, message: `m${n}`, read: n === 2 });
    const r = await sb.from("contact_messages").insert([mk(1), mk(2), mk(3)]).select();
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(3);
    expect(r.data![0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.data!.find((x) => x.name === "N2")!.read).toBe(true);
    expect(r.data!.find((x) => x.name === "N1")!.read).toBe(false);

    const like = `%${tag}@data-test.invalid`;
    const some = await sb.from("contact_messages").select("name").like("email", like).in("name", ["N1", "N3"]).order("name", { ascending: false });
    expect(some.data?.map((x) => x.name)).toEqual(["N3", "N1"]);
    const either = await sb.from("contact_messages").select("name").like("email", like).or('name.eq.N1,message.ilike."%3%"').order("name");
    expect(either.data?.map((x) => x.name)).toEqual(["N1", "N3"]);
    const unread = await sb.from("contact_messages").select("name").like("email", like).eq("read", false).order("name");
    expect(unread.data).toHaveLength(2);
    const page = await sb.from("contact_messages").select("name").like("email", like).order("name").range(1, 1);
    expect(page.data?.map((x) => x.name)).toEqual(["N2"]);
    const nul = await sb.from("contact_messages").select("name").like("email", like).is("zoho_lead_id", null);
    expect(nul.data).toHaveLength(3);
  });

  it("updates and returns rows, claims exclusively, and deletes", async () => {
    const email = `u-${tag}@data-test.invalid`;
    await sb.from("seeker_waitlist").insert({ email });
    const claim = await sb.from("seeker_waitlist").update({ crm_sync_status: "syncing" }).eq("email", email).in("crm_sync_status", ["pending", "failed"]).select().maybeSingle();
    expect(claim.data?.crm_sync_status).toBe("syncing");
    const second = await sb.from("seeker_waitlist").update({ crm_sync_status: "syncing" }).eq("email", email).in("crm_sync_status", ["pending", "failed"]).select().maybeSingle();
    expect(second.error).toBeNull();
    expect(second.data).toBeNull(); // someone else already holds it

    const when = "2026-03-04T05:06:07.000Z";
    await sb.from("seeker_waitlist").update({ crm_synced_at: when }).eq("email", email);
    const back = await sb.from("seeker_waitlist").select("crm_synced_at").eq("email", email).single();
    expect(back.data?.crm_synced_at).toBe(when);

    const gone = await sb.from("seeker_waitlist").delete().eq("email", email).select();
    expect(gone.data).toHaveLength(1);
    expect((await sb.from("seeker_waitlist").select("id").eq("email", email)).data).toHaveLength(0);
    expect((await sb.from("seeker_waitlist").update({ source: "x" })).error).not.toBeNull(); // no filter, no update
  });

  it("upserts on a key and keeps the check rules", async () => {
    const email = `up-${tag}@data-test.invalid`;
    const a = await sb.from("seeker_waitlist").upsert({ email, source: "one" }, { onConflict: "email" });
    expect(a.error).toBeNull();
    await sb.from("seeker_waitlist").upsert({ email, source: "two" }, { onConflict: "email" });
    const rows = await sb.from("seeker_waitlist").select("source").eq("email", email);
    expect(rows.data).toEqual([{ source: "two" }]);
    const bad = await sb.from("seeker_waitlist").update({ crm_sync_status: "nonsense" }).eq("email", email);
    expect(bad.error?.code).toBe("23514");
    const settings = await sb.from("internship_settings").upsert({ id: true, shortlist_min_rq: 55 }, { onConflict: "id" });
    expect(settings.error).toBeNull();
    const s = await sb.from("internship_settings").select("*").eq("id", true).single();
    expect(s.data?.shortlist_min_rq).toBe(55);
    expect(s.data?.interview_round_by_role).toEqual({});
    expect(s.data?.auto_assign_enabled).toBe(true);
    await sb.from("internship_settings").update({ shortlist_min_rq: 50 }).eq("id", true);
  });

  it("applies a Cal.com booking: new, stale, redelivered and rescheduled", async () => {
    const uid = `${tag}-a`;
    const booking = { email: `cal-${tag}@data-test.invalid`, attendee_name: "Cal Person", start_time: "2026-09-01T10:00:00Z", end_time: "2026-09-01T10:30:00Z", last_trigger_event: "BOOKING_CREATED", status: "booked", utm_source: "ads", is_disposable_email: false, responses: { a: 1 }, raw_payload: { b: 2 } };
    const first = await sb.rpc("apply_cal_booking", { p_cal_uid: uid, p_event_at: "2026-08-01T00:00:00Z", p_booking: booking as never }).single();
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ applied: true, is_new: true, events_count: 1, status: "booked" });

    const stale = await sb.rpc("apply_cal_booking", { p_cal_uid: uid, p_event_at: "2026-07-01T00:00:00Z", p_booking: { ...booking, status: "cancelled" } as never }).single();
    expect(stale.data).toMatchObject({ applied: false, is_new: false, events_count: 1, status: "booked" });

    const cancel = await sb.rpc("apply_cal_booking", { p_cal_uid: uid, p_event_at: "2026-08-02T00:00:00Z", p_booking: { ...booking, status: "cancelled", utm_source: "other" } as never }).single();
    expect(cancel.data).toMatchObject({ applied: true, is_new: false, events_count: 2, status: "cancelled" });
    const row = await sb.from("call_bookings").select("*").eq("cal_uid", uid).single();
    expect(row.data?.utm_source).toBe("ads"); // first touch wins
    expect(row.data?.responses).toEqual({ a: 1 });
    expect(row.data?.start_time).toBe("2026-09-01T10:00:00.000Z");
    expect(row.data?.zoho_notes_pending).toBe(true); // generated column: notes owed

    const moved = `${tag}-b`;
    const re = await sb.rpc("apply_cal_booking", { p_cal_uid: moved, p_event_at: "2026-08-03T00:00:00Z", p_booking: { ...booking, status: "rescheduled", start_time: "2026-09-05T10:00:00Z" } as never, p_supersedes: uid }).single();
    expect(re.data).toMatchObject({ applied: true, is_new: false, events_count: 3, status: "rescheduled" });
    expect((await sb.from("call_bookings").select("id").in("cal_uid", [uid, moved])).data).toHaveLength(1); // one row per logical booking
  });

  it("tracks bot visitors and matches leads by email, device and conversation", async () => {
    const av = `${tag}-dev`;
    const v1 = await sb.rpc("touch_bot_visitor", { p_avuid: av, p_conversation_id: `${tag}-c1`, p_page_path: "/pricing" }).single();
    expect(v1.data).toMatchObject({ visits: 1 });
    const v2 = await sb.rpc("touch_bot_visitor", { p_avuid: av, p_conversation_id: `${tag}-c1` }).single();
    expect(v2.data?.visits).toBe(1); // same conversation is not a new visit
    const v3 = await sb.rpc("touch_bot_visitor", { p_avuid: av, p_conversation_id: `${tag}-c2` }).single();
    expect(v3.data?.visits).toBe(2);

    const one = await sb.rpc("resolve_bot_lead", { p_conversation_id: `${tag}-c1`, p_avuid: av, p_intent: "demo_request", p_email: `bot-${tag}@data-test.invalid`, p_name: "Bot Lead" }).single();
    expect(one.data).toMatchObject({ matched_on: "new", visits: 1, requeued: true });
    const two = await sb.rpc("resolve_bot_lead", { p_conversation_id: `${tag}-c2`, p_avuid: av, p_intent: "general_inquiry" }).single();
    expect(two.data).toMatchObject({ lead_id: one.data!.lead_id, matched_on: "avuid", visits: 2 });
    const lead = await sb.from("bot_leads").select("*").eq("id", one.data!.lead_id).single();
    expect(lead.data?.intent).toBe("demo_request"); // a vague later turn does not water down a real intent
    expect(lead.data?.conversation_ids).toEqual([`${tag}-c1`, `${tag}-c2`]);
    const byConv = await sb.from("bot_leads").select("id").or(`conversation_id.eq.${tag}-c2,conversation_ids.cs.{${tag}-c2}`);
    expect(byConv.data).toHaveLength(1);
  });

  it("claims idle chat transcripts", async () => {
    const conv = `${tag}-c1`;
    await sb.from("bot_leads").update({ zoho_lead_id: "Z1" }).eq("conversation_id", conv);
    await db.run("INSERT INTO bot_messages (conversation_id, role, content, created_at) VALUES ($1, 'visitor', 'hello', NOW() - INTERVAL 2 HOUR)", [conv]);
    const idle = await sb.rpc("claim_idle_transcripts", { p_idle_minutes: 20, p_limit: 50 });
    expect(idle.error).toBeNull();
    expect(idle.data?.some((r) => r.conversation_id === conv && r.zoho_lead_id === "Z1")).toBe(true);
    const none = await sb.rpc("claim_idle_transcripts", { p_idle_minutes: 600, p_limit: 50 });
    expect(none.data?.some((r) => r.conversation_id === conv)).toBe(false);
  });

  it("counts applications by status", async () => {
    const base = { college: "C College", course: "BTech", graduation_year: "2027", preferred_role: "Analyst", skills: "sql, excel", availability: "immediately", resume: "r.pdf", why_intern: "I want to learn how teams ship.", phone: `+91${tag}0001`, full_name: "Test Applicant", email: `app-${tag}@data-test.invalid` };
    expect((await sb.from("internship_applications").insert(base)).error).toBeNull();
    const counts = await sb.rpc("admin_internship_status_counts");
    expect(counts.data?.find((r) => r.status === "new")!.total).toBeGreaterThanOrEqual(1);
    const dup = await sb.from("internship_applications").insert({ ...base, email: `app2-${tag}@data-test.invalid` });
    expect(dup.error?.code).toBe("23505");
    expect(dup.error?.message).toContain("_phone_key");
  });

  it("signs file links that expire and cannot be reused for another file", async () => {
    process.env.PORTAL_APP_URL = "https://app.test";
    const { data } = await sb.storage.from("resumes").createSignedUrl(`${tag}-r.pdf`, 3600);
    const u = new URL(data!.signedUrl);
    expect(u.origin + u.pathname).toBe(`https://app.test/api/files/resumes/${tag}-r.pdf`);
    expect(await signed.verifySignedFile("resumes", `${tag}-r.pdf`, u.searchParams.get("exp"), u.searchParams.get("sig"))).toBe(true);
    expect(await signed.verifySignedFile("resumes", `${tag}-other.pdf`, u.searchParams.get("exp"), u.searchParams.get("sig"))).toBe(false);
    expect(await signed.verifySignedFile("resumes", `${tag}-r.pdf`, String(Math.floor(Date.now() / 1000) - 10), u.searchParams.get("sig"))).toBe(false);
  });
});
