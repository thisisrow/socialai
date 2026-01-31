const express = require("express");
const router = express.Router();
const contextController = require("../controllers/contextController");
const authMiddleware = require("../middleware/auth");

router.get("/context", authMiddleware, contextController.getContext);
router.put("/context", authMiddleware, contextController.updateContext);
router.delete("/context", authMiddleware, contextController.deleteContext);

module.exports = router;
