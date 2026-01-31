const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");

router.get("/instagram-webhook", webhookController.verifyWebhook);
router.post("/instagram-webhook", webhookController.receiveWebhook);

module.exports = router;
