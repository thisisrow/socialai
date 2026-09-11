const { app } = require("./app");
const { env, assertRequiredEnv, envWarnings } = require("./config/env");
const { connectMongo, disconnectMongo } = require("./models");

async function start() {
  try {
    assertRequiredEnv();
  } catch (e) {
    console.error(`\nConfiguration error: ${e.message}`);
    console.error("See server/.env.example for the full list.\n");
    process.exit(1);
  }

  for (const warning of envWarnings()) console.warn(`[config] ${warning}`);

  console.log("[boot] connecting to MongoDB...");
  try {
    await connectMongo();
    console.log("[boot] MongoDB connected");
  } catch (e) {
    console.error("[boot] MongoDB connection failed:", e.message);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`[boot] SocialAI API listening on :${env.port} (${env.nodeEnv})`);
    console.log(`[boot] Claude model: ${env.claudeModel} (effort: ${env.claudeEffort})`);
    console.log(`[boot] CORS origins: ${env.corsOrigins.join(", ")}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[shutdown] ${signal} received, closing...`);
    server.close(async () => {
      await disconnectMongo().catch(() => {});
      process.exit(0);
    });
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("[fatal] unhandled rejection:", reason);
  });
}

start();
