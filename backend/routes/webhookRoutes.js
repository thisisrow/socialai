const express = require('express');
const router = express.Router();
const { verifyWebhook, handleWebhook } = require('../controller/webhookController');

// Webhook verification
router.get('/get', verifyWebhook);

// Handle incoming messages
router.post('/post', handleWebhook);

module.exports = router;