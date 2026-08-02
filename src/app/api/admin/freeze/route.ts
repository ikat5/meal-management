import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupAdmin } from "@/lib/auth";
import { todayInAppTz } from "@/lib/dates";
import { ensureCurrentCycle } from "@/lib/system";

const freezeSchema = z.object({
  action: z.enum(["freeze", "unfreeze"]),
});

/**
 * POST /api/admin/freeze — ADMIN ONLY.
 *
 * "freeze"   → stops the meal system for the rest of the month:
 *              - meal cancels/uncancels, expenses and deposits are rejected
 *              - the live report stops advancing (meals count only up to today)
 *              From here the admin can either Hard Reset, or wait for the
 *              automatic reset on the 1st of next month.
 * "unfreeze" → changed your mind: back to normal, nothing lost.
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const { group } = await requireGroupAdmin();
  await ensureCurrentCycle(group);
  const body = freezeSchema.parse(await req.json());

  if (body.action === "freeze") {
    if (group.mealSystem.status === "FROZEN") {
      throw new ApiError(409, "The meal system is already frozen");
    }
    group.mealSystem.status = "FROZEN";
    group.mealSystem.frozenAt = todayInAppTz();
  } else {
    if (group.mealSystem.status !== "FROZEN") {
      throw new ApiError(409, "The meal system is not frozen");
    }
    group.mealSystem.status = "ACTIVE";
    group.mealSystem.frozenAt = null;
  }

  await group.save();
  return ok({ mealSystem: group.mealSystem });
});
