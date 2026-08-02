import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { currentMonth } from "@/lib/dates";
import { requireActiveSystem } from "@/lib/system";
import Expense from "@/models/Expense";

/** GET /api/expenses?month=2026-08 — the month's expenses + total */
export const GET = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiError(400, "month must look like 2026-08");

  const expenses = await Expense.find({
    group: user.groupId,
    date: { $gte: `${month}-01`, $lte: `${month}-31` }, // string compare works for YYYY-MM-DD
  })
    .sort({ date: -1, createdAt: -1 })
    .populate("user", "name");

  const monthTotal =
    Math.round(expenses.reduce((sum, e) => sum + e.totalAmount, 0) * 100) / 100;

  return ok({ expenses, monthTotal });
});

const expenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must look like 2026-08-10"),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Item name is required").max(100),
        price: z.number().min(0, "Price cannot be negative"),
      })
    )
    .min(1, "Add at least one item"),
});

/**
 * POST /api/expenses — log a market trip.
 * Note: the client never sends a total — the Expense model recomputes
 * `totalAmount` from the items in a pre-validate hook.
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();
  const body = expenseSchema.parse(await req.json());

  await requireActiveSystem(user.groupId); // throws 423 while frozen

  const expense = await Expense.create({
    group: user.groupId,
    user: user._id,
    date: body.date,
    items: body.items,
  });
  await expense.populate("user", "name");

  return ok({ expense }, 201);
});
