import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, prisma, request, resetDb } from "./helpers.js";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n, hourUtc = 14) => {
  const d = new Date(Date.now() + n * DAY);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
};

let alice;
let bob;
let app; // alice's APPLIED application

const createApp = (owner, body = {}) =>
  request
    .post("/api/v1/applications")
    .set("Cookie", owner.cookie)
    .send({ company: "Stripe", jobTitle: "Frontend Engineer", employmentType: "REMOTE", status: "APPLIED", ...body })
    .then((r) => r.body.data.application);

const schedule = (applicationId, body = {}, owner = alice) =>
  request
    .post(`/api/v1/applications/${applicationId}/interviews`)
    .set("Cookie", owner.cookie)
    .send({ title: "Technical round", type: "VIDEO", startsAt: inDays(3), ...body });

const list = (query = {}, owner = alice) => request.get("/api/v1/interviews").query(query).set("Cookie", owner.cookie);
const titles = (res) => res.body.data.map((i) => i.title);

beforeEach(async () => {
  await resetDb();
  alice = await createUser({ timezone: "Europe/London" });
  bob = await createUser();
  app = await createApp(alice);
});

afterAll(() => prisma.$disconnect());

describe("POST /applications/:id/interviews", () => {
  it("creates with defaults and suggests moving the application to INTERVIEW", async () => {
    const res = await schedule(app.id);
    expect(res.status).toBe(201);
    expect(res.body.data.suggestedStatus).toBe("INTERVIEW");
    expect(res.body.data.interview).toMatchObject({
      title: "Technical round",
      durationMinutes: 60,
      timezone: "Europe/London", // from the user's profile
      outcome: "PENDING",
      application: { id: app.id, company: "Stripe", status: "APPLIED" },
    });
  });

  it("does not change the application's status by itself", async () => {
    await schedule(app.id);
    const res = await request.get(`/api/v1/applications/${app.id}`).set("Cookie", alice.cookie);
    expect(res.body.data.application.status).toBe("APPLIED");
  });

  it.each(["INTERVIEW", "OFFER", "REJECTED"])("does not suggest a status change when the application is %s", async (status) => {
    const other = await createApp(alice, { status });
    expect((await schedule(other.id)).body.data.suggestedStatus).toBeNull();
  });

  it("keeps an explicit timezone and optional details", async () => {
    const res = await schedule(app.id, {
      timezone: "America/New_York",
      durationMinutes: 45,
      meetingUrl: "https://meet.example.com/abc",
      interviewerName: "Jane Doe",
      interviewerEmail: "jane@example.com",
      location: "",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.interview).toMatchObject({ timezone: "America/New_York", durationMinutes: 45, location: null });
  });

  it.each([
    ["missing title", { title: "" }, "title"],
    ["unknown type", { type: "COFFEE" }, "type"],
    ["start time without offset", { startsAt: "2026-11-10T14:00:00" }, "startsAt"],
    ["non-http meeting link", { meetingUrl: "javascript:alert(1)" }, "meetingUrl"],
    ["bad interviewer email", { interviewerEmail: "not-an-email" }, "interviewerEmail"],
    ["too short", { durationMinutes: 2 }, "durationMinutes"],
    ["unknown timezone", { timezone: "Mars/Base" }, "timezone"],
    ["unknown field", { userId: "x" }, ""],
  ])("rejects %s", async (_label, body, path) => {
    const res = await schedule(app.id, body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(path);
  });

  it("returns 404 for another user's application", async () => {
    expect((await schedule(app.id, {}, bob)).status).toBe(404);
  });
});

describe("GET /interviews", () => {
  beforeEach(async () => {
    await schedule(app.id, { title: "Past 1", startsAt: inDays(-10) });
    await schedule(app.id, { title: "Past 2", startsAt: inDays(-2), outcome: "PASSED" });
    await schedule(app.id, { title: "Soon", startsAt: inDays(1) });
    await schedule(app.id, { title: "Later", startsAt: inDays(7), outcome: "CANCELLED" });
    const bobApp = await createApp(bob);
    await schedule(bobApp.id, { title: "Bob's" }, bob);
  });

  it("lists the user's interviews soonest first, with the application summary", async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(titles(res)).toEqual(["Past 1", "Past 2", "Soon", "Later"]);
    expect(res.body.data[0].application).toEqual({ id: app.id, company: "Stripe", jobTitle: "Frontend Engineer", status: "APPLIED" });
    expect(res.body.meta.total).toBe(4);
  });

  it("splits upcoming (soonest first) and past (most recent first)", async () => {
    expect(titles(await list({ when: "upcoming" }))).toEqual(["Soon", "Later"]);
    expect(titles(await list({ when: "past" }))).toEqual(["Past 2", "Past 1"]);
  });

  it("filters by outcome", async () => {
    expect(titles(await list({ outcome: "PASSED,CANCELLED" }))).toEqual(["Past 2", "Later"]);
  });

  it("filters by a date range, where a date-only `to` includes that whole day", async () => {
    const day = inDays(1).slice(0, 10);
    expect(titles(await list({ from: day, to: day }))).toEqual(["Soon"]);
    expect(titles(await list({ from: inDays(-3), to: inDays(2) }))).toEqual(["Past 2", "Soon"]);
  });

  it("combines `when` with a range", async () => {
    expect(titles(await list({ when: "upcoming", to: inDays(3).slice(0, 10) }))).toEqual(["Soon"]);
  });

  it("paginates", async () => {
    const res = await list({ limit: 3, page: 2 });
    expect(titles(res)).toEqual(["Later"]);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 3, total: 4, totalPages: 2 });
  });

  it.each([[{ when: "soon" }], [{ from: "next week" }], [{ from: "2026-11-10", to: "2026-11-01" }], [{ outcome: "WON" }]])(
    "rejects invalid query %j",
    async (query) => {
      expect((await list(query)).status).toBe(400);
    },
  );

  it("lists interviews for one application", async () => {
    const res = await request.get(`/api/v1/applications/${app.id}/interviews`).set("Cookie", alice.cookie);
    expect(res.body.data.map((i) => i.title)).toEqual(["Past 1", "Past 2", "Soon", "Later"]);
    expect((await request.get(`/api/v1/applications/${app.id}/interviews`).set("Cookie", bob.cookie)).status).toBe(404);
  });
});

describe("GET / PATCH / DELETE /interviews/:id", () => {
  let interview;
  beforeEach(async () => {
    interview = (await schedule(app.id)).body.data.interview;
  });

  it("gets one interview", async () => {
    const res = await request.get(`/api/v1/interviews/${interview.id}`).set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.interview.id).toBe(interview.id);
  });

  it("records the outcome and feedback", async () => {
    const res = await request
      .patch(`/api/v1/interviews/${interview.id}`)
      .set("Cookie", alice.cookie)
      .send({ outcome: "PASSED", feedbackNotes: "Went well" });
    expect(res.status).toBe(200);
    expect(res.body.data.interview).toMatchObject({ outcome: "PASSED", feedbackNotes: "Went well" });
  });

  it("rejects an empty update", async () => {
    expect((await request.patch(`/api/v1/interviews/${interview.id}`).set("Cookie", alice.cookie).send({})).status).toBe(400);
  });

  it("deletes", async () => {
    expect((await request.delete(`/api/v1/interviews/${interview.id}`).set("Cookie", alice.cookie)).status).toBe(204);
    expect((await request.get(`/api/v1/interviews/${interview.id}`).set("Cookie", alice.cookie)).status).toBe(404);
  });

  it("hides other users' interviews", async () => {
    const url = `/api/v1/interviews/${interview.id}`;
    expect((await request.get(url).set("Cookie", bob.cookie)).status).toBe(404);
    expect((await request.patch(url).set("Cookie", bob.cookie).send({ outcome: "FAILED" })).status).toBe(404);
    expect((await request.delete(url).set("Cookie", bob.cookie)).status).toBe(404);
  });

  it("is deleted with its application", async () => {
    await request.delete(`/api/v1/applications/${app.id}`).set("Cookie", alice.cookie);
    expect(await prisma.interview.count({ where: { id: interview.id } })).toBe(0);
  });
});
