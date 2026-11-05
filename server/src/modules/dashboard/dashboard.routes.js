import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import * as dashboard from "./dashboard.service.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

const activityQuery = z.object({ weeks: z.coerce.number().int().min(1).max(52).default(12) });

dashboardRouter.get("/summary", async (req, res) => {
  res.json({ data: await dashboard.summary(req.user.id) });
});

dashboardRouter.get("/activity", validate(activityQuery, "query"), async (req, res) => {
  res.json({ data: await dashboard.activity(req.user, req.validatedQuery.weeks) });
});

dashboardRouter.get("/funnel", async (req, res) => {
  res.json({ data: await dashboard.funnel(req.user.id) });
});
