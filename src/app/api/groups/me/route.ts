import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { ensureCurrentCycle } from "@/lib/system";
import Group from "@/models/Group";

/** GET /api/groups/me — my group, with member details filled in */
export const GET = apiHandler(async () => {
  await dbConnect();
  const user = await requireUser();

  if (!user.groupId) throw new ApiError(404, "You are not in a group yet");

  const bare = await Group.findById(user.groupId);
  if (!bare) throw new ApiError(404, "Your group no longer exists");
  await ensureCurrentCycle(bare); // lazy month rollover (auto-reset)

  // populate() swaps member ObjectIds for the actual user fields the UI needs
  const group = await Group.findById(user.groupId)
    .populate("members.user", "name email bazarPreference")
    .populate("admin", "name");

  return ok({ group });
});
