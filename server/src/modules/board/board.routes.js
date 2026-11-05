import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { boardQuerySchema, moveSchema } from "./board.schemas.js";
import * as board from "./board.service.js";

export const boardRouter = Router();
boardRouter.use(requireAuth);

boardRouter.get("/", validate(boardQuerySchema, "query"), async (req, res) => {
  res.json({ data: await board.getBoard(req.user.id, req.validatedQuery) });
});

/** Mounted on the applications router as PATCH /applications/:id/move. */
export const moveHandler = [
  validate(moveSchema),
  async (req, res) => {
    const application = await board.move(req.user, req.params.id, req.body);
    res.json({ data: { application } });
  },
];
