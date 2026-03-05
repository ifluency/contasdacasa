import crypto from "crypto";

export function toCentsFromBRL(value: string): number {
  // Aceita:
  // - "1.234,56" (BR)
  // - "1234,56"
  // - "1,234.56" (US)
  // - "31.90" (Nubank CSV)
  // - "-1097.47"
  // - "100" (inteiro)
  const raw = (value ?? "").toString().trim();
  if (!raw) return 0;

  // remove moeda e espaços
  let s = raw.replace(/\s/g, "").replace(/^R\$/i, "");

  // mantém só dígitos e separadores e sinal
  s = s.replace(/[^\d,.\-]/g, "");

  if (!s || s === "-" || s === "." || s === ",") return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  // Caso tenha vírgula e ponto, decidimos pelo ÚLTIMO separador como decimal
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");

    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";

    // remove milhar
    s = s.split(thousandSep).join("");
    // troca decimal por ponto
    if (decimalSep === ",") s = s.replace(",", ".");
  } else if (hasComma && !hasDot) {
    // Só vírgula: assume decimal BR
    s = s.replace(",", ".");
  } else if (hasDot && !hasComma) {
    // Só ponto: pode ser decimal (31.90) ou milhar (1.234)
    const lastDot = s.lastIndexOf(".");
    const decimals = s.length - lastDot - 1;

    // se tiver exatamente 3 dígitos após o ponto e não tiver outro ponto, provavelmente é milhar (1.234)
    // se tiver 1-2 dígitos, é decimal (31.9 / 31.90)
    if (decimals === 3) {
      // trata como milhar: remove o ponto
      s = s.replace(/\./g, "");
    }
    // senão mantém como decimal com ponto
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

export function parseDateBR(input: string): Date | null {
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
