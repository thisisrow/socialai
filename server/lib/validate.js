const { ApiError } = require("./errors");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function requireString(value, field, { min = 1, max = 5000, trim = true } = {}) {
  if (value === undefined || value === null) {
    throw ApiError.badRequest(`${field} is required`, "validation_error", { field });
  }
  let out = String(value);
  if (trim) out = out.trim();
  if (out.length < min) {
    throw ApiError.badRequest(
      min === 1 ? `${field} is required` : `${field} must be at least ${min} characters`,
      "validation_error",
      { field },
    );
  }
  if (out.length > max) {
    throw ApiError.badRequest(`${field} must be ${max} characters or fewer`, "validation_error", {
      field,
    });
  }
  return out;
}

function optionalString(value, field, { max = 5000, fallback = "" } = {}) {
  if (value === undefined || value === null) return fallback;
  const out = String(value).trim();
  if (out.length > max) {
    throw ApiError.badRequest(`${field} must be ${max} characters or fewer`, "validation_error", {
      field,
    });
  }
  return out;
}

function requireEmail(value, field = "email") {
  const email = requireString(value, field, { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw ApiError.badRequest("Enter a valid email address", "validation_error", { field });
  }
  return email;
}

function requirePassword(value, field = "password") {
  const password = requireString(value, field, { min: 8, max: 200, trim: false });
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw ApiError.badRequest(
      "Password must contain at least one letter and one number",
      "validation_error",
      { field },
    );
  }
  return password;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") {
    throw ApiError.badRequest(`${field} must be true or false`, "validation_error", { field });
  }
  return value;
}

function oneOf(value, field, allowed, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const out = String(value);
  if (!allowed.includes(out)) {
    throw ApiError.badRequest(`${field} must be one of: ${allowed.join(", ")}`, "validation_error", {
      field,
    });
  }
  return out;
}

function clampInt(value, field, { min, max, fallback }) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw ApiError.badRequest(`${field} must be a number`, "validation_error", { field });
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}

module.exports = {
  requireString,
  optionalString,
  requireEmail,
  requirePassword,
  requireBoolean,
  oneOf,
  clampInt,
};
