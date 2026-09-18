import { ApiError } from "../utils/api-error.js";
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success)
    return next(new ApiError(422, "Validation failed", result.error.flatten()));
  req.body = result.data;
  next();
};
