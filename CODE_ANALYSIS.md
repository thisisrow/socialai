# SocialSync Codebase Analysis

## 1. Project Overview
**SocialSync** is a MERN stack application designed to automate Instagram comment replies using AI. It connects to a user's Instagram Business account, monitors comments via webhooks, and uses Google's Gemini AI to generate context-aware replies based on user-defined instructions.

### Directory Structure
- **`server/`**: The core backend application (Express.js).
- **`frontend/`**: The client-side dashboard (React + Vite).
- **`backend/`**: Appears to be an older or unused directory (contains only `.env` and `node_modules`).

---

## 2. Backend Architecture (`server/`)

### Core Technologies
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **AI**: Google Gemini (`@google/generative-ai`)
- **Authentication**: JWT & `bcrypt`
- **External APIs**: Instagram Graph API

### Key Files

#### `server/index.js` (Entry Point)
This is the monolithic controller for the application. It handles:
1.  **Authentication**:
    -   `POST /api/auth/signup` & `/login`: standard email/password flow.
    -   `authMiddleware`: Protects routes using `Bearer` JWT tokens.
2.  **Instagram Integration**:
    -   `POST /api/instagram-token`: Exchanges the temporary OAuth code for a specialized "Long-Lived Access Token" to allow offline access.
    -   `POST /posts`: Fetches recent media and comments from Instagram. Crucially, it maps `postId` to `appUserId` in the `MediaOwner` collection so webhooks know who owns which post.
3.  **Context Management**:
    -   `GET/PUT/DELETE /api/context`: Allows users to define specific "knowledge" (Context) for each post. The AI uses this text to generate accurate replies.
4.  **Auto-Reply Logic**:
    -   `POST /api/instagram-webhook`: The heart of the automation.
        -   Receives comment events from Instagram.
        -   Checks `PostState` to see if auto-reply is enabled for that post.
        -   Retrieves the stored `Context` for the post.
        -   Calls `generateReply` (using Gemini) with the user's comment and the post's context.
        -   Posts the reply back to Instagram using `replyToComment`.

#### `server/db.js` (Data Models)
-   **`AppUser`**: Stores user credentials.
-   **`IgAccount`**: Links the AppUser to their Instagram `basicUserId`, `igBusinessId`, and `accessToken`.
-   **`Context`**: Stores the AI instructions/context for a specific `postId`.
-   **`PostState`**: Toggles whether auto-reply is enabled (`true/false`) for a `postId`.
-   **`MediaOwner`**: A lookup table mapping Instagram `postId` -> `appUserId`. This is critical for the webhook to find the correct user when a new comment comes in.
-   **`Replied`**: Tracks comment IDs that have already been replied to, preventing duplicate loops.

#### `server/ai.js`
-   This appears to be a standalone test script for the Gemini API. It contains a hardcoded API key (which is a security risk) and is not imported by the main application.

### Key Workflows
1.  **Setup**: User logs in -> Connects Instagram (OAuth) -> Server saves Access Token.
2.  **Configuration**: User loads posts -> Adds "Context" (e.g., "We are open 9-5") -> Enables "AI Reply".
3.  **Execution**: User comments on Instagram -> Webhook hits Server -> Server finds Owner & Context -> Generates Reply -> Posts to Instagram.

---

## 3. Frontend Architecture (`frontend/`)

### Core Technologies
-   **Framework**: React 19
-   **Build Tool**: Vite
-   **Styling**: Plain CSS (`App.css`, `index.css`)

### Key Files

#### `src/App.jsx`
The entire application logic resides here.
-   **State**: Manages `jwtToken`, `posts`, `contextMap`, and `stateMap` (auto-reply status).
-   **Authentication UI**: Conditional rendering for Login/Signup vs. Dashboard.
-   **Dashboard Features**:
    -   **Connect Instagram**: Redirects user to `instagram.com/oauth/authorize`.
    -   **Post Feed**: Renders a grid of Instagram posts fetched from the backend.
    -   **Controls**:
        -   "Add Context": Opens a modal to save text to MongoDB.
        -   "AI Reply ON/OFF": Toggles the automation state for that specific post.

---

## 4. Observations & Recommendations
1.  **Security**:
    -   `server/ai.js` contains a hardcoded API key. This file should be removed or the key moved to `.env`.
    -   Error handling in `server/index.js` is quite robust, with specific checks for Instagram token expiration logic (`code 190`).
2.  **Redundancy**:
    -   The `backend/` folder seems unused and can likely be deleted to avoid confusion.
3.  **Hardcoded Values**:
    -   `frontend/src/App.jsx` hardcodes `API_BASE` to an ngrok URL (`https://40ee0a2243dd.ngrok-free.app`). This will break if the ngrok tunnel restarts. It strongly suggests a local development environment.
