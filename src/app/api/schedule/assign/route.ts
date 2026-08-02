import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupAdmin } from "@/lib/auth";
import { monthOf } from "@/lib/dates";
import MarketSchedule from "@/models/MarketSchedule";

const assignSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must look like 2026-08-10"),
  userId: z.string().min(1),
});

/**
 * PATCH /api/schedule/assign — ADMIN ONLY manual override.
 * Pins a specific bazar date to a specific member, replacing whoever the
 * random generator gave it to (or filling a gap if the day was empty).
 */
export const PATCH = apiHandler(async (req) => {
  await dbConnect();
  const { group } = await requireGroupAdmin();
  const body = assignSchema.parse(await req.json());

  const isMember = group.members.some((m) => String(m.user) === body.userId);
  if (!isMember) throw new ApiError(400, "That user is not a member of your group");

  const month = monthOf(body.date);
  const schedule = await MarketSchedule.findOne({ group: group._id, month });
  if (!schedule) {
    throw new ApiError(404, `No schedule exists for ${month} — generate one first`);
  }

  const slot = schedule.assignments.find((a) => a.date === body.date);
  if (slot) {
    slot.user = body.userId as any;
  } else {
    schedule.assignments.push({ date: body.date, user: body.userId as any });
    schedule.assignments.sort((a, b) => a.date.localeCompare(b.date));
  }
  await schedule.save();
  await schedule.populate("assignments.user", "name");

  return ok({ schedule });
});
