import { requireAdmin } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import { getBatch } from "@/lib/data/pass-codes";
import { pool } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const batch = /^[0-9a-f-]{36}$/.test(id) ? await getBatch(pool, id) : null;
  if (!batch) return new Response("Lot introuvable", { status: 404 });
  const csv = toCsv(batch.codes, [
    ["code", "Code"],
    ["redeemed_at", "Utilisé le"],
    ["email", "Élève"],
  ]);
  const name = batch.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "lot";
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="drivelearn-codes-${name}.csv"`,
    },
  });
}
