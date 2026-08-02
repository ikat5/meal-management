"use client";

import { useCallback, useEffect, useState } from "react";
import { api, prettyDate } from "@/lib/client";

/**
 * MEALS PAGE
 *  - Cancel meals for a future date (FULL / LUNCH / DINNER) — the server
 *    enforces the "by the previous day" cutoff; the date input's `min` also
 *    hints it in the UI.
 *  - Undo upcoming cancellations.
 *  - Group meal grid: one row per day, one column per member.
 */
export default function MealsPage() {
  const todayStr = new Date().toLocaleDateString("en-CA");
  const tomorrowStr = new Date(Date.now() + 86400000).toLocaleDateString("en-CA");
  const thisMonth = todayStr.slice(0, 7);

  const [month, setMonth] = useState(thisMonth);
  const [grid, setGrid] = useState<any>(null); // { days, members }
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  // cancel form
  const [cancelDate, setCancelDate] = useState(tomorrowStr);
  const [cancelType, setCancelType] = useState<"FULL" | "LUNCH" | "DINNER">("FULL");

  const load = useCallback(async () => {
    setError("");
    try {
      const [{ user }, g] = await Promise.all([
        api("/api/auth/me"),
        api(`/api/meals?month=${month}`),
      ]);
      setMe(user);
      setGrid(g);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api("/api/meals/cancel", {
        method: "POST",
        body: { date: cancelDate, type: cancelType },
      });
      setNotice("Meal cancelled 👍 The cook will know in time.");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUndo(date: string) {
    setError("");
    setNotice("");
    try {
      await api("/api/meals/cancel", { method: "DELETE", body: { date } });
      setNotice("Meals restored for " + prettyDate(date));
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <p className="py-10 text-center text-gray-500">Loading…</p>;

  if (!grid) {
    return <p className="alert-error">{error || "Join a group first — meals are tracked per group."}</p>;
  }

  const myRow = grid.members.find((m: any) => m._id === me?._id);
  const myUpcoming = myRow
    ? Object.entries(myRow.cancellations as Record<string, string>)
        .filter(([date]) => date > todayStr)
        .sort()
    : [];

  // Small helper: what shows in a grid cell for member m on day d
  function cellFor(m: any, d: string) {
    if (d < m.joinDate) return <span className="text-gray-300">—</span>;
    const c = m.cancellations[d];
    if (!c) return <span className="text-emerald-600">L D</span>;
    if (c === "FULL") return <span className="text-red-500">✕</span>;
    if (c === "LUNCH") return <span><s className="text-red-400">L</s> <span className="text-emerald-600">D</span></span>;
    return <span><span className="text-emerald-600">L</span> <s className="text-red-400">D</s></span>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Meals</h1>
        <input
          type="month"
          className="input w-auto"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {error && <p className="alert-error">{error}</p>}
      {notice && <p className="alert-success">{notice}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cancel form */}
        <form onSubmit={handleCancel} className="card space-y-3">
          <h2 className="font-semibold">Cancel a meal 🚫</h2>
          <p className="text-sm text-gray-500">
            By default you have lunch + dinner every day. Cancellations must be
            made <strong>by the previous day</strong> — the server enforces the cutoff.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="cancelDate" className="label">Date</label>
              <input
                id="cancelDate"
                type="date"
                required
                min={tomorrowStr}
                className="input"
                value={cancelDate}
                onChange={(e) => setCancelDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="cancelType" className="label">What to cancel</label>
              <select
                id="cancelType"
                className="input"
                value={cancelType}
                onChange={(e) => setCancelType(e.target.value as any)}
              >
                <option value="FULL">Full day (both meals)</option>
                <option value="LUNCH">Lunch only</option>
                <option value="DINNER">Dinner only</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">Cancel meal</button>
        </form>

        {/* My upcoming cancellations */}
        <div className="card">
          <h2 className="font-semibold">My upcoming cancellations</h2>
          {myUpcoming.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">
              None — you&apos;re eating everything 😄
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {myUpcoming.map(([date, type]) => (
                <li
                  key={date}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
                >
                  <span>
                    <strong>{prettyDate(date)}</strong> —{" "}
                    {type === "FULL" ? "full day" : String(type).toLowerCase()}
                  </span>
                  <button onClick={() => handleUndo(date)} className="btn-ghost">
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Group grid */}
      <div className="card overflow-x-auto">
        <h2 className="font-semibold">
          Group meal grid — {month}{" "}
          <span className="ml-2 text-xs font-normal text-gray-400">
            L = lunch, D = dinner, ✕ = full day off
          </span>
        </h2>
        <table className="mt-3 w-full min-w-[32rem] text-center text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-2 pr-2 text-left font-medium">Day</th>
              {grid.members.map((m: any) => (
                <th key={m._id} className="px-2 py-2 font-medium">
                  {m._id === me?._id ? "You" : m.name.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.days.map((d: string) => (
              <tr
                key={d}
                className={`border-b border-gray-50 ${d === todayStr ? "bg-emerald-50" : ""}`}
              >
                <td className="py-1.5 pr-2 text-left text-gray-600">
                  {prettyDate(d)}
                </td>
                {grid.members.map((m: any) => (
                  <td key={m._id} className="px-2 py-1.5">
                    {cellFor(m, d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-2 text-left">Total meals</td>
              {grid.members.map((m: any) => (
                <td key={m._id} className="px-2 py-2">
                  {m.mealsForMonth}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
