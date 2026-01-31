# Refactor Backend to MVC Structure

## Summary
Refactored the monolithic `server/index.js` into a modular MVC architecture to improve maintainability and scalability.

## Changes
- **Directory Structure**: Created `controllers`, `models`, `routes`, `services`, `middleware`, `config`, and `utils`.
- **Database**: Moved Mongoose schemas from `db.js` to individual files in `models/`.
- **Logic**: Extracted business logic into `controllers/`.
- **Routes**: Defined modular routes in `routes/`.
- **Security**: Moved AI logic to `services/aiService.js` and removed the insecure `ai.js` file.
- **Cleanup**: Deleted legacy `db.js`.

## Verification
- Verified all files are created in the correct structure.
- Validated route mounting in `index.js`.

## Notes
- `npm install` may be required to ensure all dependencies are fresh.
- Frontend functionality remains unchanged, as API endpoints match the previous implementation.
