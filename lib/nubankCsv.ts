import Papa from "papaparse";
import { normalizeHeader, sha256, toCentsFromBRL, parseDateBR } from "./utils";

type ParsedRow = Record<string, string>;

export type NubankTx = {
  source: string;
  externalId?: string | null;
  description: string;
  categoryRaw?: string | null; // vamos usar para "Compra parcelada" quando detectar
  amountCents: number;
  occurredAt: Date;
  rowHash: string;
};

function pick(row: ParsedRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return "";
}

function parseIsoDate(input: string): Date | null {
  const s = (input ?? "").toString().trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function detectInstallment(title: string): { isInstallment: boolean; current?: number; total?: number } {
  // detecta "Parcela 1/3", "parcela 2/12", etc.
  const m = (title ?? "").match(/parcela\s+(\d+)\s*\/\s*(\d+)/i);
  if (!m) return { isInstallment: false };
  const current = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 1) {
    return { isInstallment: true };
  }
  return { isInstallment: true, current, total };
}

export function parseNubankCsv(csvText: string, source = "nubank_credit"): NubankTx[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  const rows = (parsed.data ?? []).filter(Boolean);

  // normaliza headers (case/acentos/etc)
  const normalizedRows: ParsedRow[] = rows.map((r) => {
    const out: ParsedRow = {};
    for (const [k, v] of Object.entries(r)) {
      out[normalizeHeader(k)] = (v ?? "").toString();
    }
    return out;
  });

  // Suporte explícito ao seu formato:
  // date,title,amount (data ISO, title e amount com ponto decimal)
  // + fallback para variações comuns
  const dateKeys = ["date", "data", "data da compra", "data_compra"];
  const titleKeys = ["title", "titulo", "descricao", "description", "estabelecimento", "merchant"];
  const amountKeys = ["amount", "valor", "valor (r$)", "valor_rs", "valor r$"];
  const categoryKeys = ["category", "categoria"];
  const idKeys = ["id", "identificador", "transaction_id"];

  const txs: NubankTx[] = [];

  for (const row of normalizedRows) {
    const dateRaw = pick(row, dateKeys);
    const titleRaw = pick(row, titleKeys).trim();
    const amountRaw = pick(row, amountKeys).trim();

    // tenta ISO primeiro, depois dd/mm/aaaa (caso venha outro export)
    const occurredAt = parseIsoDate(dateRaw) ?? parseDateBR(dateRaw);

    const externalId = pick(row, idKeys).trim() || null;

    // categoria original se existir
    const originalCategory = pick(row, categoryKeys).trim() || null;

    if (!occurredAt || !titleRaw || !amountRaw) continue;

    const amountCents = toCentsFromBRL(amountRaw);

    // Detecta parcelamento no título
    const inst = detectInstallment(titleRaw);
    const categoryRaw =
      inst.isInstallment
        ? (originalCategory ? `Compra parcelada • ${originalCategory}` : "Compra parcelada")
        : originalCategory;

    // Hash para dedup
    // - Use data (dia), título, valor, source, categoria e externalId (se houver)
    const hashBase = [
      source,
      occurredAt.toISOString().slice(0, 10),
      titleRaw.toLowerCase(),
      String(amountCents),
      categoryRaw ?? "",
      externalId ?? ""
    ].join("|");

    txs.push({
      source,
      externalId,
      description: titleRaw,
      categoryRaw,
      amountCents,
      occurredAt,
      rowHash: sha256(hashBase)
    });
  }

  return txs;
}
