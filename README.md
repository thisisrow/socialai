# SocialAI

A CRM for Instagram comments. Sync your posts, give each one the facts it needs,
and Claude replies to new comments automatically — or drafts a reply you send
yourself.

```
socialai/
├── server/     Express + MongoDB API
├── frontend/   React + Vite SPA
└── ai/         Standalone Claude API smoke test
```

---

## Environment variables

### `server/.env`

| Variable | Required | Default | What it is |
|---|---|---|---|
| `MONGODB_URI` | **yes** | — | MongoDB connection string (Atlas or local). |
| `JWT_SECRET` | **yes** | — | Signing key for access tokens. **32+ chars.** Generate with `openssl rand -hex 32`. The server refuses to boot on a shorter one. |
| `ANTHROPIC_API_KEY` | for AI | — | Claude API key (`sk-ant-api03-…`). Without it every reply falls back to your configured fallback message. |
| `CLAUDE_MODEL` | no | `claude-opus-5` | Model used for replies. |
| `CLAUDE_EFFORT` | no | `low` | `low` \| `medium` \| `high` \| `xhigh` \| `max`. Replies are one sentence, so `low` is the right default. |
| `INSTAGRAM_APP_ID` | for IG | — | Meta app ID (Instagram product). |
| `INSTAGRAM_APP_SECRET` | for IG | — | Meta app secret. Also verifies webhook signatures. |
| `INSTAGRAM_REDIRECT_URI` | for IG | — | Must match the Meta app exactly, e.g. `https://your-app.vercel.app/auth/instagram/callback`. |
| `VERIFY_TOKEN` | for IG | — | Any string; paste the same value into the Meta webhook config. |
| `IG_GRAPH_VERSION` | no | `v23.0` | Graph API version. |
| `VERIFY_WEBHOOK_SIGNATURE` | no | `true` | Leave `true`. Setting `false` lets anyone forge comment events. |
| `PORT` | no | `3000` | HTTP port. |
| `NODE_ENV` | no | `development` | `production` in deployment. |
| `CORS_ORIGINS` | no | localhost list | Comma-separated frontend origins, e.g. `https://your-app.vercel.app`. |
| `ACCESS_TOKEN_TTL` | no | `15m` | Access token lifetime. |
| `REFRESH_TOKEN_DAYS` | no | `30` | Refresh token lifetime. |

### `frontend/.env`

| Variable | Required | Default | What it is |
|---|---|---|---|
| `VITE_API_BASE` | yes in prod | `http://localhost:3000` | Base URL of the API. No trailing slash. |

The Instagram app ID and redirect URI are **not** frontend variables any more —
the browser asks the server for the authorize URL, so they live in one place.

### `ai/.env` (optional, test sandbox only)

| Variable | What it is |
|---|---|
| `ANTHROPIC_API_KEY` | Same key as the server. |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5`. |

---

## Running locally

```bash
# 1. API
cd server && npm install && cp .env.example .env   # then fill it in
npm run dev
```

```bash
# 2. Frontend
cd frontend && npm install && cp .env.example .env
npm run dev
```

Open http://localhost:5173.

### No MongoDB or Meta app yet?

```bash
cd server && npm run dev:demo
```

Boots the API against an in-memory MongoDB seeded with a demo account, six
posts, and a realistic inbox. Sign in with `demo@socialai.app` / `demo1234`.
Nothing is persisted.

### Checking your Claude key

```bash
cd ai && npm install && npm start
```

Makes two real requests (one plain, one streaming) and prints the reply plus
token usage. A credit-balance or auth error is reported in plain language.

---

## How it works

1. **Connect Instagram.** OAuth runs server-side, so the app secret never
   reaches the browser. On connect the server stores both Instagram IDs: the
   app-scoped `igUserId` and the professional-account `igBusinessId`, which is
   what webhook events arrive under.
2. **Sync posts.** Media and existing comments are copied into MongoDB so the
   CRM renders instantly and the webhook can resolve a media ID to its owner
   without calling Meta.
3. **Add context.** Per post, or a global default. Claude is instructed to
   answer *only* from this and to send your fallback message otherwise — that
   is what stops it inventing prices and opening hours.
4. **Turn on auto-reply.** Enabling stamps `autoReplySince`, so switching
   automation on does not fire replies at a year of backlog.
5. **A comment arrives.** Meta POSTs the webhook, the HMAC signature is checked,
   the event is routed to exactly one tenant, the comment is stored (a unique
   index makes redelivery a no-op), Claude drafts a reply, and it is posted.

## Testing

```bash
cd server && npm test
```

39 end-to-end checks against a throwaway in-memory MongoDB, covering token
rotation and replay detection, cross-tenant isolation, webhook signature
rejection, and webhook-to-tenant routing.

---

## Deployment notes

- Set `CORS_ORIGINS` to your real frontend origin. The API rejects anything else.
- Point the Meta webhook at `https://your-api/api/webhook/instagram` with your
  `VERIFY_TOKEN`, and subscribe to the `comments` field.
- `INSTAGRAM_REDIRECT_URI` must match the Meta app entry character for character.
- The frontend is a SPA. `frontend/vercel.json` handles this on Vercel; any
  other host needs the equivalent. Three things about that file are load-bearing:
  - The catch-all rewrite to `/index.html` is what stops `/inbox` returning 404
    on refresh or a direct link — React Router owns those paths, not the host.
  - It does **not** swallow `/assets/*`, because Vercel checks the filesystem
    before applying rewrites.
  - `vercel.json` is schema-validated with `additionalProperties: false`, so it
    takes no comment keys — an unknown property fails the build outright.
  - It lives in `frontend/`, not the repo root, because the Vercel project's
    Root Directory is `frontend`.
- Instagram long-lived tokens last 60 days; the server refreshes them
  automatically inside the last 10 days whenever the account is used.

SocialAI is not affiliated with Meta or Instagram.
