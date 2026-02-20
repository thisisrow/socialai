const { app } = require("./app");
const { env } = require("./config/env");
const { connectMongo } = require("./db");

// ---------- START ----------
console.log("Connecting to MongoDB...");
connectMongo()
  .then(() => {
    console.log("MongoDB connected. Starting server...");
    app.listen(env.port, () => console.log(`Server running on port ${env.port}`));
  })
  .catch((e) => {
    console.error("Mongo connection failed:", e.message);
    process.exit(1);
  });
