const mongoose = require('mongoose');

const ContextSchema = new mongoose.Schema({
    
}, { timestamps: true }); 

module.exports = mongoose.model('Context', ContextSchema);