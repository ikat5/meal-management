import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import Group from "@/models/Group";

/**
 * POST /api/groups/leave — leave your current group.
 * - If the admin leaves, the longest-standing remaining member becomes admin.
 * - If the last member leaves, the group document is deleted.
 *   (Historical data — expenses, reports — is kept for record-keeping.)
 */
export const POST = apiHandler(async () => {
  await dbConnect();
  const user = await requireUser();

  if (!user.groupId) throw new ApiError(400, "You are not in a group");

  const group = await Group.findById(user.groupId);

  // Always free the user, even if the group doc is somehow missing
  user.groupId = null;
  await user.save();

  if (group) {
    group.members = group.members.filter(
      (m) => String(m.user) !== String(user._id)
    );

    if (group.members.length === 0) {
      await group.deleteOne();
    } else {
      if (String(group.admin) === String(user._id)) {
        // Promote the member who joined earliest
        const oldest = [...group.members].sort(
          (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
        )[0];
        group.admin = oldest.user;
      }
      await group.save();
    }
  }

  return ok({ left: true });
});
