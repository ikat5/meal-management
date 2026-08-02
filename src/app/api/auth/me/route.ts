import { z } from "zod";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";

/** GET /api/auth/me — who am I? (the UI calls this on every page load) */
export const GET = apiHandler(async () => {
  const user = await requireUser();
  return ok({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      groupId: user.groupId,
      bazarPreference: user.bazarPreference,
    },
  });
});

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  // How many consecutive bazar days this user prefers — read by the scheduler
  bazarPreference: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)])
    .optional(),
});

/** PATCH /api/auth/me — update profile (name and/or bazar preference) */
export const PATCH = apiHandler(async (req) => {
  const user = await requireUser();
  const body = patchSchema.parse(await req.json());

  if (body.name !== undefined) user.name = body.name;
  if (body.bazarPreference !== undefined) user.bazarPreference = body.bazarPreference;
  await user.save();

  return ok({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      groupId: user.groupId,
      bazarPreference: user.bazarPreference,
    },
  });
});
