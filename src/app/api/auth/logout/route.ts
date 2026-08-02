import { apiHandler, ok } from "@/lib/api";
import { clearAuthCookie } from "@/lib/auth";

/** POST /api/auth/logout — clear the auth cookie */
export const POST = apiHandler(async () => {
  clearAuthCookie();
  return ok({ loggedOut: true });
});
