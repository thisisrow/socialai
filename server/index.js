const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectMongo = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const instagramRoutes = require("./routes/instagramRoutes"); // Handles /posts and token exchange
const contextRoutes = require("./routes/contextRoutes");
const postStateRoutes = require("./routes/postStateRoutes");
const webhookRoutes = require("./routes/webhookRoutes");

const app = express();
app.use(express.json());

// CORS: allow your Vercel domain
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://socialai-theta.vercel.app",
        ],
        credentials: false,
    })
);

const port = process.env.PORT || 3000;

console.log("Global constants initialized");
app.get("/", (req, res) => {
    res.send("Rumo Server is running.");
});

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api", userRoutes);        // /api/me
app.use("/api", instagramRoutes);   // /api/instagram-token, /api/instagram-business-id, /posts (NOTE: /posts is currently at root in the controller logic, need to adjust route or controller)
// WAIT: The previous monolithic code had app.post("/posts", ...). Let's fix the route mounting.
// The route file defines `router.post("/posts", ...)` so if I mount it at `/api`, it becomes `/api/posts`.
// BUT the frontend calls `/posts`.
// SO, I should split instagramRoutes or handle the paths carefully.
// Let's re-examine `instagramRoutes.js`: 
// router.post("/posts", ...)
// If I mount it at `/`, it works as `/posts`.
app.use("/", instagramRoutes);      // mounts /posts at /posts
app.use("/api", instagramRoutes);   // mounts /instagram-token at /api/instagram-token

app.use("/api", contextRoutes);
app.use("/api", postStateRoutes);
app.use("/api", webhookRoutes);


// ---------- START ----------
console.log("Connecting to MongoDB...");
connectMongo()
    .then(() => {
        console.log("MongoDB connected. Starting server...");
        app.listen(port, () => console.log(`Server running on port ${port}`));
    })
    .catch((e) => {
        console.error("Mongo connection failed:", e.message);
        process.exit(1);
    });
