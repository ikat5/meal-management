import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { currentMonth, lastDayOfMonth, nextMonth, todayInAppTz } from "@/lib/dates";
import { ensureCurrentCycle } from "@/lib/system";
import { generateSchedule } from "@/lib/schedule";
import Group from "@/models/Group";
import MarketSchedule from "@/models/MarketSchedule";
import User from "@/models/User";

/**
 * GET/POST /api/cron/tick — the daily heartbeat. Call once a day (any
 * time) from a Render Cron Job, cron-job.org, UptimeRobot, etc.:
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/tick
 *
 * What it does, for EVERY group:
 *   1. Month rollover (runs on the first tick of a new month): auto-reset
 *      — unfreeze, wipe the active ledger state, cycle restarts on the 1st.
 *      (This also happens lazily on user traffic; the cron just guarantees
 *      it even if nobody opens the app.)
 *   2. On the LAST day of the month: generate next month's bazar schedule
 *      for every group that doesn't have one yet.
 *
 * Idempotent by design — safe to call as often as you like.
 */
async function tick() {
  await dbConnect();

  const today = todayInAppTz();
  const month = currentMonth();
  const isLastDayOfMonth = today === lastDayOfMonth(month);

  let rolledOver = 0;
  let schedulesGenerated = 0;

  const groups = await Group.find({});
  for (const group of groups) {
    if (await ensureCurrentCycle(group)) rolledOver++;

    if (isLastDayOfMonth && group.members.length > 0) {
      const target = nextMonth(month);
      const exists = await MarketSchedule.findOne({ group: group._id, month: target });
      if (!exists) {
        const users = await User.find({
          _id: { $in: group.members.map((m) => m.user) },
        }).select("bazarPreference");

        await MarketSchedule.create({
          group: group._id,
          month: target,
          assignments: generateSchedule(
            users.map((u) => ({ userId: String(u._id), preference: u.bazarPreference })),
            target
          ),
        });
        schedulesGenerated++;
      }
    }
  }

  return { today, groups: groups.length, rolledOver, schedulesGenerated };
}

function authorize(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError(503, "CRON_SECRET is not configured on the server");

  const header = req.headers.get("authorization") ?? "";
  const query = new URL(req.url).searchParams.get("secret") ?? "";
  if (header !== `Bearer ${secret}` && query !== secret) {
    throw new ApiError(401, "Invalid cron secret");
  }
}

export const GET = apiHandler(async (req) => {
  authorize(req);
  return ok(await tick());
});

export const POST = GET;
