import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, prisma, request, resetDb } from "./helpers.js";

const BASE = "/api/v1/applications";
const todayUtc = () => new Date().toISOString().slice(0, 10);
const dateOnly = (iso) => iso?.slice(0, 10);

let alice; // { user, cookie }
let bob;

const create = (owner, body) => request.post(BASE).set("Cookie", owner.cookie).send(body);
const minimal = (extra = {}) => ({ company: "Stripe", jobTitle: "Frontend Engineer", employmentType: "REMOTE", ...extra });

beforeEach(async () => {
  await resetDb();
  alice = await createUser();
  bob = await createUser();
});

afterAll(() => prisma.$disconnect());

describe("auth", () => {
  it("rejects requests without a session", async () => {
    const res = await request.get(BASE);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects a session whose sessionVersion was bumped (logout-all)", async () => {
    await prisma.user.update({ where: { id: alice.user.id }, data: { sessionVersion: { increment: 1 } } });
    const res = await request.get(BASE).set("Cookie", alice.cookie);
    expect(res.status).toBe(401);
  });
});

describe("POST /applications", () => {
  it("creates with defaults, first Kanban position and an initial history entry", async () => {
    const res = await create(alice, minimal());
    expect(res.status).toBe(201);
    const app = res.body.data.application;
    expect(app).toMatchObject({ company: "Stripe", status: "SAVED", priority: "MEDIUM", position: 1000, appliedAt: null });

    const history = await request.get(`${BASE}/${app.id}/history`).set("Cookie", alice.cookie);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({ fromStatus: null, toStatus: "SAVED" });
  });

  it("appends to the end of the status column", async () => {
    await create(alice, minimal());
    const second = await create(alice, minimal({ company: "Monzo" }));
    expect(second.body.data.application.position).toBe(2000);
  });

  it("sets appliedAt to today when created as APPLIED without a date", async () => {
    const res = await create(alice, minimal({ status: "APPLIED" }));
    expect(dateOnly(res.body.data.application.appliedAt)).toBe(todayUtc());
  });

  it("keeps an explicit appliedAt and normalises optional fields", async () => {
    const res = await create(
      alice,
      minimal({ status: "APPLIED", appliedAt: "2026-10-01", salaryCurrency: "eur", salaryMin: 50000, salaryMax: 60000, notes: "", jobUrl: "" }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.application).toMatchObject({ salaryCurrency: "EUR", notes: null, jobUrl: null });
    expect(dateOnly(res.body.data.application.appliedAt)).toBe("2026-10-01");
  });

  it.each([
    ["missing company", { company: undefined }, "company"],
    ["bad employment type", { employmentType: "ANYWHERE" }, "employmentType"],
    ["non-http URL", { jobUrl: "ftp://example.com" }, "jobUrl"],
    ["bad currency", { salaryCurrency: "EURO" }, "salaryCurrency"],
    ["bad date", { appliedAt: "01/10/2026" }, "appliedAt"],
    ["max below min", { salaryMin: 90000, salaryMax: 80000 }, "salaryMax"],
    ["unknown field", { userId: "someone-else" }, ""],
  ])("rejects %s", async (_label, extra, path) => {
    const res = await create(alice, minimal(extra));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d) => d.path)).toContain(path);
  });
});

describe("GET /applications/:id", () => {
  it("returns details with history, interviews and documents", async () => {
    const { body } = await create(alice, minimal({ jobDescription: "Build things" }));
    const res = await request.get(`${BASE}/${body.data.application.id}`).set("Cookie", alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.application).toMatchObject({ jobDescription: "Build things", interviews: [], documents: [] });
    expect(res.body.data.application.statusChanges).toHaveLength(1);
  });

  it("returns 404 for another user's application", async () => {
    const { body } = await create(alice, minimal());
    const res = await request.get(`${BASE}/${body.data.application.id}`).set("Cookie", bob.cookie);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /applications/:id", () => {
  it("logs status changes, moves to the end of the new column and fills appliedAt", async () => {
    await create(alice, minimal({ company: "Already applied", status: "APPLIED" })); // position 1000 in APPLIED
    const { body } = await create(alice, minimal());
    const id = body.data.application.id;

    const res = await request.patch(`${BASE}/${id}`).set("Cookie", alice.cookie).send({ status: "APPLIED" });
    expect(res.status).toBe(200);
    expect(res.body.data.application).toMatchObject({ status: "APPLIED", position: 2000 });
    expect(dateOnly(res.body.data.application.appliedAt)).toBe(todayUtc());

    const history = await request.get(`${BASE}/${id}/history`).set("Cookie", alice.cookie);
    expect(history.body.data.map((h) => h.toStatus)).toEqual(["SAVED", "APPLIED"]);
  });

  it("does not log history when status is unchanged", async () => {
    const { body } = await create(alice, minimal());
    const id = body.data.application.id;
    await request.patch(`${BASE}/${id}`).set("Cookie", alice.cookie).send({ notes: "Call recruiter", status: "SAVED" });
    const history = await request.get(`${BASE}/${id}/history`).set("Cookie", alice.cookie);
    expect(history.body.data).toHaveLength(1);
  });

  it("does not set appliedAt when withdrawing a saved job", async () => {
    const { body } = await create(alice, minimal());
    const res = await request
      .patch(`${BASE}/${body.data.application.id}`)
      .set("Cookie", alice.cookie)
      .send({ status: "WITHDRAWN" });
    expect(res.body.data.application.appliedAt).toBeNull();
  });

  it("validates salary range against stored values", async () => {
    const { body } = await create(alice, minimal({ salaryMin: 50000 }));
    const res = await request.patch(`${BASE}/${body.data.application.id}`).set("Cookie", alice.cookie).send({ salaryMax: 40000 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe("salaryMax");
  });

  it("rejects an empty body", async () => {
    const { body } = await create(alice, minimal());
    const res = await request.patch(`${BASE}/${body.data.application.id}`).set("Cookie", alice.cookie).send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for another user's application", async () => {
    const { body } = await create(alice, minimal());
    const res = await request.patch(`${BASE}/${body.data.application.id}`).set("Cookie", bob.cookie).send({ notes: "hijack" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /applications/:id", () => {
  it("deletes the application and its history", async () => {
    const { body } = await create(alice, minimal());
    const id = body.data.application.id;
    expect((await request.delete(`${BASE}/${id}`).set("Cookie", alice.cookie)).status).toBe(204);
    expect((await request.get(`${BASE}/${id}`).set("Cookie", alice.cookie)).status).toBe(404);
    expect(await prisma.statusChange.count({ where: { applicationId: id } })).toBe(0);
  });

  it("cannot delete another user's application", async () => {
    const { body } = await create(alice, minimal());
    expect((await request.delete(`${BASE}/${body.data.application.id}`).set("Cookie", bob.cookie)).status).toBe(404);
  });
});

describe("GET /applications (search, filter, sort, paginate)", () => {
  beforeEach(async () => {
    const rows = [
      { company: "Stripe", jobTitle: "Frontend Engineer", employmentType: "HYBRID", status: "APPLIED", appliedAt: "2026-09-10" },
      { company: "Monzo", jobTitle: "React Developer", employmentType: "REMOTE", status: "INTERVIEW", appliedAt: "2026-10-05" },
      { company: "Vercel", jobTitle: "DX Engineer", employmentType: "REMOTE", status: "SAVED" },
      { company: "Wise", jobTitle: "Senior Frontend Dev", employmentType: "ONSITE", status: "REJECTED", appliedAt: "2026-10-20" },
    ];
    for (const r of rows) await create(alice, r);
    await create(bob, minimal({ company: "Bob's secret job" }));
  });

  const list = (query) => request.get(BASE).query(query).set("Cookie", alice.cookie);
  const companies = (res) => res.body.data.map((a) => a.company);

  it("only lists the user's own applications, without long text fields", async () => {
    const res = await list({});
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 4, totalPages: 1 });
    expect(companies(res)).not.toContain("Bob's secret job");
    expect(res.body.data[0]).not.toHaveProperty("jobDescription");
    expect(res.body.data[0]._count).toEqual({ interviews: 0, documents: 0 });
  });

  it("searches company and job title case-insensitively", async () => {
    expect(companies(await list({ q: "stri" }))).toEqual(["Stripe"]);
    expect(companies(await list({ q: "FRONTEND", sort: "company" }))).toEqual(["Stripe", "Wise"]);
  });

  it("filters by multiple statuses and employment types", async () => {
    expect(companies(await list({ status: "APPLIED,INTERVIEW", sort: "company" }))).toEqual(["Monzo", "Stripe"]);
    expect(companies(await list({ employmentType: "REMOTE", sort: "company" }))).toEqual(["Monzo", "Vercel"]);
  });

  it("filters by applied date range (inclusive)", async () => {
    expect(companies(await list({ appliedFrom: "2026-10-01", appliedTo: "2026-10-20", sort: "appliedAt" }))).toEqual(["Monzo", "Wise"]);
  });

  it("sorts by applied date with undated applications last", async () => {
    expect(companies(await list({ sort: "-appliedAt" }))).toEqual(["Wise", "Monzo", "Stripe", "Vercel"]);
  });

  it("sorts by status in pipeline order", async () => {
    expect(companies(await list({ sort: "status" }))).toEqual(["Vercel", "Stripe", "Monzo", "Wise"]);
  });

  it("paginates", async () => {
    const res = await list({ sort: "company", limit: 3, page: 2 });
    expect(res.body.meta).toMatchObject({ page: 2, limit: 3, total: 4, totalPages: 2 });
    expect(companies(res)).toEqual(["Wise"]);
  });

  it.each([
    [{ status: "HIRED" }],
    [{ sort: "salary" }],
    [{ limit: 500 }],
    [{ appliedFrom: "2026-10-10", appliedTo: "2026-10-01" }],
  ])("rejects invalid query %j", async (query) => {
    expect((await list(query)).status).toBe(400);
  });
});
