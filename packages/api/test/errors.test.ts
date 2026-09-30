import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpError, toHttpError } from "../src/errors.js";

describe("traduction des erreurs", () => {
  it("traduit une erreur métier SQL en statut et message français", () => {
    const e = toHttpError(Object.assign(new Error("pass_required"), { code: "P0001" }));
    expect({ status: e.status, code: e.code }).toEqual({ status: 402, code: "pass_required" });
    expect(e.message).toMatch(/Pass Examen/);
  });

  it("masque une erreur métier inconnue derrière une erreur interne", () => {
    const e = toHttpError(Object.assign(new Error("question_invalide: aucune leçon"), { code: "P0001" }));
    expect({ status: e.status, code: e.code }).toEqual({ status: 500, code: "internal_error" });
  });

  it("traduit une contrainte ou un format SQL invalide en 400", () => {
    for (const code of ["23514", "23503", "22P02", "22007"]) {
      expect(toHttpError(Object.assign(new Error("x"), { code })).status).toBe(400);
    }
  });

  it("traduit une erreur de validation zod en 400 invalid_input", () => {
    const result = z.object({ a: z.number() }).safeParse({ a: "x" });
    const e = toHttpError(result.error);
    expect({ status: e.status, code: e.code }).toEqual({ status: 400, code: "invalid_input" });
  });

  it("laisse passer une HttpError telle quelle", () => {
    const original = new HttpError(409, "program_not_selected", "Choisissez votre programme.");
    expect(toHttpError(original)).toBe(original);
  });
});
