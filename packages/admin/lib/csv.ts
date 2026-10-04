function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV pour Excel en français : BOM UTF-8, séparateur point-virgule, fins de ligne CRLF. */
export function toCsv(rows: Record<string, unknown>[], columns: [string, string][]): string {
  const lines = [columns.map(([, label]) => cell(label)).join(";")];
  for (const row of rows) lines.push(columns.map(([key]) => cell(row[key])).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
