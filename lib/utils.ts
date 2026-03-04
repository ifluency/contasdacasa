import crypto from "crypto";

export function toCentsFromBRL(value: string): number {
  // Aceita: "1.234,56" / "1234,56" / "-12,34" / "12.34" (fallback)
  const v = (value ?? "").toString().trim();
  if (!v) return 0;

  // remove "R$", espaços e pontos de milhar
  const cleaned = v
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  const n = Number(cleaned);
  if (Number.isNaN(n)) return 0;

  return Math.round(n * 100);
}

export function normalizeHeader(h: string): string {
  return (h ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function parseDateBR(input: string): Date | null {
  // tenta "dd/mm/aaaa" e ISO
  const s = (input ?? "").toString().trim();
  if (!s) return null;

  // ISO
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso;

  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}
