const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios'); 
const User = require('../models/User');
const dotenv = require("dotenv");
dotenv.config();


exports.registerUser = async (req, res) => {
    console.log('Registration request received:', req.body);
    
    const { 
        username, 
        email, 
        password,
        ACCESS_TOKEN,
        IG_USER_ID,
        IG_USERNAME,
        IG_VERIFY_TOKEN,
        APP_SECRET
    } = req.body;
    
    // Input validation
    if (!username || !email || !password) {
        console.log('Missing required fields');
        return res.status(400).json({ 
            success: false,
            error: 'All fields are required',
            required: ['username', 'email', 'password'],
            received: { username: !!username, email: !!email, password: !!password }
        });
    }

    try {
        console.log('Checking for existing user with email:', email, 'or username:', username);
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        
        if (existingUser) {
            if (existingUser.email === email) {
                console.log('Email already in use:', email);
                return res.status(400).json({ 
                    success: false,
                    error: 'Email already in use',
                    field: 'email'
                });
            }
            if (existingUser.username === username) {
                console.log('Username already taken:', username);
                return res.status(400).json({ 
                    success: false,
                    error: 'Username already taken',
                    field: 'username'
                });
            }
        }

        console.log('Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('Creating new user...');
        const newUser = new User({ 
            username, 
            email: email.toLowerCase(),
            password: hashedPassword,
            ACCESS_TOKEN,
            IG_USER_ID,
            IG_USERNAME,
            IG_VERIFY_TOKEN,
            APP_SECRET
        });
        
        console.log('Saving user to database...');
        await newUser.save();
        
        console.log('User registered successfully:', newUser.email);
        
        // Generate token for the new user
        const token = jwt.sign(
            { id: newUser._id },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '1h' }
        );

        // Fetch the user with all fields to ensure we have the latest data
        const userData = await User.findById(newUser._id).select(
            'username email insta_username ACCESS_TOKEN IG_USER_ID IG_USERNAME IG_VERIFY_TOKEN APP_SECRET'
        );
        
        console.log('User data from database:', JSON.stringify(userData, null, 2));
        
        const responseData = {
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                id: userData._id,
                username: userData.username,
                email: userData.email,
                ACCESS_TOKEN: userData.ACCESS_TOKEN || null,
                IG_USER_ID: userData.IG_USER_ID || null,
                IG_USERNAME: userData.IG_USERNAME || null,
                IG_VERIFY_TOKEN: userData.IG_VERIFY_TOKEN || null,
                APP_SECRET: userData.APP_SECRET || null
            }
        };
        
        console.log('Sending response:', JSON.stringify(responseData, null, 2));
        res.status(201).json(responseData);
        
    } catch (error) {
        console.error('Registration error:', {
            name: error.name,
            message: error.message,
            code: error.code,
            keyPattern: error.keyPattern,
            keyValue: error.keyValue,
            errors: error.errors
        });
        
        let errorMessage = 'Error registering user';
        let errorDetails = {};
        
        // Handle specific MongoDB errors
        if (error.name === 'ValidationError') {
            errorMessage = 'Validation error';
            Object.keys(error.errors).forEach(key => {
                errorDetails[key] = error.errors[key].message;
            });
        } else if (error.code === 11000) {
            errorMessage = 'Duplicate key error';
            errorDetails.field = Object.keys(error.keyPattern)[0];
            errorDetails.value = error.keyValue[errorDetails.field];
        }
        
        res.status(500).json({ 
            success: false,
            error: errorMessage,
            details: errorDetails,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// User Login
exports.loginUser = async (req, res) => {
    console.log('Login attempt:', { username: req.body.username });
    
    const { username, password } = req.body;
    
    // Input validation
    if (!username || !password) {
        console.log('Missing credentials');
        return res.status(400).json({ 
            success: false,
            error: 'Username and password are required',
            received: { username: !!username, password: !!password }
        });
    }

    try {
        console.log('Looking for user:', username);
        const user = await User.findOne({ username }).select('+password');
        
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials'
            });
        }

        console.log('User found, checking password...');
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials'
            });
        }

        console.log('Password valid, generating token...');
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '1h' }
        );

        // Explicitly select all fields we want to return
        const userData = await User.findById(user._id).select(
            'username email insta_username ACCESS_TOKEN IG_USER_ID IG_USERNAME IG_VERIFY_TOKEN APP_SECRET'
        );

        console.log('User data from database:', JSON.stringify(userData, null, 2));
        
        const responseData = {
            success: true,
            token,
            user: {
                id: user._id,
                username: userData.username,
                email: userData.email,
                ACCESS_TOKEN: userData.ACCESS_TOKEN || null,
                IG_USER_ID: userData.IG_USER_ID || null,
                IG_USERNAME: userData.IG_USERNAME || null,
                IG_VERIFY_TOKEN: userData.IG_VERIFY_TOKEN || null,
                APP_SECRET: userData.APP_SECRET || null
            }
        };

        console.log('Sending response:', JSON.stringify(responseData, null, 2));
        res.status(200).json(responseData);
        
    } catch (error) {
        console.error('Login error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        res.status(500).json({ 
            success: false,
            error: 'Authentication failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Store Instagram username for a user
exports.storeInstaUsername = async (req, res) => {
    const { insta_username } = req.body;
    const userId = req.user.id; // Get ID from authenticated user

    if (!insta_username) {
        return res.status(400).json({ error: "Instagram username is required" });
    }

    try {
        const existingUser = await User.findById(userId);
        if (!existingUser) {
            return res.status(404).json({ error: "User not found" });
        }

        existingUser.insta_username = insta_username;
        await existingUser.save();

        res.status(200).json({ 
            message: "Instagram username stored successfully",
            user: {
                id: existingUser._id,
                insta_username: existingUser.insta_username
            }
        });
    } catch (error) {
        console.error("Error storing insta username:", error);
        if (error.name === 'CastError') {
            return res.status(400).json({ error: "Invalid user ID format" });
        }
        res.status(500).json({ error: "Error in storing Instagram username" });
    }
};



exports.updateConnectionDetails = async (req, res) => {
    try {
        const { 
            ACCESS_TOKEN, 
            IG_USER_ID, 
            IG_USERNAME, 
            IG_VERIFY_TOKEN, 
            APP_SECRET 
        } = req.body;

        // Validate required fields
        if (!ACCESS_TOKEN || !IG_USER_ID || !IG_USERNAME) {
            return res.status(400).json({
                success: false,
                error: 'ACCESS_TOKEN, IG_USER_ID, and IG_USERNAME are required',
                required: ['ACCESS_TOKEN', 'IG_USER_ID', 'IG_USERNAME']
            });
        }

        // Find and update user
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            {
                $set: {
                    ACCESS_TOKEN,
                    IG_USER_ID,
                    IG_USERNAME,
                    ...(IG_VERIFY_TOKEN && { IG_VERIFY_TOKEN }),
                    ...(APP_SECRET && { APP_SECRET })
                }
            },
            { 
                new: true,
                runValidators: true,
                select: '-password -__v' // Exclude sensitive/unecessary fields
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        res.status(200).json({
            success: true,
            message: 'Connection details updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update connection details error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = {};
            Object.keys(error.errors).forEach(key => {
                errors[key] = error.errors[key].message;
            });
            
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                details: errors
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to update connection details',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};