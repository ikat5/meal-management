"use client";

import { useCallback, useEffect, useState } from "react";
import { api, money, prettyDate } from "@/lib/client";
import { StatCard } from "@/components/ui";

/**
 * LEDGER PAGE
 *   "Live" tab      → the real-time report, recomputed on every visit and
 *                     strictly counting data up to TODAY (or the freeze day).
 *   "Snapshots" tab → frozen end-of-month reports the admin generated.
 */
export default function ReportsPage() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [tab, setTab] = useState<"live" | "snapshot">("live");
  const [month, setMonth] = useState(thisMonth);
  const [me, setMe] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const [{ user }, g] = await Promise.all([
        api("/api/auth/me"),
        api("/api/groups/me").catch(() => null),
      ]);
      setMe(user);
      setGroup(g?.group ?? null);
      if (g?.group) {
        const [liveData, snapData] = await Promise.all([
          api("/api/reports/live").catch(() => null),
          api(`/api/reports?month=${month}`).catch(() => null),
        ]);
        setLive(liveData);
        setSnapshot(snapData?.report ?? null);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    setError("");
    setNotice("");
    try {
      await api("/api/reports/generate", { method: "POST", body: { month } });
      setNotice("Snapshot generated — re-generating replaces it.");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-ink-faint">Loading…</p>;
  }

  if (!group) {
    return <p className="alert-error">Join a group first — the ledger is per group.</p>;
  }

  const isAdmin = group.admin?._id === me?._id;
  const frozen = live?.mealSystem?.status === "FROZEN";

  const Ledger = ({ rows }: { rows: any[] }) => (
    <div className="card overflow-x-auto p-0">
      <table className="table min-w-[32rem]">
        <thead>
          <tr>
            <th className="pl-5">Member</th>
            <th className="text-right">Meals</th>
            <th className="text-right">Meal cost</th>
            <th className="text-right">Deposits</th>
            <th className="pr-5 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any) => {
            const positive = row.balance >= 0;
            return (
              <tr key={row.user?._id ?? row._id}>
                <td className="pl-5 font-medium">
                  {row.user?.name}
                  {row.user?._id === me?._id && (
                    <span className="ml-1.5 text-xs text-ink-faint">you</span>
                  )}
                </td>
                <td className="num text-right">{row.mealsConsumed}</td>
                <td className="num text-right">{money(row.mealCost)}</td>
                <td className="num text-right">{money(row.deposits)}</td>
                <td
                  className={`num pr-5 text-right font-semibold ${
                    positive ? "text-brand-700" : "text-red-600"
                  }`}
                >
                  {positive ? "+" : ""}
                  {money(row.balance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Ledger</h1>
          <p className="mt-0.5 text-sm text-ink-secondary">
            Positive balance — the group owes the member. Negative — the member
            owes the group.
          </p>
        </div>
        <div className="flex rounded-lg border border-line bg-white p-0.5">
          {(["live", "snapshot"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t
                  ? "bg-brand-50 text-brand-800"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              {t === "live" ? "Live" : "Snapshots"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {notice && <p className="alert-success">{notice}</p>}

      {tab === "live" && (
        <>
          {!live ? (
            <div className="card text-center text-sm text-ink-secondary">
              No live data yet — it appears with the first expense or meal day.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`badge ${frozen ? "badge-amber" : "badge-green"}`}>
                  {frozen
                    ? `Frozen — counting stopped at ${live.mealSystem.frozenAt}`
                    : "Live — updates daily"}
                </span>
                <span className="text-xs text-ink-faint">
                  Counting {prettyDate(live.window.from)} – {prettyDate(live.window.upTo)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <StatCard
                  label="Total spent"
                  value={money(live.report.totalCost)}
                />
                <StatCard
                  label="Total meals"
                  value={String(live.report.totalMeals)}
                />
                <StatCard
                  label="Per-meal rate"
                  value={money(live.report.perMealRate)}
                  hint="Total spent ÷ total meals"
                />
              </div>

              <Ledger rows={live.report.rows} />
            </>
          )}
        </>
      )}

      {tab === "snapshot" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              className="input w-auto"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            {isAdmin && (
              <button onClick={handleGenerate} className="btn-primary whitespace-nowrap">
                {snapshot ? "Re-generate snapshot" : "Generate snapshot"}
              </button>
            )}
          </div>

          {!snapshot ? (
            <div className="card text-center text-sm text-ink-secondary">
              <p>No snapshot for {month}.</p>
              <p className="mt-1">
                {isAdmin
                  ? "Generate one at month end to lock the final numbers."
                  : `Ask your admin (${group.admin?.name}) to generate it.`}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Total spent" value={money(snapshot.totalCost)} />
                <StatCard label="Total meals" value={String(snapshot.totalMeals)} />
                <StatCard label="Per-meal rate" value={money(snapshot.perMealRate)} />
              </div>
              <Ledger rows={snapshot.rows} />
              <p className="text-xs text-ink-faint">
                Snapshot generated by {snapshot.generatedBy?.name} on{" "}
                {new Date(snapshot.updatedAt).toLocaleString()}. Snapshots are
                frozen — later edits don&apos;t change them.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
