const express = require('express');
const router = express.Router();
const { registerUser, loginUser, storeInstaUsername, updateConnectionDetails } = require('../controller/usercontrollers');
const auth = require('../middleware/auth');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/username', auth, storeInstaUsername);
router.post('/connectiondetails', auth, updateConnectionDetails);
module.exports = router;