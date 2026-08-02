import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { assertBeforeCutoff } from "@/lib/meals";
import { requireActiveSystem } from "@/lib/system";
import MealCancellation from "@/models/MealCancellation";

const cancelSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must look like 2026-08-12"),
  type: z.enum(["FULL", "LUNCH", "DINNER"]),
});

/**
 * POST /api/meals/cancel — cancel meals for a future date.
 * THE STRICT RULE lives in assertBeforeCutoff(): must be submitted by the
 * previous day (before the cutoff hour if the date is tomorrow).
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();
  const body = cancelSchema.parse(await req.json());

  await requireActiveSystem(user.groupId); // throws 423 while frozen
  assertBeforeCutoff(body.date); // throws 400 if too late

  // One row per user per day: same type again → 409; different type → update
  const existing = await MealCancellation.findOne({ user: user._id, date: body.date });
  if (existing) {
    if (existing.type === body.type) {
      throw new ApiError(409, "You already cancelled this — no change needed");
    }
    existing.type = body.type;
    await existing.save();
    return ok({ cancellation: existing });
  }

  const cancellation = await MealCancellation.create({
    group: user.groupId,
    user: user._id,
    date: body.date,
    type: body.type,
  });

  return ok({ cancellation }, 201);
});

const undoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * DELETE /api/meals/cancel — undo a cancellation (meals back ON).
 * The same cutoff applies: the cook needs to know by the previous day.
 */
export const DELETE = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();
  const body = undoSchema.parse(await req.json());

  await requireActiveSystem(user.groupId); // throws 423 while frozen
  assertBeforeCutoff(body.date);

  const removed = await MealCancellation.findOneAndDelete({
    user: user._id,
    date: body.date,
  });
  if (!removed) throw new ApiError(404, "No cancellation found for that date");

  return ok({ restored: true });
});
