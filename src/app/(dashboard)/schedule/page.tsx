"use client";

import { useCallback, useEffect, useState } from "react";
import { api, prettyDate } from "@/lib/client";
import { Modal } from "@/components/ui";

/**
 * MARKET SCHEDULE PAGE
 *  - month picker + duty roster (your days highlighted)
 *  - swap: offer one of YOUR future dates for someone else's; incoming
 *    requests open in a modal dialog
 *  - admin toolbox: generate the month, re-deal a date range, or pin a
 *    specific date to a specific member
 */
export default function SchedulePage() {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [me, setMe] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [schedule, setSchedule] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [inboxOpen, setInboxOpen] = useState(false);

  // swap form
  const [myDate, setMyDate] = useState("");
  const [targetKey, setTargetKey] = useState(""); // "userId|date"

  // admin tools
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [pinDate, setPinDate] = useState("");
  const [pinUser, setPinUser] = useState("");

  const load = useCallback(async () => {
    setError("");
    setSchedule(null);
    try {
      const [{ user }, g] = await Promise.all([
        api("/api/auth/me"),
        api("/api/groups/me").catch(() => null),
      ]);
      setMe(user);
      setGroup(g?.group ?? null);

      try {
        const s = await api(`/api/schedule?month=${month}`);
        setSchedule(s.schedule);
      } catch {
        // 404 = simply not generated yet
      }
      try {
        const r = await api("/api/schedule/swap");
        setRequests(r.requests);
      } catch {}
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(message: string) {
    setError("");
    setNotice(message);
  }

  async function run(action: () => Promise<void>) {
    setError("");
    setNotice("");
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const handleGenerate = () =>
    run(async () => {
      await api("/api/schedule/generate", { method: "POST", body: { month } });
      flash("Schedule generated.");
    });

  const handleRedeal = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/api/schedule/generate", {
        method: "POST",
        body: { month, from: rangeFrom, to: rangeTo },
      });
      setRangeFrom("");
      setRangeTo("");
      flash("Range re-dealt among all members.");
    });
  };

  const handlePin = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/api/schedule/assign", {
        method: "PATCH",
        body: { date: pinDate, userId: pinUser },
      });
      setPinDate("");
      setPinUser("");
      flash("Date assigned.");
    });
  };

  const handleSwapRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const [targetUserId, targetDate] = targetKey.split("|");
    run(async () => {
      await api("/api/schedule/swap", {
        method: "POST",
        body: { myDate, targetUserId, targetDate },
      });
      setMyDate("");
      setTargetKey("");
      flash("Swap request sent — waiting for their approval.");
    });
  };

  const handleRespond = (id: string, action: "accept" | "reject") =>
    run(async () => {
      await api("/api/schedule/swap/respond", {
        method: "POST",
        body: { swapRequestId: id, action },
      });
      flash(action === "accept" ? "Swap approved — dates exchanged." : "Request rejected.");
    });

  if (loading) {
    return <p className="py-16 text-center text-sm text-ink-faint">Loading…</p>;
  }

  if (!group) {
    return (
      <p className="alert-error">
        Join a group first — the market schedule lives inside a group.
      </p>
    );
  }

  const isAdmin = group.admin?._id === me?._id;
  const today = new Date().toLocaleDateString("en-CA");
  const myFutureDates =
    schedule?.assignments?.filter(
      (a: any) => a.user?._id === me?._id && a.date > today
    ) ?? [];
  const othersFutureDates =
    schedule?.assignments?.filter(
      (a: any) => a.user?._id !== me?._id && a.date > today
    ) ?? [];
  const incoming = requests.filter(
    (r) => r.requestedTo?._id === me?._id && r.status === "pending"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Market schedule</h1>
          <p className="mt-0.5 text-sm text-ink-secondary">
            Duties are dealt in blocks of 2 consecutive days by default.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setInboxOpen(true)} className="btn-ghost relative">
            Swap requests
            {incoming.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-semibold text-white">
                {incoming.length}
              </span>
            )}
          </button>
          <input
            type="month"
            className="input w-auto"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {notice && <p className="alert-success">{notice}</p>}

      {!schedule && (
        <div className="card text-center">
          <p className="text-sm text-ink-secondary">No schedule for {month} yet.</p>
          {isAdmin ? (
            <>
              <p className="mt-1 text-sm text-ink-faint">
                Days are split equally and placed randomly, honouring each
                member&apos;s consecutive-days preference. Next month generates
                itself automatically on the last day of this one.
              </p>
              <button onClick={handleGenerate} className="btn-primary mt-4">
                Generate schedule for {month}
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-faint">
              Ask your admin ({group.admin?.name}) to generate it.
            </p>
          )}
        </div>
      )}

      {schedule && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Duty roster */}
          <div className="card">
            <h2 className="card-title">Duty roster — {month}</h2>
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {schedule.assignments.map((a: any) => {
                const mine = a.user?._id === me?._id;
                const isToday = a.date === today;
                return (
                  <div
                    key={a.date}
                    className={`rounded-lg border px-2.5 py-2 text-xs ${
                      mine ? "border-brand-100 bg-brand-50" : "border-line bg-canvas"
                    } ${isToday ? "ring-2 ring-brand-600" : ""}`}
                  >
                    <p className="num font-medium text-ink">
                      {prettyDate(a.date)}
                      {isToday && <span className="ml-1 text-brand-700">· today</span>}
                    </p>
                    <p className={mine ? "font-medium text-brand-800" : "text-ink-secondary"}>
                      {mine ? "You" : a.user?.name}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {/* Swap form */}
            <form onSubmit={handleSwapRequest} className="card space-y-3">
              <h2 className="card-title">Propose a date swap</h2>
              <div>
                <label htmlFor="myDate" className="label">Give away my date</label>
                <select
                  id="myDate"
                  required
                  className="input"
                  value={myDate}
                  onChange={(e) => setMyDate(e.target.value)}
                >
                  <option value="">Select one of your future dates</option>
                  {myFutureDates.map((a: any) => (
                    <option key={a.date} value={a.date}>
                      {prettyDate(a.date)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="targetDate" className="label">In exchange for</label>
                <select
                  id="targetDate"
                  required
                  className="input"
                  value={targetKey}
                  onChange={(e) => setTargetKey(e.target.value)}
                >
                  <option value="">Select someone else&apos;s date</option>
                  {othersFutureDates.map((a: any) => (
                    <option key={a.date} value={`${a.user._id}|${a.date}`}>
                      {prettyDate(a.date)} — {a.user.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={!myDate || !targetKey}>
                Send swap request
              </button>
            </form>

            {/* Admin toolbox */}
            {isAdmin && (
              <div className="card space-y-4">
                <h2 className="card-title">Admin overrides</h2>

                <form onSubmit={handleRedeal} className="space-y-2">
                  <p className="label mb-0">Re-deal a date range (current month)</p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      required
                      className="input"
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(e.target.value)}
                      aria-label="Range start"
                    />
                    <input
                      type="date"
                      required
                      className="input"
                      value={rangeTo}
                      onChange={(e) => setRangeTo(e.target.value)}
                      aria-label="Range end"
                    />
                    <button type="submit" className="btn-ghost whitespace-nowrap" disabled={!rangeFrom || !rangeTo}>
                      Re-deal
                    </button>
                  </div>
                </form>

                <form onSubmit={handlePin} className="space-y-2">
                  <p className="label mb-0">Pin a date to a member</p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      required
                      className="input"
                      value={pinDate}
                      onChange={(e) => setPinDate(e.target.value)}
                      aria-label="Date to assign"
                    />
                    <select
                      required
                      className="input"
                      value={pinUser}
                      onChange={(e) => setPinUser(e.target.value)}
                      aria-label="Member"
                    >
                      <option value="">Member…</option>
                      {group.members?.map((m: any) => (
                        <option key={m.user?._id} value={m.user?._id}>
                          {m.user?.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-ghost whitespace-nowrap" disabled={!pinDate || !pinUser}>
                      Assign
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Request history */}
            {requests.length > 0 && (
              <div className="card">
                <h2 className="card-title">Swap history</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {requests.slice(0, 8).map((r) => (
                    <li key={r._id} className="flex items-center justify-between gap-2">
                      <span className="text-ink-secondary">
                        {r.requester?.name} ({prettyDate(r.requesterDate)}) ⇄{" "}
                        {r.requestedTo?.name} ({prettyDate(r.targetDate)})
                      </span>
                      <span
                        className={`badge ${
                          r.status === "accepted"
                            ? "badge-green"
                            : r.status === "pending"
                              ? "badge-amber"
                              : ""
                        }`}
                      >
                        {r.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incoming swap requests — modal dialog */}
      <Modal
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        title={`Incoming swap requests (${incoming.length})`}
      >
        {incoming.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            No pending requests. When someone proposes a trade for one of your
            market dates, it appears here.
          </p>
        ) : (
          <ul className="space-y-3">
            {incoming.map((r) => (
              <li key={r._id} className="rounded-lg border border-line p-3 text-sm">
                <p className="text-ink-secondary">
                  <strong className="text-ink">{r.requester?.name}</strong> wants your{" "}
                  <strong className="num text-ink">{prettyDate(r.targetDate)}</strong> and
                  offers their{" "}
                  <strong className="num text-ink">{prettyDate(r.requesterDate)}</strong>
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => {
                      handleRespond(r._id, "accept");
                      setInboxOpen(false);
                    }}
                    className="btn-primary"
                  >
                    Approve swap
                  </button>
                  <button
                    onClick={() => handleRespond(r._id, "reject")}
                    className="btn-ghost"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
