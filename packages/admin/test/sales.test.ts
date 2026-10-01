import { describe, expect, it } from "vitest";
import { createUser, withTx } from "../../db/test/helpers.js";
import { commissionReport, currentMonth, listPayments, monthStart } from "../lib/data/sales";

describe("ventes", () => {
  it("valide le mois demandé", () => {
    expect(monthStart("2026-10")).toBe("2026-10-01");
    expect(() => monthStart("octobre")).toThrow("Mois invalide");
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("totalise les commissions du mois et liste les paiements", () =>
    withTx(async (db) => {
      await createUser(db, "user-a");
      const school = (
        await db.query(
          "insert into driving_schools (name, promo_code, discount_percent, commission_percent) values ('Le Volant', 'VOLANT', 10, 15) returning id",
        )
      ).rows[0].id;
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      const p = (await db.query("select id from create_payment('user-a')")).rows[0].id;
      await db.query("select confirm_payment($1, 'REF1', 2700)", [p]);
      await db.query("select create_payment('user-a')"); // en attente

      const month = currentMonth();
      const report = await commissionReport(db, month);
      expect(report.find((r) => r.driving_school_id === school)).toMatchObject({ name: "Le Volant", sales_count: 1, revenue_xof: 2700, commission_xof: 405 });

      const payments = await listPayments(db, { month, schoolId: school });
      expect(payments.map((x) => x.status).sort()).toEqual(["confirmed", "pending"]);
      expect(payments[0]).toMatchObject({ school_name: "Le Volant", email: "user-a@test.tg" });
    }));
});

describe("export des ventes", () => {
  it("ne garde que les paiements confirmés quand on le demande", () =>
    withTx(async (db) => {
      await createUser(db, "user-b");
      const p = (await db.query("select id from create_payment('user-b')")).rows[0].id;
      await db.query("select confirm_payment($1, 'REF9', 3000)", [p]);
      await db.query("select create_payment('user-b')");
      const confirmed = await listPayments(db, { month: currentMonth(), confirmedOnly: true });
      expect(confirmed.filter((x) => x.email === "user-b@test.tg").map((x) => x.status)).toEqual(["confirmed"]);
    }));
});
