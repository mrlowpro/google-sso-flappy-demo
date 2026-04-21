# Sky Hopper

Sky Hopper is a lightweight Express web app that keeps the existing Google SSO flow, stores user profiles in PostgreSQL, and adds a Flappy Bird style browser game with a leaderboard.

## What the app does

- Keeps Google Sign-In working with the existing session-based auth flow
- Stores user profile data in PostgreSQL
- Lets signed-in users play a lightweight Canvas mini game
- Saves completed scores to the database
- Shows a global leaderboard and each user's personal best
- Presents the app with a cleaner, more product-like UI

## Stack, hosting, and database

### Stack

- Node.js + Express
- Google Auth Library for Node.js
- PostgreSQL via `pg`
- `cookie-session`
- Plain HTML, CSS, and JavaScript
- HTML5 Canvas for the game

### Why this stack still fits

- The existing app was already server-rendered with Express, so the update keeps that architecture intact.
- The new game is self-contained in one frontend script and one stylesheet, which keeps the code beginner-friendly.
- No heavy frontend framework or game engine was added.

### Hosting

- Render free web service

### Database

- Neon PostgreSQL

### SQLite note

SQLite is still not a good production choice for this app on Render free web services because the filesystem is ephemeral. The game scores need persistent storage, so PostgreSQL remains the right choice.

## Project structure

```text
google-sso-demo/
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── render.yaml
├── server.js
├── db/
│   └── init.sql
├── public/
│   ├── game.js
│   └── styles.css
├── scripts/
│   └── migrate.js
└── src/
    ├── config.js
    ├── db.js
    ├── googleAuth.js
    └── views.js
```

## Environment variables

Local development still uses:

- `PORT`
- `NODE_ENV`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `SESSION_SECRET`
- `DATABASE_URL`

### Render-specific callback behavior

In production on Render, the app can automatically derive the callback URL from Render's default `RENDER_EXTERNAL_URL` environment variable.

That means on Render you can choose either:

1. Simpler:
   - do **not** set `GOOGLE_CALLBACK_URL`
   - let the app use `https://YOUR-SERVICE.onrender.com/auth/google/callback`

2. Explicit:
   - set `GOOGLE_CALLBACK_URL` yourself
   - useful if you later move to a custom domain

## Database schema

The app now uses two tables:

### `users`

- `id`
- `google_id`
- `email`
- `name`
- `picture_url`
- `created_at`
- `last_login_at`

### `scores`

- `id`
- `user_id`
- `score`
- `created_at`

The schema lives in [`db/init.sql`](./db/init.sql).

## Local setup

1. Go to the project:

   ```powershell
   cd "C:\Users\PC GAMING\Documents\Codex\2026-04-21-you-are-a-senior-full-stack"
   ```

2. Copy the environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Fill in `.env` with your real Google and Neon values.

4. Install dependencies:

   ```powershell
   & "$env:LOCALAPPDATA\Programs\nodejs-v24.14.1\npm.cmd" install
   ```

5. Run the schema migration:

   ```powershell
   & "$env:LOCALAPPDATA\Programs\nodejs-v24.14.1\npm.cmd" run migrate
   ```

6. Start the app:

   ```powershell
   & "$env:LOCALAPPDATA\Programs\nodejs-v24.14.1\npm.cmd" run dev
   ```

7. Open:

   ```text
   http://localhost:3000
   ```

If PowerShell allows plain `npm`, you can use the shorter commands:

```powershell
npm install
npm run migrate
npm run dev
```

## Local test flow

1. Open the home page
2. Sign in with Google
3. Confirm you reach the dashboard
4. Open the Play page
5. Press space or click to flap
6. Finish a run with a positive score
7. Confirm the UI shows the score was saved
8. Open the Leaderboard page
9. Confirm your score appears there

## Query the database directly

Use Neon SQL Editor and run:

```sql
SELECT s.id, s.user_id, u.name, s.score, s.created_at
FROM scores s
JOIN users u ON u.id = s.user_id
ORDER BY s.score DESC, s.created_at ASC
LIMIT 20;
```

To inspect one user's score history:

```sql
SELECT score, created_at
FROM scores
WHERE user_id = 1
ORDER BY created_at DESC;
```

## Game logic summary

- The game uses an HTML5 Canvas
- The bird moves upward when the player presses space, clicks, or taps
- Gravity pulls the bird downward every frame
- Pipes move from right to left
- Passing a pipe increases the score
- Hitting a pipe, the ground, or the ceiling ends the run
- A small overlay shows the result and lets the player start again

## Leaderboard logic summary

- Scores are stored in the `scores` table
- Every score belongs to a user through `user_id`
- The global leaderboard orders scores by:
  1. highest score first
  2. earliest time first when scores are tied
- The user's personal best is computed with `MAX(score)`
- The dashboard also shows recent saved runs for the signed-in player

## Auth and score submission rules

- Google SSO still controls authentication
- Guests can open the game page
- Guests cannot save scores
- Score submission requires a signed-in session
- Score submission also requires a short-lived play token stored in the session
- The server rejects scores that are submitted unrealistically fast

This is not meant to be a full anti-cheat system, but it does prevent unauthenticated or obviously invalid submissions.

## UI updates

The frontend was refreshed with:

- a sticky top navigation bar
- a stronger visual hierarchy
- polished cards and spacing
- a cleaner dashboard
- a dedicated game page
- a dedicated leaderboard page
- better empty states and status messages

The visual style aims for a simple SaaS-like product feel rather than a toy demo.

## Deployment on Render

This app is now prepared specifically for Render:

- `render.yaml` is included
- `preDeployCommand: npm run migrate` is included so schema changes run before the new release starts
- the app can auto-derive the production callback URL from `RENDER_EXTERNAL_URL`
- `/health` is already available for Render health checks

## Exact Render deployment steps

### 1. Push the latest code

Push this updated project to GitHub.

### 2. Create the web service

In Render:

1. Click **New**
2. Choose **Blueprint**
3. Connect your GitHub account if needed
4. Select this repository
5. Render will detect [`render.yaml`](./render.yaml)

### 3. Confirm the service settings

Render should create a web service with:

- Runtime: `Node`
- Plan: `Free`
- Build command: `npm install`
- Pre-deploy command: `npm run migrate`
- Start command: `npm start`
- Health check path: `/health`

### 4. Set environment variables

In Render, set:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`

You do **not** need to set `NODE_ENV`; the Blueprint already sets it to `production`.

You usually do **not** need to set `GOOGLE_CALLBACK_URL` either, because the app can derive it automatically from Render's own `RENDER_EXTERNAL_URL`.

### 5. Finish the first deploy

Create the service and wait for the first deployment to complete.

After that, Render gives you a public URL like:

```text
https://your-service-name.onrender.com
```

### 6. Update Google OAuth redirect URI

Go to Google Cloud Console and add this exact production redirect URI:

```text
https://YOUR-SERVICE.onrender.com/auth/google/callback
```

Replace `YOUR-SERVICE` with the actual Render service hostname.

If you want to be explicit instead of relying on auto-derivation, set:

```text
GOOGLE_CALLBACK_URL=https://YOUR-SERVICE.onrender.com/auth/google/callback
```

in Render as well.

### 7. Redeploy if needed

If you changed Google Cloud or environment variables after the first deploy, trigger a manual redeploy.

## Production migration steps

Render now runs migrations automatically before deploy through the Blueprint:

```yaml
preDeployCommand: npm run migrate
```

The app also keeps its startup schema init as a safe fallback, so both first deploys and later updates remain beginner-friendly.

## Render-specific notes

- Render free web services still spin down after 15 minutes of inactivity.
- The first request after idle can take around a minute while the service wakes back up.
- The filesystem is ephemeral, so keeping Neon as the database is the correct choice.
- Render free web services are a good fit for this app because it is a traditional Express backend with server-rendered pages and a few small JSON endpoints.

## Post-deploy test flow

1. Open the Render URL
2. Confirm the home page loads
3. Sign in with Google
4. Confirm you reach the dashboard
5. Open `/play`
6. Finish a run with a positive score
7. Confirm the save status reports success
8. Open `/leaderboard`
9. Confirm your score appears

## Testing checklist

- [ ] Existing Google sign-in still works
- [ ] Existing user row still updates correctly
- [ ] Dashboard loads after login
- [ ] Play page loads for guests
- [ ] Guest score cannot be saved
- [ ] Signed-in score can be saved
- [ ] Personal best updates after a better run
- [ ] Leaderboard shows the new score
- [ ] Multiple runs for the same user create multiple score rows
- [ ] Global leaderboard is sorted correctly
- [ ] Logout still works
- [ ] Render deployment still starts successfully
- [ ] Render health check passes on `/health`
- [ ] Google production callback succeeds on Render

## Troubleshooting

### `redirect_uri_mismatch`

Make sure Google Cloud has the exact Render callback URL:

```text
https://YOUR-SERVICE.onrender.com/auth/google/callback
```

### `invalid_client`

Double-check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### `ENOTFOUND host`

Your `DATABASE_URL` is still using the placeholder value instead of the real Neon connection string.

### Render deploy succeeds but Google login fails

If you chose not to set `GOOGLE_CALLBACK_URL`, the app will derive it from `RENDER_EXTERNAL_URL`. That means Google Cloud still must contain the exact Render URL callback.

### Pre-deploy migration fails

Check:

- `DATABASE_URL` is correct
- Neon is reachable
- the database user has permission to create tables and indexes

### Score save fails with a run/session error

The current play token expired or was already used. Start a new round and try again.

### Score save fails with a "submitted too quickly" message

The server rejected the run as unrealistic. Play a full round and submit the next game over normally.

### Leaderboard is empty

No valid signed-in scores have been saved yet. Finish a run with at least 1 point while logged in.
