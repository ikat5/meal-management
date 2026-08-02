import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * MIDDLEWARE — the page-level gatekeeper
 * ───────────────────────────────────────
 * Runs before every PAGE request (API routes are excluded by the matcher;
 * they do their own auth via requireUser()).
 *
 *   Not logged in + visiting an app page  → redirect to /login
 *   Logged in     + visiting /login or /register → redirect to /dashboard
 *
 * We verify the JWT signature here with `jose` (works on the Edge runtime,
 * where Node-only libraries like Mongoose cannot run).
 */

const AUTH_PAGES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  let isLoggedIn = false;
  if (token && process.env.JWT_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      isLoggedIn = true;
    } catch {
      // invalid or expired token → treat as logged out
    }
  }

  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything EXCEPT api routes, Next internals, and static files
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
