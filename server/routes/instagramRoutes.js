const express = require("express");
const router = express.Router();
const instagramController = require("../controllers/instagramController");
const authMiddleware = require("../middleware/auth");

router.post("/instagram-token", authMiddleware, instagramController.exchangeToken);
router.post("/instagram-business-id", authMiddleware, instagramController.saveBusinessId);
router.post("/posts", authMiddleware, instagramController.getPosts);

module.exports = router;
