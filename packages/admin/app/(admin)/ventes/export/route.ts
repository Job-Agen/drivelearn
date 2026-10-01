import { requireAdmin } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import { currentMonth, listPayments } from "@/lib/data/sales";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || currentMonth();
  const payments = await listPayments(pool, { month, schoolId: url.searchParams.get("school") || undefined });
  const csv = toCsv(payments, [
    ["created_at", "Date"],
    ["confirmed_at", "Confirmé le"],
    ["status", "Statut"],
    ["email", "Élève"],
    ["school_name", "Auto-école"],
    ["base_amount_xof", "Prix (FCFA)"],
    ["discount_xof", "Réduction (FCFA)"],
    ["amount_xof", "Payé (FCFA)"],
    ["commission_xof", "Commission (FCFA)"],
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="drivelearn-ventes-${month}.csv"`,
    },
  });
}
