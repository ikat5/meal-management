import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import Group from "@/models/Group";

const createSchema = z.object({
  name: z.string().trim().min(2, "Group name must be at least 2 characters").max(80),
});

// No confusing characters (0/O, 1/I) — codes get read out loud between friends
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * POST /api/groups — create a group. Creator becomes admin + first member.
 * STRICT RULE: one group per user — rejected if you're already in one.
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireUser();
  const body = createSchema.parse(await req.json());

  if (user.groupId) {
    throw new ApiError(409, "You already belong to a group. Leave it first to create a new one.");
  }

  // Retry a few times in the (very unlikely) case of an invite-code collision
  let group = null;
  for (let attempt = 0; attempt < 5 && !group; attempt++) {
    try {
      group = await Group.create({
        name: body.name,
        admin: user._id,
        inviteCode: randomCode(),
        members: [{ user: user._id, joinedAt: new Date() }],
      });
    } catch (err: any) {
      if (err?.code !== 11000) throw err; // only swallow duplicate-code errors
    }
  }
  if (!group) throw new ApiError(500, "Could not generate a unique invite code — try again");

  user.groupId = group._id;
  await user.save();

  return ok({ group }, 201);
});
