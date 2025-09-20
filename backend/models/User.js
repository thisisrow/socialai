const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    insta_username: { 
        type: String, 
        unique: true 
    },
    ACCESS_TOKEN: { type: String },
    IG_USER_ID: { type: String },
    IG_USERNAME: { type: String },
    IG_VERIFY_TOKEN: { type: String },
    APP_SECRET: { type: String },
    company_info:{type:String},
    resetToken: { 
        type: String, 
        default: null 
    },
    resetTokenExpiry: { 
        type: Date, 
        default: null 
    },
}, { timestamps: true }); 

module.exports = mongoose.model('User', UserSchema);