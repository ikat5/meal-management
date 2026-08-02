"use client";

import { useCallback, useEffect, useState } from "react";
import { api, money, prettyDate } from "@/lib/client";

/**
 * EXPENSES & DEPOSITS PAGE
 *  - Log a market expense with a DYNAMIC item list (add/remove rows);
 *    the running total is shown live, but the server recomputes it.
 *  - Record deposits to the group fund.
 *  - Month picker + lists with totals.
 */

interface ItemRow {
  name: string;
  price: string; // kept as string while typing; parsed on submit
}

export default function ExpensesPage() {
  const todayStr = new Date().toLocaleDateString("en-CA");
  const thisMonth = todayStr.slice(0, 7);

  const [month, setMonth] = useState(thisMonth);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositsByUser, setDepositsByUser] = useState<Record<string, number>>({});
  const [depositTotal, setDepositTotal] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  // expense form
  const [expDate, setExpDate] = useState(todayStr);
  const [items, setItems] = useState<ItemRow[]>([{ name: "", price: "" }]);

  // deposit form
  const [depAmount, setDepAmount] = useState("");
  const [depDate, setDepDate] = useState(todayStr);
  const [depNote, setDepNote] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [e, d] = await Promise.all([
        api(`/api/expenses?month=${month}`),
        api(`/api/deposits?month=${month}`),
      ]);
      setExpenses(e.expenses);
      setExpenseTotal(e.monthTotal);
      setDeposits(d.deposits);
      setDepositsByUser(d.byUser);
      setDepositTotal(d.monthTotal);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  // Live preview total (server recomputes the real one)
  const previewTotal = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const parsed = items
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), price: parseFloat(i.price) || 0 }));
    if (parsed.length === 0) {
      setError("Add at least one item with a name");
      return;
    }
    try {
      await api("/api/expenses", {
        method: "POST",
        body: { date: expDate, items: parsed },
      });
      setNotice("Expense saved.");
      setItems([{ name: "", price: "" }]);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddDeposit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await api("/api/deposits", {
        method: "POST",
        body: {
          amount: parseFloat(depAmount),
          date: depDate,
          note: depNote.trim() || undefined,
        },
      });
      setNotice("Deposit recorded.");
      setDepAmount("");
      setDepNote("");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <p className="py-10 text-center text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Expenses & deposits</h1>
        <input
          type="month"
          className="input w-auto"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {error && <p className="alert-error">{error}</p>}
      {notice && <p className="alert-success">{notice}</p>}

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Market spent in {month}</p>
          <p className="stat-value">{money(expenseTotal)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Deposited in {month}</p>
          <p className="stat-value">{money(depositTotal)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Expense form ── */}
        <form onSubmit={handleAddExpense} className="card space-y-3">
          <h2 className="font-semibold">Log a market expense 🧾</h2>
          <div>
            <label htmlFor="expDate" className="label">Date</label>
            <input
              id="expDate"
              type="date"
              required
              className="input"
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
            />
          </div>

          <div>
            <span className="label">Items</span>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Item name (e.g. Rice)"
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                  />
                  <input
                    className="input w-28"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) => updateItem(i, "price", e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost px-3"
                    onClick={() => setItems(items.filter((_, j) => j !== i))}
                    disabled={items.length === 1}
                    aria-label="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="btn-ghost mt-2"
              onClick={() => setItems([...items, { name: "", price: "" }])}
            >
              + Add item
            </button>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-sm text-gray-500">
              Total: <strong className="text-gray-900">{money(previewTotal)}</strong>
            </p>
            <button type="submit" className="btn-primary">Save expense</button>
          </div>
        </form>

        {/* ── Deposit form + subtotals ── */}
        <div className="space-y-4">
          <form onSubmit={handleAddDeposit} className="card space-y-3">
            <h2 className="font-semibold">Add a deposit 🏦</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="depAmount" className="label">Amount</label>
                <input
                  id="depAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="input"
                  value={depAmount}
                  onChange={(e) => setDepAmount(e.target.value)}
                  placeholder="2000"
                />
              </div>
              <div>
                <label htmlFor="depDate" className="label">Date</label>
                <input
                  id="depDate"
                  type="date"
                  required
                  className="input"
                  value={depDate}
                  onChange={(e) => setDepDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="depNote" className="label">Note (optional)</label>
              <input
                id="depNote"
                className="input"
                value={depNote}
                onChange={(e) => setDepNote(e.target.value)}
                placeholder="e.g. August contribution"
              />
            </div>
            <button type="submit" className="btn-primary w-full">Record deposit</button>
          </form>

          {Object.keys(depositsByUser).length > 0 && (
            <div className="card">
              <h2 className="font-semibold">Deposits by member</h2>
              <ul className="mt-2 divide-y divide-gray-100 text-sm">
                {Object.entries(depositsByUser).map(([name, total]) => (
                  <li key={name} className="flex justify-between py-1.5">
                    <span>{name}</span>
                    <span className="font-medium">{money(total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Expense history ── */}
      <div className="card">
        <h2 className="font-semibold">Expense history — {month}</h2>
        {expenses.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">No expenses logged this month.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {expenses.map((exp) => (
              <li key={exp._id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {prettyDate(exp.date)} — {exp.user?.name}
                  </p>
                  <p className="font-semibold">{money(exp.totalAmount)}</p>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {exp.items.map((i: any) => `${i.name} (${money(i.price)})`).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
