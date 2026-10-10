# Fitness Activity Dashboard (MERN)

A full-stack MERN app for tracking workouts, visualizing progress, and managing a personal fitness log.

## Features
- JWT registration/login and Google sign-in (Google Identity Services)
- User-scoped workout CRUD (create, list, update, delete)
- Dashboard totals: workouts, minutes, calories
- Weekly calories chart
- Search/filter workouts
- Daily and weekly goals with live progress calculated from workout history
- Workout streaks and monthly activity calendar
- Persistent achievements and badges, evaluated when workouts change
- Light UI with green accents
- Password hashing with bcrypt
- MongoDB/Mongoose validation

## Fitness goals, streaks, and achievements

After signing in, use the sidebar to open **Goals**, **Activity calendar**, and **Achievements**. Goals are calculated from the user's saved workouts; the calendar shows per-day activity; achievement unlocks are persisted in MongoDB. Streaks use the server process's local calendar timezone, so deploy with a consistent timezone if you need consistent day boundaries.

## Requirements
- Node.js 20+ (18+ may work), npm
- MongoDB local installation or MongoDB Atlas connection string

## 1. Install
From this folder:

```bash
npm install
npm run install:all
```

## Quick prototype (no MongoDB required)

Run `npm run dev` from the project root and open http://localhost:5173. With no `VITE_API_URL` set, the client starts in local demo mode. Sign in with `demo@pulse.fit` / `pulse1234`, or create an account. Sample workouts are included, and your edits are saved in this browser using local storage. Use **Log out** to return to the sign-in screen.

To use the real MongoDB API instead, create `client/.env` with `VITE_API_URL=http://localhost:5000/api`, configure `server/.env` as described below, then restart the dev servers.

## 2. Configure backend
Copy `server/.env.example` to `server/.env` and set `MONGO_URI` and a long random `JWT_SECRET`.

Windows PowerShell:
```powershell
Copy-Item server/.env.example server/.env
```

macOS/Linux:
```bash
cp server/.env.example server/.env
```

## 3. Enable Google sign-in

1. Open the [Google Cloud Console](https://console.cloud.google.com/), create/select a project, and configure the OAuth consent screen.
2. Create an **OAuth client ID** of type **Web application**.
3. Add `http://localhost:5173` to **Authorized JavaScript origins**.
4. Copy the client ID into both environment files:

`server/.env`:
```env
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

`client/.env` (create this file):
```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
```

Use the same client ID in both files. Restart the development servers after editing environment variables. Without these values, email/password login still works and the Google button shows a setup note.

## 4. Run
```bash
npm run dev
```
- React: http://localhost:5173
- API: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

## API
All `/api/workouts` endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/google` | Verify Google ID token and sign in/register |
| GET | `/api/auth/me` | Current user |
| GET | `/api/workouts` | List current user's workouts; optional `?search=run&type=Cardio` |
| POST | `/api/workouts` | Create workout |
| GET | `/api/workouts/:id` | Get one workout |
| PUT | `/api/workouts/:id` | Update workout |
| DELETE | `/api/workouts/:id` | Delete workout |

## Notes
- Never commit `server/.env`.
- Use a unique, strong `JWT_SECRET` in production.
- Configure CORS and HTTPS appropriately before deployment.
- This starter uses JWT in localStorage for simplicity. For a production deployment, consider secure, HttpOnly cookies and CSRF protections.
