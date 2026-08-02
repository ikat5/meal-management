# 🚀 Deploying to Render.com (Docker)

This guide takes the app from your laptop to a live URL on Render, using the
`Dockerfile` in this repo. Total time: ~15 minutes.

---

## How the pieces fit

```
GitHub repo ──▶ Render (builds the Dockerfile) ──▶ live URL
                        │
                        └── env vars (MONGODB_URI, JWT_SECRET, …)
                                    │
                                    ▼
                            MongoDB Atlas (your existing cluster)
```

Render **builds the Docker image for you** on every `git push` — you never
have to run `docker push` or manage a registry.

---

## Step 0 — Test the image locally (optional but smart)

```bash
# Build the image
docker build -t meal-manager .

# Run it with your env file
docker run --rm -p 3000:3000 --env-file .env meal-manager
```

Open http://localhost:3000 — if login works here, Render will work too.

> No Docker installed locally? Skip this — Render builds the image itself.

---

## Step 1 — Push the project to GitHub

```bash
git init
git add .
git commit -m "Meal Management System"
git branch -M main
git remote add origin https://github.com/<your-username>/meal-management-system.git
git push -u origin main
```

**Double-check first:** `git status` must NOT list `.env` (the `.gitignore`
already excludes it — keep it that way; secrets go into Render's dashboard,
never into git).

---

## Step 2 — Allow Render to reach MongoDB Atlas

Render's outbound IPs are dynamic, so Atlas must accept connections from anywhere:

1. Go to **MongoDB Atlas → Network Access → Add IP Address**
2. Choose **"Allow access from anywhere"** (`0.0.0.0/0`) → Confirm

> This is standard for PaaS hosting. Your data is still protected by the
> database username/password — but make sure that password is strong.

---

## Step 3 — Create the Render Web Service

1. Sign in at [dashboard.render.com](https://dashboard.render.com) (log in with GitHub — easiest)
2. Click **New → Web Service**
3. **Connect your repository** (`meal-management-system`)
4. Fill in the settings:

| Setting | Value |
|---|---|
| **Name** | `meal-management-system` (becomes your URL) |
| **Region** | Singapore (closest to Bangladesh) |
| **Branch** | `main` |
| **Language / Runtime** | **Docker** ← Render auto-detects the Dockerfile |
| **Instance Type** | Free (fine to start; see "Free-tier gotchas" below) |

Leave build/start commands empty — the Dockerfile handles everything.

---

## Step 4 — Environment variables

Still on the create screen (or later under **Environment** in the service
settings), add these four variables:

| Key | Value |
|---|---|
| `MONGODB_URI` | `mongodb+srv://tarit1243_db_user:<db_password>@mealsystem.htdby7i.mongodb.net/meal_management?retryWrites=true&w=majority` |
| `JWT_SECRET` | a long random string — generate with `openssl rand -base64 32`. **Use a DIFFERENT one than local dev.** |
| `CRON_SECRET` | another long random string (`openssl rand -base64 32`) — protects the daily `/api/cron/tick` endpoint (Step 6) |
| `MEAL_CANCEL_CUTOFF_HOUR` | `22` |
| `APP_TIMEZONE` | `Asia/Dhaka` |

⚠️ Common mistakes:
- Forgetting to replace `<db_password>` with the real password
- Not URL-encoding special characters in the password (`@` → `%40`)
- Wrapping values in quotes — **don't**; Render takes the raw value

> You do NOT need to set `PORT` — Render injects it automatically and the
> Dockerfile/Next.js standalone server respects it.

---

## Step 5 — Deploy 🎉

Click **Deploy Web Service**. Watch the logs:

1. `Building Dockerfile…` (first build ≈ 3–5 min; later builds are faster
   thanks to the cached dependency layer)
2. `Your service is live 🎉`

Your app is now at:

```
https://meal-management-system.onrender.com
```

Open it, register your account, create your group, and share the invite code.

---

## Step 6 — The daily heartbeat (auto-schedule + auto-reset)

Two things are supposed to happen without anyone clicking a button:

- **Last day of the month** → next month's bazar schedule is generated for every group
- **1st of the month** → every group's meal system auto-resets (unfreezes, fresh ledger)

The app does the monthly reset *lazily* on the first visit of a new month, but
the schedule pre-generation needs a daily ping. The endpoint is:

```
GET https://<your-app>.onrender.com/api/cron/tick
Authorization: Bearer <CRON_SECRET>
```

It's idempotent — calling it twice does nothing extra.

**Option A — Render Cron Job (paid, simplest inside Render):**

1. Render dashboard → **New → Cron Job**
2. Schedule: `30 18 * * *` (daily 18:30 UTC = 00:30 in Dhaka)
3. Command:
   ```bash
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.onrender.com/api/cron/tick
   ```
4. Add the `CRON_SECRET` env var to the cron job too.

**Option B — free external pinger (works fine):**

Use [cron-job.org](https://cron-job.org) (free): create a daily job that calls
`https://<your-app>.onrender.com/api/cron/tick?secret=<CRON_SECRET>`.
Bonus on the free tier: the daily hit also wakes the service.

---

## Every deploy after this one

Just push — Render rebuilds and redeploys automatically:

```bash
git add .
git commit -m "describe your change"
git push
```

(You can turn this off under **Settings → Build & Deploy → Auto-Deploy**.)

---

## Free-tier gotchas (worth knowing)

| Behavior | What it means | Fix |
|---|---|---|
| **Spins down after 15 min idle** | First visit after a quiet period takes ~50s to wake up | Upgrade to Starter ($7/mo) for always-on |
| **750 free hours/month** | Enough for one always-awake service | — |
| **Ephemeral disk** | Files written at runtime vanish on redeploy | Fine for us — everything lives in MongoDB |

---

## Troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| Build fails at `npm ci` | `package-lock.json` missing from the repo — commit it |
| Live site shows 500s, logs say `MongoServerError: bad auth` | Wrong `MONGODB_URI` password in Render env vars |
| Logs say `Could not connect to any servers` | Atlas Network Access doesn't allow `0.0.0.0/0` (Step 2) |
| Login loops back to the login page | `JWT_SECRET` missing in Render env vars |
| Meal cutoff fires at the wrong hour | `APP_TIMEZONE` not set — the server thinks in UTC |
| Site is slow on first visit | Free tier waking up from sleep — expected |

To read live logs: Render dashboard → your service → **Logs** tab.
