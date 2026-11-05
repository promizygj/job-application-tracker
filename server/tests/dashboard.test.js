import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, prisma, request, resetDb } from "./helpers.js";

const DAY = 24 * 60 * 60 * 1000;
const ymd = (d) => d.toISOString().slice(0, 10);
const todayIn = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
/** Monday (YYYY-MM-DD) of the week containing `dateStr`. */
const mondayOf = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return ymd(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY));
};
const addDays = (dateStr, n) => ymd(new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * DAY));

let alice;
let bob;

const createApp = (body, owner = alice) =>
  request
    .post("/api/v1/applications")
    .set("Cookie", owner.cookie)
    .send({ jobTitle: "Engineer", employmentType: "REMOTE", ...body })
    .then((r) => r.body.data.application);

const setStatus = (id, status, owner = alice) =>
  request.patch(`/api/v1/applications/${id}`).set("Cookie", owner.cookie).send({ status });

const get = (path, owner = alice) => request.get(`/api/v1/dashboard${path}`).set("Cookie", owner.cookie);

const addInterview = (owner, applicationId, startsAt, extra = {}) =>
  prisma.interview.create({
    data: { userId: owner.user.id, applicationId, title: "Round", type: "VIDEO", startsAt: new Date(startsAt), ...extra },
  });

beforeEach(async () => {
  await resetDb();
  alice = await createUser();
  bob = await createUser();
});

afterAll(() => prisma.$disconnect());

describe("GET /dashboard/summary", () => {
  it("returns zeros and null rates for a new user", async () => {
    const res = await get("/summary");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      total: 0,
      byStatus: { SAVED: 0, APPLIED: 0, ASSESSMENT: 0, INTERVIEW: 0, OFFER: 0, REJECTED: 0, WITHDRAWN: 0 },
      counts: { applied: 0, responded: 0, interviewed: 0, offered: 0, rejected: 0 },
      rates: { response: null, interview: null, offer: null, rejection: null },
      upcomingInterviews: [],
      recentApplications: [],
    });
  });

  it("computes counts and rates from the status history", async () => {
    await createApp({ company: "Saved only" }); // never applied
    await createApp({ company: "Applied", status: "APPLIED" });
    const rejectedAfterInterview = await createApp({ company: "Interview then rejected", status: "APPLIED" });
    await setStatus(rejectedAfterInterview.id, "INTERVIEW");
    await setStatus(rejectedAfterInterview.id, "REJECTED");
    await createApp({ company: "Offer", status: "OFFER" });
    const withdrawnFromSaved = await createApp({ company: "Withdrawn before applying" });
    await setStatus(withdrawnFromSaved.id, "WITHDRAWN");
    await createApp({ company: "Bob's", status: "OFFER" }, bob);

    const { data } = (await get("/summary")).body;
    expect(data.total).toBe(5);
    expect(data.byStatus).toEqual({ SAVED: 1, APPLIED: 1, ASSESSMENT: 0, INTERVIEW: 0, OFFER: 1, REJECTED: 1, WITHDRAWN: 1 });
    // Applied = 3 (Applied, Interview→Rejected, Offer). Saved and Saved→Withdrawn don't count.
    expect(data.counts).toEqual({ applied: 3, responded: 2, interviewed: 1, offered: 1, rejected: 1 });
    expect(data.rates).toEqual({ response: 0.6667, interview: 0.3333, offer: 0.3333, rejection: 0.3333 });
  });

  it("lists the next 5 pending interviews and the 5 newest applications", async () => {
    const apps = [];
    for (let i = 1; i <= 7; i++) apps.push(await createApp({ company: `C${i}`, status: "INTERVIEW" }));
    const now = Date.now();
    await addInterview(alice, apps[0].id, now - DAY); // past
    await addInterview(alice, apps[1].id, now + DAY, { outcome: "CANCELLED" });
    for (let i = 2; i <= 7; i++) await addInterview(alice, apps[i - 1].id, now + i * DAY, { title: `Upcoming ${i}` });

    const { data } = (await get("/summary")).body;
    expect(data.upcomingInterviews.map((i) => i.title)).toEqual(["Upcoming 2", "Upcoming 3", "Upcoming 4", "Upcoming 5", "Upcoming 6"]);
    expect(data.upcomingInterviews[0].application).toEqual({ id: apps[1].id, company: "C2", jobTitle: "Engineer" });
    expect(data.recentApplications.map((a) => a.company)).toEqual(["C7", "C6", "C5", "C4", "C3"]);
  });
});

describe("GET /dashboard/funnel", () => {
  it("matches the summary counts", async () => {
    const a = await createApp({ company: "A", status: "APPLIED" });
    await setStatus(a.id, "INTERVIEW");
    await createApp({ company: "B", status: "APPLIED" });
    const res = await get("/funnel");
    expect(res.body.data).toEqual([
      { stage: "APPLIED", count: 2 },
      { stage: "INTERVIEW", count: 1 },
      { stage: "OFFER", count: 0 },
    ]);
  });
});

describe("GET /dashboard/activity", () => {
  it("returns 12 Monday-based weeks by default, oldest first, ending with the current week", async () => {
    const res = await get("/activity");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(12);
    const thisMonday = mondayOf(todayIn("UTC"));
    expect(res.body.data.at(-1)).toEqual({ weekStart: thisMonday, applied: 0, interviews: 0 });
    expect(res.body.data[0].weekStart).toBe(addDays(thisMonday, -77));
  });

  it("buckets applications by appliedAt and interviews by start time, excluding cancelled", async () => {
    const thisMonday = mondayOf(todayIn("UTC"));
    const app = await createApp({ company: "This week", status: "APPLIED", appliedAt: thisMonday });
    await createApp({ company: "Last week", status: "APPLIED", appliedAt: addDays(thisMonday, -3) });
    await createApp({ company: "Too old", status: "APPLIED", appliedAt: addDays(thisMonday, -200) });
    await addInterview(alice, app.id, `${thisMonday}T12:00:00Z`);
    await addInterview(alice, app.id, `${thisMonday}T15:00:00Z`, { outcome: "CANCELLED" });

    const weeks = (await get("/activity?weeks=2")).body.data;
    expect(weeks).toEqual([
      { weekStart: addDays(thisMonday, -7), applied: 1, interviews: 0 },
      { weekStart: thisMonday, applied: 1, interviews: 1 },
    ]);
  });

  it("uses the user's timezone for interview weeks", async () => {
    const tokyo = await createUser({ timezone: "Asia/Tokyo" });
    const tokyoMonday = mondayOf(todayIn("Asia/Tokyo"));
    // Sunday 20:00 UTC = Monday 05:00 in Tokyo.
    const instant = `${addDays(tokyoMonday, -1)}T20:00:00Z`;
    const tokyoApp = await createApp({ company: "T", status: "INTERVIEW" }, tokyo);
    await addInterview(tokyo, tokyoApp.id, instant);

    const weeks = (await get("/activity?weeks=2", tokyo)).body.data;
    expect(weeks.at(-1)).toMatchObject({ weekStart: tokyoMonday, interviews: 1 });
    expect(weeks[0].interviews).toBe(0);
  });

  it.each(["0", "53", "abc"])("rejects weeks=%s", async (weeks) => {
    expect((await get(`/activity?weeks=${weeks}`)).status).toBe(400);
  });

  it("requires a session", async () => {
    expect((await request.get("/api/v1/dashboard/summary")).status).toBe(401);
  });
});
