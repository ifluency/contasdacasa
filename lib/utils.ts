import crypto from "crypto";

export function toCentsFromBRL(value: string): number {
  const raw = (value ?? "").toString().trim();
  if (!raw) return 0;

  let s = raw.replace(/\s/g, "").replace(/^R\$/i, "");
  s = s.replace(/[^\d,.\-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";

    s = s.split(thousandSep).join("");
    if (decimalSep === ",") s = s.replace(",", ".");
  } else if (hasComma && !hasDot) {
    s = s.replace(",", ".");
  } else if (hasDot && !hasComma) {
    const lastDot = s.lastIndexOf(".");
    const decimals = s.length - lastDot - 1;

    // Se exatamente 3 dígitos após o ponto, tende a ser milhar (1.234)
    if (decimals === 3) s = s.replace(/\./g, "");
  }

  const n = Number(s);
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

/**
 * Parse de data aceitando:
 * - "YYYY-MM-DD" (ISO)
 * - "dd/mm/YYYY" (BR)  ✅ prioridade para evitar MM/DD do JS
 */
export function parseDateBR(input: string): Date | null {
  const s = (input ?? "").toString().trim();
  if (!s) return null;

  // ✅ PRIORIDADE: dd/mm/yyyy (BR)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);

    // validação básica
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;

    // UTC “meio-dia” para evitar drift por fuso
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  // ISO ou outros formatos que o JS entenda com segurança
  // (ex.: "2026-02-11")
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso;

  return null;
}
