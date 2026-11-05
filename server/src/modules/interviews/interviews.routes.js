import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as schemas from "./interviews.schemas.js";
import * as interviews from "./interviews.service.js";

export const interviewsRouter = Router();
interviewsRouter.use(requireAuth);

interviewsRouter.get("/", validate(schemas.listQuerySchema, "query"), async (req, res) => {
  const { items, meta } = await interviews.list(req.user.id, req.validatedQuery);
  res.json({ data: items, meta });
});

interviewsRouter.get("/:id", async (req, res) => {
  res.json({ data: { interview: await interviews.getById(req.user.id, req.params.id) } });
});

interviewsRouter.patch("/:id", validate(schemas.updateInterviewSchema), async (req, res) => {
  res.json({ data: { interview: await interviews.update(req.user.id, req.params.id, req.body) } });
});

interviewsRouter.delete("/:id", async (req, res) => {
  await interviews.remove(req.user.id, req.params.id);
  res.status(204).end();
});

/** Nested routes, mounted on the applications router: /applications/:id/interviews */
export const applicationInterviews = {
  list: async (req, res) => {
    res.json({ data: await interviews.listForApplication(req.user.id, req.params.id) });
  },
  create: [
    validate(schemas.createInterviewSchema),
    async (req, res) => {
      res.status(201).json({ data: await interviews.create(req.user, req.params.id, req.body) });
    },
  ],
};
