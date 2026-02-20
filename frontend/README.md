# SocialAI Frontend

A React + Vite client for SocialAI. This UI lets a user authenticate, connect Instagram, fetch recent posts, preview media, add per-post context for AI replies, and toggle auto-reply per post.

## Features
- Email/password sign up and login
- Instagram OAuth connect flow (code capture + save connection)
- Load recent Instagram posts and comments
- Image and video previews inside post cards
- Per-post context editor (save or delete)
- Toggle AI auto-reply on individual posts
- Status/error feedback in the sidebar

## How It Works
- The app stores the JWT in `localStorage` after login.
- API calls are routed through `src/lib/api.js` to the backend defined in `VITE_API_BASE`.
- The Instagram connect button uses `VITE_IG_APP_ID` and `VITE_IG_REDIRECT_URI` to request an auth code.

## Setup
1. Install dependencies.
2. Configure the frontend environment variables.
3. Start the dev server.

```bash
npm install
npm run dev
```

## Environment Variables
Create or update `frontend/.env` with the following values:

```env
VITE_API_BASE=https://your-backend-host
VITE_IG_APP_ID=your-instagram-app-id
VITE_IG_REDIRECT_URI=https://your-frontend-host
```

Only these variables are used by the frontend code. Any other values in `.env` are currently ignored by the UI.

## Scripts
- `npm run dev` Start the Vite dev server
- `npm run build` Create a production build
- `npm run preview` Preview the production build
- `npm run lint` Run ESLint

## Project Structure
- `src/App.jsx` Main layout and state orchestration
- `src/components/` UI sections and reusable components
- `src/config/env.js` Frontend environment configuration
- `src/lib/api.js` Fetch helper for backend requests
- `src/App.css` App theme and layout styles
