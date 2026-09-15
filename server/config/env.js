const dotenv = require("dotenv");

dotenv.config();

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function bool(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
];

const parsedCorsOrigins = splitList(process.env.CORS_ORIGINS);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,

  // --- Database ---
  mongodbUri: process.env.MONGODB_URI,
  // Override Node's DNS resolvers. Needed when Node picks up a dead local
  // resolver (e.g. 127.0.0.1) and mongodb+srv lookups fail with querySrv ECONNREFUSED.
  dnsServers: splitList(process.env.DNS_SERVERS),

  // --- Auth ---
  jwtSecret: process.env.JWT_SECRET,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,

  // --- Claude ---
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  claudeModel: process.env.CLAUDE_MODEL || "claude-opus-5",
  claudeEffort: process.env.CLAUDE_EFFORT || "low",

  // --- Instagram / Meta ---
  instagramAppId: process.env.INSTAGRAM_APP_ID,
  instagramAppSecret: process.env.INSTAGRAM_APP_SECRET,
  instagramRedirectUri: process.env.INSTAGRAM_REDIRECT_URI,
  verifyToken: process.env.VERIFY_TOKEN,
  igGraphVersion: process.env.IG_GRAPH_VERSION || "v23.0",
  verifyWebhookSignature: bool(process.env.VERIFY_WEBHOOK_SIGNATURE, true),

  // --- ngrok ---
  ngrokEnabled: bool(process.env.NGROK_ENABLED, false),
  ngrokAuthtoken: process.env.NGROK_AUTHTOKEN,
  ngrokDomain: process.env.NGROK_DOMAIN,

  // --- App behaviour ---
  corsOrigins: parsedCorsOrigins.length ? parsedCorsOrigins : defaultCorsOrigins,
  logLevel: process.env.LOG_LEVEL || "info",
};

/**
 * Fail fast on boot for anything the process cannot run without.
 * Optional integrations (Claude, Instagram) are checked at point of use so the
 * app still boots and can tell the user what to configure.
 */
function assertRequiredEnv() {
  const missing = [];
  if (!env.mongodbUri) missing.push("MONGODB_URI");
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (env.jwtSecret && env.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32");
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

/** Non-fatal warnings printed once at boot so misconfiguration is visible. */
function envWarnings() {
  const warnings = [];
  if (!env.anthropicApiKey) warnings.push("ANTHROPIC_API_KEY not set - AI replies will use the fallback message.");
  if (!env.instagramAppId || !env.instagramAppSecret) {
    warnings.push("INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET not set - Instagram connect will fail.");
  }
  if (!env.verifyToken) warnings.push("VERIFY_TOKEN not set - Instagram webhook verification will fail.");
  if (!env.verifyWebhookSignature) {
    warnings.push("VERIFY_WEBHOOK_SIGNATURE=false - webhook payloads are NOT authenticated. Dev only.");
  }
  return warnings;
}

module.exports = { env, assertRequiredEnv, envWarnings, splitList };
