import dbConnect from "@/lib/db";
import { apiHandler, ok, ApiError } from "@/lib/api";
import { requireGroupMember } from "@/lib/auth";
import { currentMonth } from "@/lib/dates";
import MonthlyReport from "@/models/MonthlyReport";

/** GET /api/reports?month=2026-08 — a previously generated (frozen) report */
export const GET = apiHandler(async (req) => {
  await dbConnect();
  const user = await requireGroupMember();

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new ApiError(400, "month must look like 2026-08");

  const report = await MonthlyReport.findOne({ group: user.groupId, month })
    .populate("rows.user", "name")
    .populate("generatedBy", "name");

  if (!report) {
    throw new ApiError(404, `No report generated yet for ${month}`);
  }

  return ok({ report });
});
