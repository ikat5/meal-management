"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { Modal } from "./ui";

/**
 * ADMIN CONTROLS — the group admin's "danger zone".
 *
 *   Freeze      → stops meal tracking for the rest of the month
 *   Unfreeze    → resumes it, nothing lost
 *   Hard reset  → only while frozen: wipes the month and restarts today.
 *                 Confirmed via a modal that requires typing RESET.
 */
export function AdminPanel({
  mealSystem,
  onChanged,
}: {
  mealSystem: { status: string; cycleStart?: string; frozenAt?: string | null };
  onChanged: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const frozen = mealSystem?.status === "FROZEN";

  async function toggleFreeze() {
    setError("");
    setBusy(true);
    try {
      await api("/api/admin/freeze", {
        method: "POST",
        body: { action: frozen ? "unfreeze" : "freeze" },
      });
      onChanged();
    } catch (err: any) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function hardReset() {
    setError("");
    setBusy(true);
    try {
      await api("/api/admin/reset", { method: "POST" });
      setConfirmOpen(false);
      setConfirmText("");
      onChanged();
    } catch (err: any) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="card-title">Admin controls</h2>
        <span className={`badge ${frozen ? "badge-amber" : "badge-green"}`}>
          {frozen ? `Frozen since ${mealSystem.frozenAt}` : "System active"}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-secondary">
        {frozen
          ? "Meal tracking is stopped: no meal changes, expenses or deposits. Resume it, hard-reset the month, or wait — the system resets itself on the 1st."
          : "Freezing stops meal tracking for the rest of the month. A hard reset (wipe this month and restart) becomes available once frozen."}
      </p>

      {error && <p className="alert-error mt-3">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={toggleFreeze} disabled={busy} className="btn-ghost">
          {frozen ? "Unfreeze system" : "Freeze system"}
        </button>
        {frozen && (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            className="btn-danger"
          >
            Hard reset month
          </button>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Hard reset this month"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </button>
            <button
              className="btn-danger"
              disabled={confirmText !== "RESET" || busy}
              onClick={hardReset}
            >
              Wipe month and restart
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-secondary">
          <p>
            This permanently deletes <strong className="text-ink">everything from the
            current month</strong>: expenses, deposits, meal cancellations, the market
            schedule and swap requests. The meal system restarts from scratch today.
          </p>
          <p>This cannot be undone.</p>
          <div>
            <label htmlFor="confirm-reset" className="label">
              Type <span className="num font-semibold text-red-600">RESET</span> to confirm
            </label>
            <input
              id="confirm-reset"
              className="input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET"
              autoComplete="off"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
