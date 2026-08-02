import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { monthOf, todayInAppTz } from "@/lib/dates";
import MarketSchedule from "@/models/MarketSchedule";
import SwapRequest from "@/models/SwapRequest";

const respondSchema = z.object({
  swapRequestId: z.string().min(1),
  action: z.enum(["accept", "reject"]),
});

/**
 * POST /api/schedule/swap/respond — the TARGET user answers a swap request.
 * Accepting exchanges the two dates in the schedule document.
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();
  const body = respondSchema.parse(await req.json());

  const request = await SwapRequest.findById(body.swapRequestId);
  if (!request) throw new ApiError(404, "Swap request not found");
  if (String(request.requestedTo) !== String(user._id)) {
    throw new ApiError(403, "This swap request was not sent to you");
  }
  if (request.status !== "pending") {
    throw new ApiError(409, `This request was already ${request.status}`);
  }

  if (body.action === "reject") {
    request.status = "rejected";
    await request.save();
    return ok({ request });
  }

  // ── Accept ──────────────────────────────────────────────────────────
  if (request.targetDate <= todayInAppTz()) {
    request.status = "cancelled"; // too old to act on
    await request.save();
    throw new ApiError(400, "This swap involves a past date and was cancelled");
  }

  const schedule = await MarketSchedule.findOne({
    group: request.group,
    month: monthOf(request.requesterDate),
  });
  if (!schedule) throw new ApiError(404, "The schedule for that month no longer exists");

  const requesterSlot = schedule.assignments.find((a) => a.date === request.requesterDate);
  const targetSlot = schedule.assignments.find((a) => a.date === request.targetDate);

  // Re-check ownership — an earlier swap may have changed things since
  if (
    !requesterSlot ||
    !targetSlot ||
    String(requesterSlot.user) !== String(request.requester) ||
    String(targetSlot.user) !== String(request.requestedTo)
  ) {
    request.status = "cancelled";
    await request.save();
    throw new ApiError(409, "The schedule changed since this request was made — request cancelled");
  }

  // The actual swap: exchange the two user ids
  requesterSlot.user = request.requestedTo;
  targetSlot.user = request.requester;
  await schedule.save();

  request.status = "accepted";
  await request.save();

  await schedule.populate("assignments.user", "name");
  return ok({ request, schedule });
});
