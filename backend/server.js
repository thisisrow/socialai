// server.js (minimal version: only posts + users)
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { auth } = require('./middleware/auth');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const userRoutes = require('./routes/userroutes');
const contextRoutes = require('./routes/contextroutes');
const connectDB = require('./connection/db');



// Configuration
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Connect to Database
connectDB();



// Routes
app.use('/users', userRoutes);

// Simple test route
app.get('/', (req, res) => res.send('SocialSync API is running'));

// Get posts endpoint - now uses authenticated user's credentials
app.get('/posts', auth, async (req, res) => {
  try {

    const { ACCESS_TOKEN, IG_USER_ID, IG_USERNAME } = req.user;
    
    if (!ACCESS_TOKEN || !IG_USER_ID || !IG_USERNAME) {
      return res.status(400).json({
        success: false,
        error: 'Instagram credentials not found. Please update your connection details.'
      });
    }

    const fields = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count";
    const url = `https://graph.instagram.com/${IG_USER_ID}/media?fields=${fields}&access_token=${ACCESS_TOKEN}`;
    
    const { data: list } = await axios.get(url);
    const items = list.data || [];

    const shaped = await Promise.all(items.map(async (p) => {
      let comments = [];
      try {
        const commentsUrl = `https://graph.instagram.com/${p.id}/comments?fields=id,text,username,timestamp&access_token=${ACCESS_TOKEN}`;
        const { data: cRes } = await axios.get(commentsUrl);
        comments = (cRes.data || []).map(c => ({
          id: c.id,
          text: c.text || '',
          username: c.username || '',
          timestamp: c.timestamp || '',
          isMine: (c.username || '').toLowerCase() === IG_USERNAME.toLowerCase()
        }));
        comments.sort((a,b) => (b.timestamp||'').localeCompare(a.timestamp||''));
      } catch (error) {
        console.error(`Error fetching comments for post ${p.id}:`, error.message);
        comments = [];
      }

      return {
        id: p.id,
        caption: p.caption || '',
        mediaType: p.media_type,
        imageUrl: p.media_url,
        permalink: p.permalink,
        timestamp: p.timestamp,
        likes: p.like_count ?? 0,
        commentsCount: p.comments_count ?? comments.length,
        comments: comments.slice(0, 5),
        isLiked: false,
        isSaved: false
      };
    }));

    res.json({ 
      success: true, 
      data: shaped,
      meta: {
        total: shaped.length,
        hasMore: list.paging?.next ? true : false
      }
    });
  } catch (error) {
    console.error('Error in /posts endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
