"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

/**
 * LOGIN PAGE (client component — it's an interactive form).
 * On success the server has already set the HTTP-only cookie, so we just
 * navigate to the dashboard. router.refresh() makes the middleware re-run.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="page-title text-center">L-Split</h1>
        <p className="mt-1 text-sm text-gray-500">Log in to your account</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && <p className="alert-error">{error}</p>}

          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          No account?{" "}
          <Link href="/register" className="font-medium text-emerald-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
