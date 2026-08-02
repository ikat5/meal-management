import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupAdmin } from "@/lib/auth";
import { generateSchedule, generateScheduleForDays } from "@/lib/schedule";
import { currentMonth, monthDates, monthOf } from "@/lib/dates";
import { ensureCurrentCycle } from "@/lib/system";
import MarketSchedule from "@/models/MarketSchedule";
import User from "@/models/User";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dates must look like 2026-08-10");

const generateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must look like 2026-08"),
  // Optional ADMIN OVERRIDE: only (re)assign this date range instead of the
  // whole month. The range must sit inside the current month.
  from: dateStr.optional(),
  to: dateStr.optional(),
});

/**
 * POST /api/schedule/generate — ADMIN ONLY.
 *
 * Two modes:
 *   { month }            → full-month generation (refuses to overwrite)
 *   { month, from, to }  → RANGE generation inside the CURRENT month:
 *                          re-deals only those days among all members,
 *                          leaving every other day untouched. This is the
 *                          admin's manual override / repair tool.
 *
 * (The automatic version of full-month generation runs from
 * /api/cron/tick on the last day of each month.)
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const { group } = await requireGroupAdmin();
  await ensureCurrentCycle(group);
  const body = generateSchema.parse(await req.json());

  // Load each member's consecutive-days preference (default: 2)
  const memberIds = group.members.map((m) => m.user);
  const users = await User.find({ _id: { $in: memberIds } }).select("bazarPreference");
  const members = users.map((u) => ({
    userId: String(u._id),
    preference: u.bazarPreference,
  }));

  // ── Range mode ──────────────────────────────────────────────────────
  if (body.from || body.to) {
    if (!body.from || !body.to) {
      throw new ApiError(400, "Provide both `from` and `to` for a range");
    }
    if (body.from > body.to) throw new ApiError(400, "`from` must be before `to`");
    if (monthOf(body.from) !== body.month || monthOf(body.to) !== body.month) {
      throw new ApiError(400, "The range must be inside the given month");
    }
    if (body.month !== currentMonth()) {
      throw new ApiError(400, "Range overrides are only allowed in the current month");
    }

    const days = monthDates(body.month).filter(
      (d) => d >= body.from! && d <= body.to!
    );
    const rangeAssignments = generateScheduleForDays(members, days);

    // Merge: keep everything outside the range, replace inside it
    let schedule = await MarketSchedule.findOne({ group: group._id, month: body.month });
    if (!schedule) {
      schedule = new MarketSchedule({
        group: group._id,
        month: body.month,
        assignments: [],
      });
    }
    const outside = schedule.assignments.filter(
      (a) => a.date < body.from! || a.date > body.to!
    );
    schedule.assignments = [...outside, ...rangeAssignments]
      .sort((a, b) => a.date.localeCompare(b.date)) as any;
    await schedule.save();
    await schedule.populate("assignments.user", "name");
    return ok({ schedule }, 201);
  }

  // ── Full-month mode ─────────────────────────────────────────────────
  const existing = await MarketSchedule.findOne({ group: group._id, month: body.month });
  if (existing) {
    throw new ApiError(
      409,
      `A schedule for ${body.month} already exists — use a date range to re-deal part of it`
    );
  }

  const assignments = generateSchedule(members, body.month);

  const schedule = await MarketSchedule.create({
    group: group._id,
    month: body.month,
    assignments,
  });
  await schedule.populate("assignments.user", "name");

  return ok({ schedule }, 201);
});
