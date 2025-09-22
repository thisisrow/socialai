const express = require('express');
const router = express.Router();
const { getContext, addContext, updateContext, deleteContext, toggleAutomation } = require('../controller/contextcontroller');
const auth = require('../middleware/auth');

router.get('/:postId', auth, getContext);
router.post('/', auth, addContext);
router.put('/:postId', auth, updateContext);
router.delete('/:postId', auth, deleteContext);
router.put('/:postId/toggle-automation', auth, toggleAutomation);

module.exports = router;
