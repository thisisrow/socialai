const express = require('express');
const router = express.Router();
const { getContext, addContext, updateContext, deleteContext } = require('../controller/contextcontroller');
const auth = require('../middleware/auth');

router.get('/:postId', auth, getContext);
router.post('/', auth, addContext);
router.put('/:postId', auth, updateContext);
router.delete('/:postId', auth, deleteContext);

module.exports = router;
