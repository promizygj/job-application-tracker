import { Router } from "express";
import { requireAuth, requireVerified } from "../../middleware/auth.js";
import { uploadDocument } from "../../middleware/upload.js";
import { validate } from "../../middleware/validate.js";
import * as schemas from "./documents.schemas.js";
import * as documents from "./documents.service.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get("/", validate(schemas.listQuerySchema, "query"), async (req, res) => {
  res.json({ data: await documents.list(req.user.id, req.validatedQuery) });
});

// multipart/form-data: file, type, name, notes?
documentsRouter.post("/", requireVerified, uploadDocument, validate(schemas.uploadFieldsSchema), async (req, res) => {
  res.status(201).json({ data: { document: await documents.upload(req.user.id, req.body, req.file) } });
});

documentsRouter.get("/:id", async (req, res) => {
  res.json({ data: { document: await documents.getById(req.user.id, req.params.id) } });
});

documentsRouter.patch("/:id", validate(schemas.updateDocumentSchema), async (req, res) => {
  res.json({ data: { document: await documents.update(req.user.id, req.params.id, req.body) } });
});

documentsRouter.get("/:id/download", validate(schemas.downloadQuerySchema, "query"), async (req, res) => {
  res.json({ data: await documents.downloadUrl(req.user.id, req.params.id, req.validatedQuery) });
});

documentsRouter.delete("/:id", validate(schemas.deleteQuerySchema, "query"), async (req, res) => {
  await documents.remove(req.user.id, req.params.id, req.validatedQuery);
  res.status(204).end();
});

/** Nested routes, mounted on the applications router: /applications/:id/documents */
export const applicationDocuments = {
  list: async (req, res) => {
    res.json({ data: await documents.listForApplication(req.user.id, req.params.id) });
  },
  attach: [
    validate(schemas.attachSchema),
    async (req, res) => {
      res.status(201).json({ data: { document: await documents.attach(req.user.id, req.params.id, req.body.documentId) } });
    },
  ],
  detach: async (req, res) => {
    await documents.detach(req.user.id, req.params.id, req.params.documentId);
    res.status(204).end();
  },
};
