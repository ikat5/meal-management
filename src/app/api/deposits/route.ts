import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { currentMonth } from "@/lib/dates";
import { requireActiveSystem } from "@/lib/system";
import Deposit from "@/models/Deposit";

/** GET /api/deposits?month=2026-08 — month's deposits + per-user subtotals */
export const GET = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiError(400, "month must look like 2026-08");

  const deposits = await Deposit.find({
    group: user.groupId,
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
  })
    .sort({ date: -1, createdAt: -1 })
    .populate("user", "name");

  // Per-user subtotal, e.g. { "Tarit": 3500, "Rahim": 2000 }
  const byUser: Record<string, number> = {};
  for (const d of deposits) {
    const name = (d.user as any)?.name ?? "Unknown";
    byUser[name] = Math.round(((byUser[name] ?? 0) + d.amount) * 100) / 100;
  }

  const monthTotal =
    Math.round(deposits.reduce((sum, d) => sum + d.amount, 0) * 100) / 100;

  return ok({ deposits, byUser, monthTotal });
});

const depositSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must look like 2026-08-05"),
  note: z.string().trim().max(200).optional(),
});

/** POST /api/deposits — record a contribution to the group fund */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();
  const body = depositSchema.parse(await req.json());

  await requireActiveSystem(user.groupId); // throws 423 while frozen

  const deposit = await Deposit.create({
    group: user.groupId,
    user: user._id,
    amount: body.amount,
    date: body.date,
    note: body.note,
  });
  await deposit.populate("user", "name");

  return ok({ deposit }, 201);
});
