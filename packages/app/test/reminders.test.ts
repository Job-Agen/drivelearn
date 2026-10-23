import { describe, expect, it } from "vitest";
import { REMINDER_DAYS, parseTime, reminderPlan } from "../src/domain/reminders";

const base = { enabled: true, time: "19:00", practicedToday: false, streak: 0, firstName: null };
const at = (h: number, m = 0) => new Date(2026, 9, 23, h, m);

describe("parseTime", () => {
  it("lit HH:MM et HH:MM:SS", () => {
    expect(parseTime("19:00")).toEqual({ hour: 19, minute: 0 });
    expect(parseTime("07:30:00")).toEqual({ hour: 7, minute: 30 });
  });
  it("refuse une heure invalide", () => {
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("soir")).toBeNull();
  });
});

describe("reminderPlan", () => {
  it("ne programme rien si les rappels sont désactivés ou l'heure illisible", () => {
    expect(reminderPlan({ ...base, enabled: false, now: at(8) })).toEqual([]);
    expect(reminderPlan({ ...base, time: "?", now: at(8) })).toEqual([]);
  });

  it("programme aujourd'hui puis chaque jour à l'heure choisie", () => {
    const plan = reminderPlan({ ...base, now: at(8) });
    expect(plan).toHaveLength(REMINDER_DAYS);
    expect(plan[0].date).toEqual(at(19));
    expect(plan[1].date).toEqual(new Date(2026, 9, 24, 19, 0));
    expect(plan.every((r) => r.date.getHours() === 19 && r.date.getMinutes() === 0)).toBe(true);
  });

  it("saute aujourd'hui si la séance est faite ou l'heure passée", () => {
    for (const plan of [reminderPlan({ ...base, now: at(8), practicedToday: true }), reminderPlan({ ...base, now: at(20) })]) {
      expect(plan).toHaveLength(REMINDER_DAYS - 1);
      expect(plan[0].date).toEqual(new Date(2026, 9, 24, 19, 0));
    }
  });

  it("parle de la série en cours le jour même", () => {
    const [today, tomorrow] = reminderPlan({ ...base, now: at(8), streak: 4, firstName: "Ama" });
    expect(today.title).toBe("Ta série de 4 jours t'attend");
    expect(today.body).toBe("Ama, fais ta séance du jour pour ne pas la perdre.");
    expect(tomorrow.title).not.toContain("série");
    expect(tomorrow.body.startsWith("Ama, ")).toBe(true);
  });

  it("passe au mois suivant sans erreur", () => {
    const plan = reminderPlan({ ...base, now: new Date(2026, 9, 30, 8) });
    expect(plan[3].date).toEqual(new Date(2026, 10, 2, 19, 0));
  });
});
