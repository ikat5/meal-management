import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { addDays, currentMonth, todayInAppTz } from "@/lib/dates";
import { fitNewMember } from "@/lib/schedule";
import Group from "@/models/Group";
import MarketSchedule from "@/models/MarketSchedule";

const joinSchema = z.object({
  inviteCode: z.string().trim().min(4).max(10),
});

/**
 * POST /api/groups/join — join via invite code.
 * STRICT RULE: fails if you're already in a group (leave first).
 *
 * MID-MONTH JOIN: if this month's bazar schedule already exists, the
 * newcomer is automatically dealt a fair share of the REMAINING days
 * (starting tomorrow — today's shopper already has plans), taken in
 * blocks of 2 from the members who currently hold the most days.
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireUser();
  const body = joinSchema.parse(await req.json());

  if (user.groupId) {
    throw new ApiError(409, "You already belong to a group. Leave your current group first.");
  }

  const group = await Group.findOne({ inviteCode: body.inviteCode.toUpperCase() });
  if (!group) throw new ApiError(404, "No group found with that invite code");

  // Membership is written in BOTH places (see Group schema comment)
  group.members.push({ user: user._id, joinedAt: new Date() });
  await group.save();

  user.groupId = group._id;
  await user.save();

  // ── Fit the newcomer into this month's existing schedule ────────────
  let scheduledDays = 0;
  const schedule = await MarketSchedule.findOne({
    group: group._id,
    month: currentMonth(),
  });
  if (schedule) {
    const plain = schedule.assignments.map((a) => ({
      date: a.date,
      user: String(a.user),
    }));
    const { assignments, movedDays } = fitNewMember(
      plain,
      String(user._id),
      addDays(todayInAppTz(), 1)
    );
    if (movedDays > 0) {
      schedule.assignments = assignments as any;
      await schedule.save();
    }
    scheduledDays = movedDays;
  }

  return ok({ group, scheduledDays });
});
