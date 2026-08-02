# 📚 FUNCTIONS.md — API Routes & Core Logic Reference

Every major function in the system, grouped by feature. For each API route you'll find:
**purpose → request payload → response**.

All API routes live under `src/app/api/.../route.ts` (Next.js Route Handlers).
All responses share this envelope:

```jsonc
// Success
{ "success": true,  "data": { ... } }
// Failure
{ "success": false, "error": "Human-readable message" }
```

Authentication: after login, a JWT is set as an **HTTP-only cookie** named `token`.
Every protected route reads it server-side — the browser never touches the token via JS.

---

## 1. Authentication

### `POST /api/auth/register`
Create a new account. Password is hashed with bcrypt before saving.

**Payload**
```json
{ "name": "Tarit", "email": "tarit@example.com", "password": "min 6 chars" }
```
**Response** `201`
```json
{ "success": true, "data": { "user": { "_id": "...", "name": "Tarit", "email": "tarit@example.com" } } }
```
Errors: `409` email already registered, `400` validation failed.

### `POST /api/auth/login`
Verify credentials, sign a JWT (`{ userId }`, 7-day expiry), set it as an HTTP-only cookie.

**Payload**
```json
{ "email": "tarit@example.com", "password": "..." }
```
**Response** `200` — same user shape as register, plus the `Set-Cookie` header.
Errors: `401` invalid credentials.

### `POST /api/auth/logout`
Clears the `token` cookie. No payload. Response: `{ "success": true }`.

### `GET /api/auth/me`
Returns the currently logged-in user (used by the UI on page load).

**Response** `200`
```json
{ "success": true, "data": { "user": { "_id": "...", "name": "...", "email": "...", "groupId": "... | null", "bazarPreference": 2 } } }
```
Errors: `401` not logged in.

### `PATCH /api/auth/me`
Update your profile — currently your name and/or your **bazar preference**
(how many consecutive market days you want; read by the scheduler).

**Payload**
```json
{ "bazarPreference": 3 }   // 1 | 2 | 3 | 5 — and/or "name": "New Name"
```
**Response** `200` — the updated user (same shape as GET).

---

## 2. Group Management

### `POST /api/groups`
Create a group. The creator becomes **admin** and is auto-added as the first member.
**Strict rule:** fails with `409` if the user already belongs to a group.

**Payload**
```json
{ "name": "Bachelor Mess 2026" }
```
**Response** `201`
```json
{ "success": true, "data": { "group": { "_id": "...", "name": "...", "inviteCode": "X7KP2Q", "admin": "...", "members": ["..."] } } }
```

### `POST /api/groups/join`
Join a group using its invite code.
**Strict rule:** fails with `409` ("Leave your current group first") if `User.groupId` is already set.

**Payload**
```json
{ "inviteCode": "X7KP2Q" }
```
**Response** `200` — the joined group.

### `POST /api/groups/leave`
Leave your current group. Clears `User.groupId` and removes you from `Group.members`.
If the admin leaves, the oldest remaining member becomes admin; if the group empties, it is deleted.
No payload. **Response** `200 { "success": true }`.

### `GET /api/groups/me`
Get your group with populated member details (names, emails, bazar preferences).
**Response** `200` — group object, or `404` if you're not in a group.

---

## 3. Group Chat

### `GET /api/messages?limit=50&before=<ISO date>`
Fetch recent messages for **your** group (newest first, simple cursor pagination).

**Response** `200`
```json
{ "success": true, "data": { "messages": [ { "_id": "...", "sender": { "_id": "...", "name": "Tarit" }, "text": "Who has bazar tomorrow?", "createdAt": "..." } ] } }
```

### `POST /api/messages`
Send a message to your group.

**Payload**
```json
{ "text": "I'll do the bazar tomorrow" }
```
**Response** `201` — the created message. Errors: `403` not in a group, `400` empty text.

---

## 4. Market (Bazar) Scheduling

### `POST /api/schedule/generate`
**Admin only.** Two modes:

- `{ "month": "2026-08" }` — full-month generation. Fails with `409` if a schedule
  already exists. (The automatic version runs from `/api/cron/tick` on the **last day
  of the previous month**.)
- `{ "month": "2026-08", "from": "2026-08-10", "to": "2026-08-16" }` — **admin
  override**: re-deals only that date range among all members, leaving every other
  day untouched. Only allowed inside the current month.

**Response** `201`
```json
{ "success": true, "data": { "schedule": { "month": "2026-08", "assignments": [ { "date": "2026-08-01", "user": { "_id": "...", "name": "Tarit" } } ] } } }
```

### `PATCH /api/schedule/assign`
**Admin only.** Manually pins a specific date to a specific member (replaces whoever
had it, or fills an empty day).

**Payload**
```json
{ "date": "2026-08-14", "userId": "..." }
```
**Response** `200` — the updated schedule.

### Mid-month joiners — `fitNewMember()` (in `src/lib/schedule.ts`)
When someone joins a group and this month's schedule already exists
(`POST /api/groups/join`), they are automatically dealt a fair share of the
**remaining** days: `floor(remaining / (members + 1))` days, taken in blocks of 2
from whoever currently holds the most days (always from the end of their latest
consecutive run, so everyone's blocks stay contiguous).

### Core algorithm — `generateSchedule(members, month)` (in `src/lib/schedule.ts`)
1. Count the days in the month (e.g., 31).
2. `base = floor(days / memberCount)` days each; the remainder days go to randomly-picked members (+1 each).
3. Split each member's quota into **blocks of their preferred consecutive size** (1, 2, 3, or 5). A quota of 7 with preference 3 becomes blocks `[3, 3, 1]`.
4. Shuffle all blocks (Fisher–Yates), then lay them onto the month's days in order.
   Result: every day has exactly one assigned user, preferences are respected, and the order is random each month.

### `GET /api/schedule?month=2026-08`
Get the schedule for a month (any member). `404` if not generated yet.

### `POST /api/schedule/swap`
Request to swap one of **your** dates with another member's date.

**Payload**
```json
{ "myDate": "2026-08-10", "targetUserId": "...", "targetDate": "2026-08-15" }
```
**Response** `201` — a `SwapRequest` with `status: "pending"`.
Errors: `400` if either date isn't assigned to the stated user, or the date is in the past.

### `POST /api/schedule/swap/respond`
The **target user** accepts or rejects. On accept, the two dates are exchanged in the schedule
and the request is marked `accepted`.

**Payload**
```json
{ "swapRequestId": "...", "action": "accept" }   // or "reject"
```
**Response** `200` — updated swap request (and updated schedule on accept).

### `GET /api/schedule/swap`
List swap requests involving you (incoming + outgoing), newest first.

---

## 5. Expense & Deposit Tracking

### `POST /api/expenses`
Log a market expense for a day. **Total is computed server-side** — the client never sends it
(prevents tampering and math mistakes).

**Payload**
```json
{
  "date": "2026-08-10",
  "items": [
    { "name": "Rice", "price": 450 },
    { "name": "Vegetables", "price": 220.5 }
  ]
}
```
**Response** `201`
```json
{ "success": true, "data": { "expense": { "_id": "...", "date": "2026-08-10", "items": [...], "totalAmount": 670.5 } } }
```

### `GET /api/expenses?month=2026-08`
All expenses in your group for a month + a `monthTotal` sum.

### `POST /api/deposits`
Record money a user puts into the group fund.

**Payload**
```json
{ "amount": 2000, "date": "2026-08-05", "note": "August contribution" }
```
**Response** `201` — the deposit.

### `GET /api/deposits?month=2026-08`
All deposits for the month, plus per-user subtotals.

---

## 6. Meal Tracking & Cancellation

**Mental model:** we never store "user X ate lunch on day Y" for every meal — that would be
thousands of rows. Instead, everyone is assumed to have **2 meals/day**, and we only store
**cancellations**. Meals consumed = `daysInMonth × 2 − cancelled meal slots`.

### `POST /api/meals/cancel`
Cancel meals for a future date.

**Payload**
```json
{ "date": "2026-08-12", "type": "FULL" }   // "FULL" | "LUNCH" | "DINNER"
```
**Cutoff rule (`assertBeforeCutoff(date)` in `src/lib/meals.ts`):**
- `date` must be **later than today** (you can never cancel today or the past), and
- if `date` is **tomorrow**, the request must arrive **before `MEAL_CANCEL_CUTOFF_HOUR`** (default 22:00) today, in `APP_TIMEZONE`.

**Response** `201` — the cancellation. Errors: `400` past the cutoff, `409` already cancelled.

### `DELETE /api/meals/cancel`
Undo a cancellation (same cutoff rule applies — you can't un-cancel tomorrow's meal after cutoff).

**Payload**
```json
{ "date": "2026-08-12" }
```

### `GET /api/meals?month=2026-08`
Your group's meal grid for the month: for each member × day, whether lunch/dinner is ON or OFF,
plus running per-user meal counts.

---

## 7. Monthly Report & Billing

### `POST /api/reports/generate`
**Admin only.** Intended for the last day of the month (or any time after). Snapshots the
month into a `MonthlyReport` document so the numbers are frozen even if data changes later.
Re-generating overwrites the previous snapshot for that month.

**Payload**
```json
{ "month": "2026-08" }
```

### Core math — `calculateMonthlyReport(groupId, month)` (in `src/lib/report.ts`)
```
totalCost      = Σ Expense.totalAmount            (whole group, whole month)
totalMeals     = Σ over users: daysInMonth × 2 − user's cancelled slots
perMealRate    = totalCost / totalMeals           (0 if no meals)
For each user:
  mealsConsumed = daysInMonth × 2 − their cancelled slots
  mealCost      = mealsConsumed × perMealRate
  deposits      = Σ their Deposits in the month
  balance       = deposits − mealCost
```
`balance > 0` → the group owes the user. `balance < 0` → the user owes the group.

> **Fairness note:** members who joined mid-month are counted from their join date, not day 1.

**Response** `201`
```json
{
  "success": true,
  "data": {
    "report": {
      "month": "2026-08",
      "totalCost": 15000,
      "totalMeals": 290,
      "perMealRate": 51.72,
      "rows": [
        { "user": { "name": "Tarit" }, "mealsConsumed": 58, "mealCost": 2999.76, "deposits": 3500, "balance": 500.24 }
      ]
    }
  }
}
```

### `GET /api/reports?month=2026-08`
Fetch a previously generated report. `404` if not generated yet.

### `GET /api/reports/live`
The **real-time ledger** — nothing stored, recomputed on every call. Uses the same
billing math but with a **window** that counts strictly **up to today** (never
future days): `from = cycle start` (the 1st, or the hard-reset day) and
`upTo = min(today, month end, freeze day)`. Every user is assumed to eat 2
meals/day inside the window unless a cancellation row exists.

**Response** `200`
```json
{
  "success": true,
  "data": {
    "month": "2026-08",
    "window": { "from": "2026-08-01", "upTo": "2026-08-03" },
    "mealSystem": { "status": "ACTIVE", "cycleStart": "2026-08-01", "frozenAt": null },
    "report": { "totalCost": 1200, "totalMeals": 24, "perMealRate": 50, "rows": [ ... ] }
  }
}
```

---

## 8. Global Admin Controls (freeze / reset)

The group document carries a `mealSystem` state machine:

```
ACTIVE ──(admin freezes)──▶ FROZEN ──(admin hard-resets)──▶ ACTIVE
   ▲                                                          │
   └────────(new month begins → automatic reset)──────────────┘
```

### `POST /api/admin/freeze`
**Admin only.** `{ "action": "freeze" }` stops the meal system for the rest of the
month: meal cancels, expenses and deposits are rejected with `423 Locked`, and the
live report stops counting at the freeze date. `{ "action": "unfreeze" }` resumes.

### `POST /api/admin/reset`
**Admin only, and only while FROZEN** (deliberate two-step confirmation). The
**hard reset**: deletes the current month's expenses, deposits, cancellations,
market schedule, swap requests and report snapshot, then restarts the system from
scratch with `cycleStart = today`.

### `GET|POST /api/cron/tick`
The daily heartbeat, authorized by `Authorization: Bearer <CRON_SECRET>` (or
`?secret=`). Idempotent. For every group:
1. **Month rollover** — if the stored `mealSystem.month` is stale, auto-reset:
   unfreeze, `cycleStart` = the 1st. (Also happens lazily on normal user traffic,
   so the app self-heals even without cron.)
2. **Last day of the month** — generates next month's bazar schedule for every
   group that doesn't have one.

See `RENDER_DEPLOYMENT.md` Step 6 for wiring this to a scheduler.

---

## 9. Shared Helpers (in `src/lib/`)

| Function | File | Purpose |
|---|---|---|
| `dbConnect()` | `db.ts` | Cached Mongoose connection (survives Next.js hot-reload; one pool per server) |
| `signToken(userId)` / `verifyToken(token)` | `auth.ts` | Create / validate the JWT |
| `getCurrentUser()` | `auth.ts` | Read the cookie in a Route Handler → return the `User` doc or `null` |
| `requireUser()` / `requireGroupMember()` / `requireGroupAdmin()` | `auth.ts` | Guards that throw a typed 401/403 error, caught by a shared error wrapper |
| `todayInAppTz()` / `daysInMonth(month)` | `dates.ts` | Timezone-safe "what day is it" + calendar helpers. **All business dates are `YYYY-MM-DD` strings** — no UTC-midnight bugs |
| `generateSchedule(members, month)` / `generateScheduleForDays(members, days)` | `schedule.ts` | Bazar distribution algorithm (see §4) |
| `fitNewMember(assignments, userId, fromDate)` | `schedule.ts` | Deal a mid-month joiner into the remaining days (see §4) |
| `assertBeforeCutoff(date)` | `meals.ts` | Cancellation cutoff rule (see §6) |
| `calculateReport(groupId, month, window)` / `calculateMonthlyReport(groupId, month)` | `report.ts` | Billing math over an arbitrary date window (see §7) |
| `ensureCurrentCycle(group)` / `requireActiveSystem(groupId)` / `billingWindow(group, month)` | `system.ts` | Meal-system lifecycle: lazy month rollover, freeze guard, live-report window (see §8) |
