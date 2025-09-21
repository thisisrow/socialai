const mongoose = require('mongoose');

const contextSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    postId: {
        type: String,
        required: true
    },
    context: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('Context', contextSchema);
