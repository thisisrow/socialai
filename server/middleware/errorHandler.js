const { ApiError, isDuplicateKeyError } = require("../lib/errors");
const { env } = require("../config/env");

function notFoundHandler(req, res) {
  res.status(404).json({
    error: `No route for ${req.method} ${req.path}`,
    code: "route_not_found",
  });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = "Something went wrong";
  let code = "internal_error";
  let details;

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
    code = err.code;
    details = err.details;
  } else if (err?.name === "ValidationError") {
    status = 400;
    code = "validation_error";
    message =
      Object.values(err.errors || {})
        .map((e) => e.message)
        .join(", ") || "Invalid input";
  } else if (isDuplicateKeyError(err)) {
    status = 409;
    code = "duplicate";
    message = "That record already exists";
  } else if (err?.name === "CastError") {
    status = 400;
    code = "invalid_id";
    message = "Malformed identifier";
  } else if (err?.type === "entity.parse.failed") {
    status = 400;
    code = "invalid_json";
    message = "Request body is not valid JSON";
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.path}:`, err);
  } else {
    console.warn(`[warn] ${req.method} ${req.path}: ${message}`);
  }

  const body = { error: message, code };
  if (details) body.details = details;
  if (env.nodeEnv !== "production" && status >= 500) body.stack = err?.stack;
  res.status(status).json(body);
}

module.exports = { notFoundHandler, errorHandler };
