import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { moveHandler } from "../board/board.routes.js";
import { applicationDocuments } from "../documents/documents.routes.js";
import { applicationInterviews } from "../interviews/interviews.routes.js";
import * as schemas from "./applications.schemas.js";
import * as applications from "./applications.service.js";

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

applicationsRouter.get("/", validate(schemas.listQuerySchema, "query"), async (req, res) => {
  const { items, meta } = await applications.list(req.user.id, req.validatedQuery);
  res.json({ data: items, meta });
});

applicationsRouter.post("/", validate(schemas.createApplicationSchema), async (req, res) => {
  const application = await applications.create(req.user, req.body);
  res.status(201).json({ data: { application } });
});

applicationsRouter.get("/:id", async (req, res) => {
  const application = await applications.getById(req.user.id, req.params.id);
  res.json({ data: { application } });
});

applicationsRouter.patch("/:id", validate(schemas.updateApplicationSchema), async (req, res) => {
  const application = await applications.update(req.user, req.params.id, req.body);
  res.json({ data: { application } });
});

applicationsRouter.patch("/:id/move", ...moveHandler);

applicationsRouter.get("/:id/interviews", applicationInterviews.list);
applicationsRouter.post("/:id/interviews", ...applicationInterviews.create);

applicationsRouter.get("/:id/documents", applicationDocuments.list);
applicationsRouter.post("/:id/documents", ...applicationDocuments.attach);
applicationsRouter.delete("/:id/documents/:documentId", applicationDocuments.detach);

applicationsRouter.delete("/:id", async (req, res) => {
  await applications.remove(req.user.id, req.params.id);
  res.status(204).end();
});

applicationsRouter.get("/:id/history", async (req, res) => {
  const history = await applications.history(req.user.id, req.params.id);
  res.json({ data: history });
});
