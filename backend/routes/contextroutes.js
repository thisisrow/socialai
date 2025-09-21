const express = require('express');
const router = express.Router();
const { contextAdd, contextPatch, contextGet } = require('../controller/contextcontroller');
const auth = require('../middleware/auth');

router.post('/add', contextAdd);
router.post('/get', contextGet);
router.post('/patch', contextPatch);
module.exports = router;