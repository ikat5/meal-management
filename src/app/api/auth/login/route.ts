import { z } from "zod";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { signToken, setAuthCookie } from "@/lib/auth";
import User from "@/models/User";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "Password is required"),
});

/** POST /api/auth/login — verify credentials, set the HTTP-only JWT cookie */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const body = loginSchema.parse(await req.json());

  // password has select:false in the schema — opt in explicitly here
  const user = await User.findOne({ email: body.email.toLowerCase() }).select(
    "+password"
  );

  // Same error for "no such user" and "wrong password" — never help attackers
  // figure out which emails have accounts.
  if (!user || !(await bcrypt.compare(body.password, user.password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = await signToken(String(user._id));
  setAuthCookie(token);

  return ok({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      groupId: user.groupId,
    },
  });
});
