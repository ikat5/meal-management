"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, money, prettyDate } from "@/lib/client";
import { StatCard } from "@/components/ui";
import { AdminPanel } from "@/components/AdminPanel";

/**
 * OVERVIEW — the live state of the meal system, recomputed on every
 * visit: today's per-meal rate (strictly up to today), my meals and
 * balance so far, today's bazar duty, and the admin's controls.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { user } = await api("/api/auth/me");
      setMe(user);
      if (user.groupId) {
        // These can 404 legitimately (no group / no schedule yet)
        const [g, s, r] = await Promise.all([
          api("/api/groups/me").catch(() => null),
          api("/api/schedule").catch(() => null),
          api("/api/reports/live").catch(() => null),
        ]);
        setGroup(g?.group ?? null);
        setSchedule(s?.schedule ?? null);
        setLive(r ?? null);
      }
    } catch {
      router.push("/login");
      return;
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="py-16 text-center text-sm text-ink-faint">Loading…</p>;
  }

  const today = new Date().toLocaleDateString("en-CA"); // browser's YYYY-MM-DD
  const todayDuty = schedule?.assignments?.find((a: any) => a.date === today);
  const myNextDuty = schedule?.assignments?.find(
    (a: any) => a.date >= today && a.user?._id === me?._id
  );

  const isAdmin = group && group.admin?._id === me?._id;
  const frozen = group?.mealSystem?.status === "FROZEN";
  const myRow = live?.report?.rows?.find((r: any) => r.user?._id === me?._id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="mt-0.5 text-sm text-ink-secondary">
            {group ? group.name : "No group yet"} · {prettyDate(today)}
          </p>
        </div>
        {group && (
          <span className={`badge ${frozen ? "badge-amber" : "badge-green"}`}>
            {frozen ? "System frozen" : "System active"}
          </span>
        )}
      </div>

      {!group && (
        <div className="card">
          <h2 className="card-title">Get started</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Create a meal group or join one with an invite code — market duties,
            meals and billing all live inside a group.
          </p>
          <Link href="/group" className="btn-primary mt-4">
            Create or join a group
          </Link>
        </div>
      )}

      {group && (
        <>
          {frozen && (
            <p className="alert-error">
              The admin froze the meal system on {group.mealSystem.frozenAt}. Meal
              changes, expenses and deposits are paused until it is reset.
            </p>
          )}

          {/* Live KPIs — strictly up to today */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Per-meal rate"
              value={live ? money(live.report.perMealRate) : "—"}
              hint={live ? `Counting ${prettyDate(live.window.from)} – ${prettyDate(live.window.upTo)}` : "No data yet"}
            />
            <StatCard
              label="My meals so far"
              value={myRow ? String(myRow.mealsConsumed) : "—"}
              hint="2 per day unless cancelled"
            />
            <StatCard
              label="My balance"
              value={myRow ? money(myRow.balance) : "—"}
              tone={myRow ? (myRow.balance >= 0 ? "positive" : "negative") : "default"}
              hint={
                myRow
                  ? myRow.balance >= 0
                    ? "The group owes you"
                    : "You owe the group"
                  : undefined
              }
            />
            <StatCard
              label="Total spent"
              value={live ? money(live.report.totalCost) : "—"}
              hint={live ? `${live.report.totalMeals} meals served` : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="card-title">Today&apos;s market duty</h2>
              <p className="mt-2 text-lg font-semibold">
                {todayDuty
                  ? todayDuty.user?._id === me?._id
                    ? "You"
                    : todayDuty.user?.name
                  : "Nobody assigned"}
              </p>
              <p className="mt-1 text-sm text-ink-secondary">
                {myNextDuty
                  ? `Your next duty: ${prettyDate(myNextDuty.date)}`
                  : "You have no upcoming duty this month"}
              </p>
              <Link
                href="/schedule"
                className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                View full schedule →
              </Link>
            </div>

            <div className="card">
              <h2 className="card-title">Quick actions</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/expenses" className="btn-ghost">Log market expense</Link>
                <Link href="/meals" className="btn-ghost">Cancel a meal</Link>
                <Link href="/reports" className="btn-ghost">Open live ledger</Link>
              </div>
              <p className="mt-3 text-xs text-ink-faint">
                The ledger updates in real time — every figure counts strictly up
                to today, never ahead.
              </p>
            </div>
          </div>

          {isAdmin && (
            <AdminPanel mealSystem={group.mealSystem} onChanged={load} />
          )}
        </>
      )}
    </div>
  );
}
