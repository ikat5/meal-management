import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { monthOf, todayInAppTz } from "@/lib/dates";
import MarketSchedule from "@/models/MarketSchedule";
import SwapRequest from "@/models/SwapRequest";

/** GET /api/schedule/swap — swap requests involving me (both directions) */
export const GET = apiHandler(async () => {
  await dbConnect();
  const user = await requireGroupMember();

  const requests = await SwapRequest.find({
    group: user.groupId,
    $or: [{ requester: user._id }, { requestedTo: user._id }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("requester", "name")
    .populate("requestedTo", "name");

  return ok({ requests });
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dates must look like 2026-08-10");

const swapSchema = z.object({
  myDate: dateStr,
  targetUserId: z.string().min(1),
  targetDate: dateStr,
});

/**
 * POST /api/schedule/swap — offer to trade one of MY bazar dates for
 * another member's date. Nothing changes until they accept.
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();
  const body = swapSchema.parse(await req.json());

  const today = todayInAppTz();
  if (body.myDate <= today || body.targetDate <= today) {
    throw new ApiError(400, "Only future dates can be swapped");
  }
  if (monthOf(body.myDate) !== monthOf(body.targetDate)) {
    throw new ApiError(400, "Both dates must be in the same month");
  }
  if (String(body.targetUserId) === String(user._id)) {
    throw new ApiError(400, "You cannot swap with yourself");
  }

  // Verify both dates are really assigned to the people we think
  const schedule = await MarketSchedule.findOne({
    group: user.groupId,
    month: monthOf(body.myDate),
  });
  if (!schedule) throw new ApiError(404, "No schedule exists for that month");

  const mine = schedule.assignments.find((a) => a.date === body.myDate);
  const theirs = schedule.assignments.find((a) => a.date === body.targetDate);

  if (!mine || String(mine.user) !== String(user._id)) {
    throw new ApiError(400, `${body.myDate} is not assigned to you`);
  }
  if (!theirs || String(theirs.user) !== String(body.targetUserId)) {
    throw new ApiError(400, `${body.targetDate} is not assigned to that member`);
  }

  const duplicate = await SwapRequest.findOne({
    group: user.groupId,
    requester: user._id,
    requesterDate: body.myDate,
    targetDate: body.targetDate,
    status: "pending",
  });
  if (duplicate) throw new ApiError(409, "You already have a pending request for this swap");

  const request = await SwapRequest.create({
    group: user.groupId,
    requester: user._id,
    requestedTo: body.targetUserId,
    requesterDate: body.myDate,
    targetDate: body.targetDate,
  });
  await request.populate([
    { path: "requester", select: "name" },
    { path: "requestedTo", select: "name" },
  ]);

  return ok({ request }, 201);
});
