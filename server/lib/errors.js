class ApiError extends Error {
  constructor(status, message, code = undefined, details = undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(msg, code, details) {
    return new ApiError(400, msg, code || "bad_request", details);
  }
  static unauthorized(msg = "Not authenticated", code) {
    return new ApiError(401, msg, code || "unauthorized");
  }
  static forbidden(msg = "Not allowed", code) {
    return new ApiError(403, msg, code || "forbidden");
  }
  static notFound(msg = "Not found", code) {
    return new ApiError(404, msg, code || "not_found");
  }
  static conflict(msg, code) {
    return new ApiError(409, msg, code || "conflict");
  }
  static tooMany(msg = "Too many requests", code) {
    return new ApiError(429, msg, code || "rate_limited");
  }
  static internal(msg = "Something went wrong", code) {
    return new ApiError(500, msg, code || "internal_error");
  }
}

/** Pull a human-readable message out of an axios / Meta Graph error shape. */
function extractErrorMessage(e) {
  const data = e?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data?.error?.error_user_msg) return String(data.error.error_user_msg);
  if (data?.error?.message) return String(data.error.message);
  if (data?.error_message) return String(data.error_message);
  if (data?.message) return String(data.message);
  if (e?.message) return String(e.message);
  return "Unknown error";
}

function isDuplicateKeyError(e) {
  return e?.code === 11000 || String(e?.message || "").includes("E11000 duplicate key");
}

/** Wraps an async route handler so rejections reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, extractErrorMessage, isDuplicateKeyError, asyncHandler };
