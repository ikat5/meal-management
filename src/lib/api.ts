import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * API HELPERS — the response envelope + one shared error handler
 * ───────────────────────────────────────────────────────────────
 * Every route returns:  { success: true, data }  or  { success: false, error }.
 *
 * Instead of try/catch in all ~20 routes, each route is wrapped in
 * `apiHandler(...)`. Business logic just THROWS `new ApiError(status, msg)`
 * and the wrapper turns it into the right HTTP response.
 */

/** Throw this anywhere inside a route to send a specific HTTP error. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Success response: ok({ user }) → { success: true, data: { user } } */
export function ok(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

type RouteHandler = (req: Request, ctx: any) => Promise<NextResponse>;

export function apiHandler(fn: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err: any) {
      // Next.js control-flow errors (e.g. "this route uses cookies() so it
      // can't be static", thrown while the build probes each route) must
      // propagate — they're signals to the framework, not real failures.
      if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;

      // Errors we threw on purpose (401, 403, 409, ...)
      if (err instanceof ApiError) return fail(err.message, err.status);

      // Zod validation errors → readable 400
      if (err instanceof ZodError) {
        const msg = err.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
          .join("; ");
        return fail(msg, 400);
      }

      // MongoDB unique-index violation (e.g. duplicate email) → 409
      if (err?.code === 11000) return fail("That already exists (duplicate value)", 409);

      // Anything else is a real bug — log it, hide details from the client
      console.error("Unhandled API error:", err);
      return fail("Something went wrong on the server", 500);
    }
  };
}
