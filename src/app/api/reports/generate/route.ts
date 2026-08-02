import { z } from "zod";
import dbConnect from "@/lib/db";
import { apiHandler, ok } from "@/lib/api";
import { requireGroupAdmin } from "@/lib/auth";
import { calculateMonthlyReport } from "@/lib/report";
import MonthlyReport from "@/models/MonthlyReport";

const generateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must look like 2026-08"),
});

/**
 * POST /api/reports/generate — ADMIN ONLY. Meant for the last day of the
 * month (or after). Snapshots the billing math into a MonthlyReport.
 * Re-generating REPLACES the existing snapshot for that month (upsert).
 */
export const POST = apiHandler(async (req) => {
  await dbConnect();
  const { user, group } = await requireGroupAdmin();
  const body = generateSchema.parse(await req.json());

  const data = await calculateMonthlyReport(group._id, body.month);

  const report = await MonthlyReport.findOneAndUpdate(
    { group: group._id, month: body.month },
    {
      group: group._id,
      month: body.month,
      totalCost: data.totalCost,
      totalMeals: data.totalMeals,
      perMealRate: data.perMealRate,
      rows: data.rows,
      generatedBy: user._id,
    },
    { upsert: true, new: true } // create if missing, replace if it exists
  )
    .populate("rows.user", "name")
    .populate("generatedBy", "name");

  return ok({ report }, 201);
});
