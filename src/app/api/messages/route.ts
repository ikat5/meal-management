import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import Message from "@/models/Message";

/**
 * GET /api/messages?limit=50&before=<ISO date> — recent group chat, newest
 * first. Pass the oldest message's createdAt as `before` to load older pages.
 */
export const GET = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const before = url.searchParams.get("before");

  const filter: Record<string, unknown> = { group: user.groupId };
  if (before) filter.createdAt = { $lt: new Date(before) };

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name");

  return ok({ messages });
});

const sendSchema = z.object({
  text: z.string().trim().min(1, "Message cannot be empty").max(1000),
});

/** POST /api/messages — send a message to my group */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();
  const body = sendSchema.parse(await req.json());

  const message = await Message.create({
    group: user.groupId,
    sender: user._id,
    text: body.text,
  });
  await message.populate("sender", "name");

  return ok({ message }, 201);
});
