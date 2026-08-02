import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { Types } from "mongoose";
import dbConnect from "./db";
import { ApiError } from "./api";
import User from "@/models/User";
import Group from "@/models/Group";

/**
 * AUTH HELPERS — JWT in an HTTP-only cookie
 * ──────────────────────────────────────────
 * Flow: login → signToken(userId) → setAuthCookie(token).
 * The cookie is HTTP-only, so browser JavaScript can NEVER read the token
 * (protects against XSS token theft). Every protected route calls one of
 * the require* guards below, which throw a typed error that apiHandler
 * turns into a 401/403 response.
 */

const COOKIE_NAME = "token";
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET — see README.md, step 3");
  return new TextEncoder().encode(secret);
}

export async function signToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_LIFETIME_SECONDS}s`)
    .sign(getSecret());
}

/** Returns the userId inside a valid token, or null if invalid/expired */
export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload.userId as string) ?? null;
  } catch {
    return null; // wrong signature, expired, malformed — all just "not logged in"
  }
}

export function setAuthCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true, // JS cannot read it
    secure: process.env.NODE_ENV === "production", // HTTPS-only in prod
    sameSite: "lax", // basic CSRF protection
    path: "/",
    maxAge: TOKEN_LIFETIME_SECONDS,
  });
}

export function clearAuthCookie() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/** The logged-in user's document, or null. Password is excluded by the schema. */
export async function getCurrentUser() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = await verifyToken(token);
  if (!userId || !Types.ObjectId.isValid(userId)) return null;
  await dbConnect();
  return User.findById(userId);
}

/** Guard: must be logged in → 401 otherwise */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "You must be logged in");
  return user;
}

/** Guard: must be logged in AND in a group → 403 otherwise */
export async function requireGroupMember() {
  const user = await requireUser();
  if (!user.groupId) throw new ApiError(403, "You are not in a group yet");
  return user;
}

/** Guard: must be the admin of their group → 403 otherwise */
export async function requireGroupAdmin() {
  const user = await requireGroupMember();
  const group = await Group.findById(user.groupId);
  if (!group) throw new ApiError(404, "Your group no longer exists");
  if (String(group.admin) !== String(user._id)) {
    throw new ApiError(403, "Only the group admin can do this");
  }
  return { user, group };
}
