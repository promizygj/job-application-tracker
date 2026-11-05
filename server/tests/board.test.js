import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createUser, prisma, request, resetDb } from "./helpers.js";

let alice;
let bob;

const create = (owner, body) =>
  request
    .post("/api/v1/applications")
    .set("Cookie", owner.cookie)
    .send({ jobTitle: "Engineer", employmentType: "REMOTE", ...body })
    .then((r) => r.body.data.application);

const board = (owner = alice, query = {}) =>
  request.get("/api/v1/board").query(query).set("Cookie", owner.cookie);

const move = (id, body, owner = alice) =>
  request.patch(`/api/v1/applications/${id}/move`).set("Cookie", owner.cookie).send(body);

const columnNames = async (status) => (await board()).body.data.columns[status].map((c) => c.company);

beforeEach(async () => {
  await resetDb();
  alice = await createUser();
  bob = await createUser();
});

afterAll(() => prisma.$disconnect());

describe("GET /board", () => {
  it("returns all seven columns in pipeline order, with the user's cards by position", async () => {
    await create(alice, { company: "A" });
    await create(alice, { company: "B" });
    await create(alice, { company: "C", status: "INTERVIEW" });
    await create(bob, { company: "Bob's" });

    const res = await board();
    expect(res.status).toBe(200);
    const { columns } = res.body.data;
    expect(Object.keys(columns)).toEqual(["SAVED", "APPLIED", "ASSESSMENT", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"]);
    expect(columns.SAVED.map((c) => c.company)).toEqual(["A", "B"]);
    expect(columns.INTERVIEW.map((c) => c.company)).toEqual(["C"]);
    expect(columns.OFFER).toEqual([]);
    expect(JSON.stringify(columns)).not.toContain("Bob's");
    expect(columns.SAVED[0]).not.toHaveProperty("jobDescription");
  });

  it("shows the next upcoming pending interview on each card", async () => {
    const app = await create(alice, { company: "A", status: "INTERVIEW" });
    const day = 24 * 60 * 60 * 1000;
    const base = { applicationId: app.id, userId: alice.user.id, title: "Round", type: "VIDEO" };
    await prisma.interview.createMany({
      data: [
        { ...base, startsAt: new Date(Date.now() - day) }, // past
        { ...base, startsAt: new Date(Date.now() + 2 * day), outcome: "CANCELLED" }, // cancelled
        { ...base, startsAt: new Date(Date.now() + 5 * day) }, // ← next
        { ...base, startsAt: new Date(Date.now() + 9 * day) },
      ],
    });
    const card = (await board()).body.data.columns.INTERVIEW[0];
    expect(new Date(card.nextInterviewAt).getTime()).toBeGreaterThan(Date.now() + 4 * day);
    expect(new Date(card.nextInterviewAt).getTime()).toBeLessThan(Date.now() + 6 * day);
  });

  it("filters by search text and employment type", async () => {
    await create(alice, { company: "Stripe", employmentType: "HYBRID" });
    await create(alice, { company: "Monzo" });
    expect((await board(alice, { q: "strip" })).body.data.columns.SAVED.map((c) => c.company)).toEqual(["Stripe"]);
    expect((await board(alice, { employmentType: "REMOTE" })).body.data.columns.SAVED.map((c) => c.company)).toEqual(["Monzo"]);
  });

  it("requires a session", async () => {
    expect((await request.get("/api/v1/board")).status).toBe(401);
  });
});

describe("PATCH /applications/:id/move", () => {
  let a, b, c;
  beforeEach(async () => {
    a = await create(alice, { company: "A" });
    b = await create(alice, { company: "B" });
    c = await create(alice, { company: "C" });
  });

  it("reorders within a column (to top, middle and bottom)", async () => {
    await move(c.id, { status: "SAVED", index: 0 });
    expect(await columnNames("SAVED")).toEqual(["C", "A", "B"]);

    await move(b.id, { status: "SAVED", index: 1 });
    expect(await columnNames("SAVED")).toEqual(["C", "B", "A"]);

    await move(c.id, { status: "SAVED", index: 2 });
    expect(await columnNames("SAVED")).toEqual(["B", "A", "C"]);
  });

  it("only rewrites the moved card's position for a normal drop", async () => {
    const before = await prisma.application.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { id: "asc" } });
    await move(c.id, { status: "SAVED", index: 1 });
    const after = await prisma.application.findMany({ where: { id: { in: [a.id, b.id] } }, orderBy: { id: "asc" } });
    expect(after.map((x) => x.position)).toEqual(before.map((x) => x.position));
  });

  it("moves across columns, records history and fills appliedAt", async () => {
    const other = await create(alice, { company: "Applied already", status: "APPLIED" });
    const res = await move(b.id, { status: "APPLIED", index: 0 });
    expect(res.status).toBe(200);
    expect(res.body.data.application.status).toBe("APPLIED");
    expect(res.body.data.application.appliedAt).not.toBeNull();

    expect(await columnNames("SAVED")).toEqual(["A", "C"]);
    expect(await columnNames("APPLIED")).toEqual(["B", other.company]);

    const history = await request.get(`/api/v1/applications/${b.id}/history`).set("Cookie", alice.cookie);
    expect(history.body.data.map((h) => h.toStatus)).toEqual(["SAVED", "APPLIED"]);
  });

  it("drops into an empty column", async () => {
    await move(a.id, { status: "OFFER", index: 0 });
    expect(await columnNames("OFFER")).toEqual(["A"]);
  });

  it("appends when the index is past the end", async () => {
    await move(a.id, { status: "SAVED", index: 99 });
    expect(await columnNames("SAVED")).toEqual(["B", "C", "A"]);
  });

  it("does not record history for a reorder within the same column", async () => {
    await move(c.id, { status: "SAVED", index: 0 });
    expect(await prisma.statusChange.count({ where: { applicationId: c.id } })).toBe(1);
  });

  it("renumbers the column when neighbours are too close together", async () => {
    // Simulate many drops between the same two cards.
    await prisma.application.update({ where: { id: a.id }, data: { position: 1000 } });
    await prisma.application.update({ where: { id: b.id }, data: { position: 1000.0000001 } });
    await prisma.application.update({ where: { id: c.id }, data: { position: 5000 } });

    await move(c.id, { status: "SAVED", index: 1 });
    expect(await columnNames("SAVED")).toEqual(["A", "C", "B"]);
    const positions = (await prisma.application.findMany({ where: { userId: alice.user.id }, orderBy: { position: "asc" } })).map(
      (x) => x.position,
    );
    expect(positions).toEqual([1000, 2000, 3000]);
  });

  it("places a card before another card with beforeId", async () => {
    await move(c.id, { status: "SAVED", beforeId: b.id });
    expect(await columnNames("SAVED")).toEqual(["A", "C", "B"]);
    await move(b.id, { status: "SAVED", beforeId: a.id });
    expect(await columnNames("SAVED")).toEqual(["B", "A", "C"]);
  });

  it("appends with beforeId null, and when beforeId is not in the target column", async () => {
    await move(a.id, { status: "SAVED", beforeId: null });
    expect(await columnNames("SAVED")).toEqual(["B", "C", "A"]);
    const other = await create(alice, { company: "X", status: "OFFER" });
    await move(other.id, { status: "SAVED", beforeId: "does-not-exist" });
    expect(await columnNames("SAVED")).toEqual(["B", "C", "A", "X"]);
  });

  it("uses the full column with beforeId, so hidden (filtered-out) cards keep their place", async () => {
    // Board filtered to Hybrid shows only C; A and B are hidden. Dropping D "before C" must land right before C.
    await prisma.application.update({ where: { id: c.id }, data: { employmentType: "HYBRID" } });
    const d = await create(alice, { company: "D", employmentType: "HYBRID", status: "APPLIED" });
    await move(d.id, { status: "SAVED", beforeId: c.id });
    expect(await columnNames("SAVED")).toEqual(["A", "B", "D", "C"]);
  });

  it.each([
    [{ status: "SAVED", index: 0, beforeId: null }],
    [{ status: "HIRED", index: 0 }],
    [{ status: "SAVED", index: -1 }],
    [{ status: "SAVED", index: 1.5 }],
    [{ status: "SAVED" }],
    [{ status: "SAVED", index: 0, position: 5 }],
  ])("rejects invalid body %j", async (body) => {
    expect((await move(a.id, body)).status).toBe(400);
  });

  it("returns 404 for another user's application", async () => {
    expect((await move(a.id, { status: "OFFER", index: 0 }, bob)).status).toBe(404);
    expect(await columnNames("SAVED")).toEqual(["A", "B", "C"]);
  });
});
