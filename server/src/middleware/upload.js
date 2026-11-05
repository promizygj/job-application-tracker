import multer from "multer";
import { AppError } from "../utils/AppError.js";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

const documentUpload = multer({
  storage: multer.memoryStorage(), // ≤ 5 MB, checked by magic bytes before anything touches disk
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 10 },
}).single("file");

/** Parses a multipart form with one "file" field and turns multer errors into API errors. */
export function uploadDocument(req, res, next) {
  documentUpload(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(413, "FILE_TOO_LARGE", "Files must be 5 MB or smaller"));
    if (err instanceof multer.MulterError) return next(new AppError(400, "VALIDATION_ERROR", `Upload error: ${err.message}`));
    next(err);
  });
}
