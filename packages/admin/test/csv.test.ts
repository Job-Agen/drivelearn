import { describe, expect, it } from "vitest";
import { toCsv } from "../lib/csv";

describe("export CSV", () => {
  it("produit un fichier lisible par Excel : BOM, point-virgule, guillemets si besoin", () => {
    const csv = toCsv(
      [
        { name: 'Auto-école "Le Volant"; Lomé', total: 5400 },
        { name: "Ligne\nmultiple", total: 0 },
        { name: null, total: 10 },
      ],
      [["name", "Auto-école"], ["total", "Total (FCFA)"]],
    );
    expect(csv).toBe(
      '﻿Auto-école;Total (FCFA)\r\n"Auto-école ""Le Volant""; Lomé";5400\r\n"Ligne\nmultiple";0\r\n;10\r\n',
    );
  });
});
