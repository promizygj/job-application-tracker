import { AppError } from "../utils/AppError.js";

/** Validates req[source] against a zod schema and replaces it with the parsed value. */
export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new AppError(400, "VALIDATION_ERROR", "Invalid input", details);
  }
  if (source === "query") req.validatedQuery = result.data;
  else req[source] = result.data;
  next();
};
