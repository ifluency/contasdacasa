import Papa from "papaparse";
import { normalizeHeader, parseDateBR, sha256, toCentsFromBRL } from "./utils";

type ParsedRow = Record<string, string>;

export type NubankTx = {
  source: string;
  externalId?: string | null;
  description: string;
  categoryRaw?: string | null;
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

export function parseNubankCsv(csvText: string, source = "nubank_credit"): NubankTx[] {
  const parsed = Papa.parse<ParsedRow>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors?.length) {
    // Não falha duro: mas se quiser, pode lançar erro aqui.
    // throw new Error(parsed.errors[0].message);
  }

  const rows = (parsed.data ?? []).filter(Boolean);

  // Mapeamento flexível por header normalizado
  const normalizedRows: ParsedRow[] = rows.map((r) => {
    const out: ParsedRow = {};
    for (const [k, v] of Object.entries(r)) {
      out[normalizeHeader(k)] = (v ?? "").toString();
    }
    return out;
  });

  // Chaves comuns em exports do Nubank (varia por produto/versão)
  const dateKeys = ["data", "date", "data da compra", "data_compra"];
  const descKeys = ["descricao", "descrição", "description", "titulo", "estabelecimento", "merchant"];
  const catKeys = ["categoria", "category"];
  const amountKeys = ["valor", "amount", "valor (r$)", "valor_rs", "valor r$"];
  const idKeys = ["id", "identificador", "identificador da compra", "transaction_id"];

  const txs: NubankTx[] = [];

  for (const row of normalizedRows) {
    const occurredAtRaw = pick(row, dateKeys);
    const occurredAt = parseDateBR(occurredAtRaw);

    const description = pick(row, descKeys).trim();
    const categoryRaw = pick(row, catKeys).trim() || null;
    const amountRaw = pick(row, amountKeys).trim();
    const externalId = pick(row, idKeys).trim() || null;

    if (!occurredAt || !description || !amountRaw) continue;

    const amountCents = toCentsFromBRL(amountRaw);

    // Hash para dedup: data + desc + valor + categoria + externalId
    const hashBase = [
      source,
      occurredAt.toISOString().slice(0, 10),
      description.toLowerCase(),
      String(amountCents),
      categoryRaw ?? "",
      externalId ?? ""
    ].join("|");

    txs.push({
      source,
      externalId,
      description,
      categoryRaw,
      amountCents,
      occurredAt,
      rowHash: sha256(hashBase)
    });
  }

  return txs;
}
