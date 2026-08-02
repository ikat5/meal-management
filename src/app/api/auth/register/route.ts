import { z } from "zod";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import User from "@/models/User";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
});

/** POST /api/auth/register — create an account (password is bcrypt-hashed) */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const body = registerSchema.parse(await req.json());

  const existing = await User.findOne({ email: body.email.toLowerCase() });
  if (existing) throw new ApiError(409, "This email is already registered");

  // 10 salt rounds ≈ 100ms of hashing — slow enough to resist brute force
  const passwordHash = await bcrypt.hash(body.password, 10);

  const user = await User.create({
    name: body.name,
    email: body.email,
    password: passwordHash,
  });

  return ok(
    { user: { _id: user._id, name: user.name, email: user.email } },
    201
  );
});
