import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AdminError, adminMessage } from "../lib/errors";

describe("messages d'erreur de l'administration", () => {
  it("affiche tel quel le message d'une AdminError", () => {
    expect(adminMessage(new AdminError("Banque insuffisante."))).toBe("Banque insuffisante.");
  });

  it("traduit un refus de validation de question", () => {
    expect(adminMessage(new Error("question_invalide: aucune bonne réponse"))).toBe(
      "Validation impossible : aucune bonne réponse.",
    );
  });

  it("signale un doublon", () => {
    expect(adminMessage(Object.assign(new Error("dup"), { code: "23505" }))).toBe("Cette valeur existe déjà.");
  });

  it("résume une erreur de formulaire", () => {
    const parsed = z.object({ name: z.string().min(1, "Nom obligatoire") }).safeParse({ name: "" });
    expect(adminMessage(parsed.error)).toBe("Formulaire invalide : Nom obligatoire");
  });

  it("masque une erreur inattendue", () => {
    expect(adminMessage(new Error("connexion perdue"))).toBe("Erreur inattendue. Réessayez.");
  });
});
