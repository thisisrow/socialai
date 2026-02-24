const dotenv = require("dotenv");

dotenv.config();

function must(value, name) {
  if (!value) {
    console.error(`Requirement failed: Missing ${name}`);
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://socialai-theta.vercel.app",
];

const parsedCorsOrigins = splitList(process.env.CORS_ORIGINS);

const env = {
  port: Number(process.env.PORT) || 3000,
  verifyToken: process.env.VERIFY_TOKEN,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  openrouterApiKey: process.env.OPENROUTER_API_KEY,
  openrouterModel:
    process.env.OPENROUTER_MODEL || "stepfun/step-3.5-flash:free",
  openrouterSiteUrl: process.env.OPENROUTER_SITE_URL,
  openrouterSiteName: process.env.OPENROUTER_SITE_NAME,
  instagramClientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
  fbGraphVersion: process.env.FB_GRAPH_VERSION || "v19.0",
  defaultContext: process.env.DEFAULT_CONTEXT || "We serve delicious food at Rumo Restaurant.",
  corsOrigins: parsedCorsOrigins.length ? parsedCorsOrigins : defaultCorsOrigins,
};

module.exports = {
  env,
  must,
};
