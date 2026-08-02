# 🍽️ Meal Management System

A full-stack app for shared households/messes to manage **meals, market (bazar) duties, expenses, and monthly billing** — built with **Next.js 14 (App Router), TypeScript, MongoDB (Mongoose), JWT auth, and Tailwind CSS**.

---

## ✨ What this app does

| Feature | Summary |
|---|---|
| **Auth** | Register / login with JWT stored in an HTTP-only cookie |
| **Groups** | Create a meal group, invite members via code. **One group per user** — you must leave before joining another |
| **Group chat** | Simple message board for members of the same group |
| **Bazar scheduling** | On the 1st of the month, market duty days are distributed equally & randomly, respecting each user's preference for consecutive days (1, 2, 3, or 5) |
| **Date swapping** | Members can request to swap assigned market dates with each other |
| **Expense tracking** | Log market expenses with dynamic item lists; totals are auto-summed. Track deposits into the group fund |
| **Meal tracking** | Everyone gets 2 meals/day (lunch + dinner) by default. Cancel full day / lunch / dinner — **but only before the previous day's cutoff time** |
| **Monthly billing** | Auto-generated ledger: per-meal rate, each user's meal cost, deposits, and final balance (owed / owes) |

---

## 🧰 Tech Stack

- **Next.js 14** — App Router (`app/` directory), Route Handlers for the API
- **TypeScript** — type safety everywhere
- **MongoDB + Mongoose** — database & schemas
- **JWT (jose)** — authentication via HTTP-only cookies
- **Tailwind CSS** — styling
- **bcryptjs** — password hashing
- **Zod** — request payload validation

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites

- **Node.js 18.17+** (Node 20 LTS recommended) — check with `node -v`
- **npm** (comes with Node)
- A **MongoDB Atlas** account (the connection string below is already set up for this project)

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a file named **`.env.local`** in the project root (this file is git-ignored — never commit it):

```bash
# ── Database ─────────────────────────────────────────────────────────
# Replace <db_password> with your real Atlas password.
# ⚠️ If your password contains special characters (@, :, /, #, etc.),
#    URL-encode them first (e.g. "p@ss" becomes "p%40ss").
MONGODB_URI=mongodb+srv://tarit1243_db_user:<db_password>@mealmanagement.g2gql7i.mongodb.net/meal_management?retryWrites=true&w=majority

# ── Auth ─────────────────────────────────────────────────────────────
# Any long random string. Generate one with:
#   openssl rand -base64 32
JWT_SECRET=replace-me-with-a-long-random-string

# ── Business rules ───────────────────────────────────────────────────
# Meal cancellations for TOMORROW must be submitted before this hour
# (24h clock) TODAY. 22 = 10:00 PM. Dates further ahead are always allowed.
MEAL_CANCEL_CUTOFF_HOUR=22

# Timezone used for all "what day is it?" business logic
APP_TIMEZONE=Asia/Dhaka
```

> **Note:** the path segment `/meal_management` in the URI is the database name — MongoDB creates it automatically on first write. You can rename it if you like.

### 4. Run the dev server

```bash
npm run dev
```

Open **http://localhost:3000** — you should see the login page.

### 5. Build for production (optional check)

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
meal_management_system/
├── README.md                ← you are here
├── FUNCTIONS.md             ← every API route & core function documented
├── .env.local               ← your secrets (never committed)
├── src/
│   ├── app/                 ← Next.js App Router pages + API routes
│   │   ├── (auth)/          ← login & register pages
│   │   ├── (dashboard)/     ← main app UI (group, meals, bazar, reports)
│   │   └── api/             ← Route Handlers (the backend)
│   ├── components/          ← reusable React components
│   ├── lib/                 ← db connection, auth helpers, business logic
│   └── models/              ← Mongoose schemas (single source of truth)
└── ...
```

---

## 🔑 Key Business Rules (quick reference)

1. **One group per user.** Enforced by `User.groupId` — joining fails if it's already set.
2. **Bazar distribution.** `days in month ÷ members` days each; the remainder is assigned randomly. Days come in consecutive blocks matching each user's preference (1, 2, 3, or 5).
3. **Meal cancellation cutoff.** To cancel a meal for day **D**, the request must arrive **before `MEAL_CANCEL_CUTOFF_HOUR` on day D−1** (or any time earlier).
4. **Monthly math.**
   - `perMealRate = totalMarketCost / totalMealsConsumed`
   - `userMealCost = userMeals × perMealRate`
   - `balance = userDeposits − userMealCost` → positive = group owes the user, negative = user owes the group.

---

## 🩺 Troubleshooting

| Problem | Fix |
|---|---|
| `MongoServerError: bad auth` | Wrong password in `MONGODB_URI`, or special characters not URL-encoded |
| `Could not connect to any servers` | In Atlas → Network Access, allow your IP (or `0.0.0.0/0` for development) |
| Login works but instantly logs out | `JWT_SECRET` changed between requests — restart the dev server after editing `.env.local` |
| Dates look off by one day | Check `APP_TIMEZONE` matches where your group actually lives |
