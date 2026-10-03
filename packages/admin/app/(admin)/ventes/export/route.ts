import { pool } from "@/lib/db";
import { listPayments, paymentsCsv } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

/** Export CSV des paiements filtrés (s'ouvre dans Excel). */
export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : new Date().toISOString().slice(0, 7);
  const rows = await listPayments(pool, {
    month,
    schoolId: url.searchParams.get("school") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  return new Response(paymentsCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="drivelearn-ventes-${month}.csv"`,
    },
  });
}
