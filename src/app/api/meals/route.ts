import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { currentMonth, dateStrInAppTz, monthDates } from "@/lib/dates";
import { cancelledSlots } from "@/lib/meals";
import Group from "@/models/Group";
import MealCancellation from "@/models/MealCancellation";

/**
 * GET /api/meals?month=2026-08 — the group's meal grid for a month.
 * For each member: their cancellations as a {date → type} map, plus their
 * projected meal count (active days × 2 − cancelled slots).
 */
export const GET = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiError(400, "month must look like 2026-08");

  const group = await Group.findById(user.groupId).populate("members.user", "name");
  if (!group) throw new ApiError(404, "Your group no longer exists");

  const days = monthDates(month);
  const cancellations = await MealCancellation.find({
    group: user.groupId,
    date: { $gte: days[0], $lte: days[days.length - 1] },
  });

  const members = group.members.map((m) => {
    const memberUser = m.user as any; // populated: { _id, name }
    const userId = String(memberUser._id);
    const joinDate = dateStrInAppTz(m.joinedAt);
    const activeDays = days.filter((d) => d >= joinDate).length;

    const myCancellations: Record<string, string> = {};
    let slots = 0;
    for (const c of cancellations) {
      if (String(c.user) === userId && c.date >= joinDate) {
        myCancellations[c.date] = c.type;
        slots += cancelledSlots(c.type);
      }
    }

    return {
      _id: userId,
      name: memberUser.name,
      joinDate,
      cancellations: myCancellations,
      mealsForMonth: Math.max(0, activeDays * 2 - slots),
    };
  });

  return ok({ month, days, members });
});
