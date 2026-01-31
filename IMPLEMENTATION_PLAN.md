# Backend Refactoring Plan

The goal is to restructure the `server/` directory from a monolithic `index.js` into a scalable, organized file structure.

## Structure Overview

```text
server/
├── config/
│   └── db.js           # Database connection
├── models/             # Mongoose schemas
│   ├── AppUser.js
│   ├── IgAccount.js
│   ├── MediaOwner.js
│   ├── Context.js
│   ├── Replied.js
│   └── PostState.js
├── middleware/
│   └── auth.js         # Auth middleware
├── utils/
│   └── helpers.js      # Utility functions (must, redactToken, etc.)
├── services/
│   ├── aiService.js    # Google Gemini logic
│   └── instagramService.js # Instagram helpers (replyToComment)
├── controllers/        # Request handlers
│   ├── authController.js
│   ├── userController.js
│   ├── instagramController.js
│   ├── contextController.js
│   ├── postStateController.js
│   └── webhookController.js
├── routes/             # Route definitions
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── instagramRoutes.js
│   ├── contextRoutes.js
│   ├── postStateRoutes.js
│   └── webhookRoutes.js
└── index.js            # Entry point (App setup & Route wiring)
```

## Step-by-Step Execution

1.  **Create Directories**: Set up the new folder structure.
2.  **Move Config & Models**:
    *   Move `connectMongo` to `config/db.js`.
    *   Split `server/db.js` models into individual files in `models/`.
3.  **Extract Utilities & Middleware**:
    *   Move helper functions to `utils/helpers.js`.
    *   Move `authMiddleware` to `middleware/auth.js`.
4.  **Extract Services**:
    *   Move `generateReply` to `services/aiService.js`.
    *   Move `replyToComment` to `services/instagramService.js`.
5.  **Create Controllers**:
    *   Extract logic from `index.js` into respective controller files.
6.  **Create Routes**:
    *   Define routes for each feature and link them to controllers.
7.  **Update Entry Point**:
    *   Rewrite `index.js` to use the new routes and configuration.
8.  **Verification**:
    *   Ensure the server starts and endpoints are accessible.

## User Review Required
None. This is a purely structural refactor.
