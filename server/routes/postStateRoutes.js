const express = require("express");
const router = express.Router();
const postStateController = require("../controllers/postStateController");
const authMiddleware = require("../middleware/auth");

router.get("/post-state", authMiddleware, postStateController.getPostState);
router.put("/post-state", authMiddleware, postStateController.updatePostState);

module.exports = router;
