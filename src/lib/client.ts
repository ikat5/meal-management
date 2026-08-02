/**
 * TINY CLIENT-SIDE FETCH WRAPPER (used by all "use client" components)
 * ─────────────────────────────────────────────────────────────────────
 *   const { user } = await api("/api/auth/me");
 *   await api("/api/messages", { method: "POST", body: { text: "hi" } });
 *
 * It unwraps the { success, data, error } envelope: on success you get
 * `data` directly; on failure it THROWS, so components handle errors with
 * a simple try/catch and show err.message to the user.
 */

interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error("The server returned an unexpected response");
  }

  if (!res.ok || !json.success) {
    throw new Error(json?.error || "Something went wrong");
  }

  return json.data as T;
}

/** "2026-08-10" → "Aug 10" (for compact UI labels) */
export function prettyDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Money with 2 decimals, e.g. 670.5 → "670.50" */
export function money(n: number): string {
  return n.toFixed(2);
}
