# SocialAI Server

This server powers the SocialAI app. It handles user auth, Instagram OAuth/token storage, fetching posts and comments, saving per-post context, and auto-replying to comments via webhook events.

## Why This Server Exists

Instagram's APIs, token exchanges, and webhook processing must happen on a trusted backend. We created this server to:

- Keep secrets safe (JWT secret, Instagram client secret, Gemini API key).
- Store and refresh Instagram tokens for each user.
- Centralize data persistence (users, Instagram accounts, contexts, auto-reply state).
- Process incoming webhook events reliably and respond quickly.
- Generate AI replies using Gemini based on user-provided context.

## Architecture Overview

- `index.js`: starts the server and connects MongoDB.
- `app.js`: builds the Express app and wires routes + middleware.
- `config/env.js`: loads and validates environment variables.
- `lib/*`: shared helpers (auth, errors, Instagram utilities).
- `services/ai.js`: Gemini prompt and generation logic.
- `routes/*`: all HTTP endpoints.

## Setup

1. Install dependencies:
   - `npm install`
2. Configure environment variables in `server/.env`.
3. Run the server:
   - `npm run start`

Default server port: `3000` (configurable via `PORT`).

## Environment Variables

Required values used by the current code:

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `VERIFY_TOKEN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `INSTAGRAM_CLIENT_SECRET`
- `FB_GRAPH_VERSION`
- `DEFAULT_CONTEXT`
- `CORS_ORIGINS`

## API Summary

For full details, see `server/api.json`.

Auth:
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`

Instagram:
- `POST /api/instagram-business-id`
- `POST /api/instagram-token`
- `GET /api/instagram-webhook`
- `POST /api/instagram-webhook`

Posts and State:
- `POST /posts`
- `GET /api/context`
- `PUT /api/context`
- `DELETE /api/context`
- `GET /api/post-state`
- `PUT /api/post-state`

## Data Model (MongoDB)

Collections are defined in `server/db.js`:

- `AppUser`: email + password hash.
- `IgAccount`: Instagram token + user mapping.
- `MediaOwner`: maps IG media IDs to app users (webhook routing).
- `Context`: per-post prompt context.
- `PostState`: auto-reply on/off per post.
- `Replied`: track comment IDs already replied to.

## Notes

- Webhook endpoints must respond quickly; the server returns `200` immediately and processes in the background.
- Auto-replies only happen when the post state has `autoReplyEnabled = true`.
- If Instagram access tokens expire, the server returns `401` for `/posts` and the user needs to reconnect.
