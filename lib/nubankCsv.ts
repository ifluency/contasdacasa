import Papa from "papaparse";
import { normalizeHeader, sha256, toCentsFromBRL, parseDateBR } from "./utils";

type ParsedRow = Record<string, string>;

export type NubankTx = {
  source: string; // "nubank_credit" | "nubank_account" | etc.
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

function parseIsoDate(input: string): Date | null {
  const s = (input ?? "").toString().trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Tenta corrigir "mojibake" típico: "DescriÃ§Ã£o" => "Descrição"
 * Isso ocorre quando bytes UTF-8 são interpretados como latin1/CP1252.
 */
function fixMojibake(s: string): string {
  const str = (s ?? "").toString();
  // Heurística: se não tem "Ã" ou "â", não mexe.
  if (!/[ÃâÂ]/.test(str)) return str;

  try {
    const bytes = new Uint8Array([...str].map((ch) => ch.charCodeAt(0)));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // Se melhorou (removeu Ã/â), usa
    if (decoded && decoded.length && decoded !== str && !/[ÃâÂ]/.test(decoded)) return decoded;
    return decoded || str;
  } catch {
    return str;
  }
}

function detectInstallment(title: string): { isInstallment: boolean; current?: number; total?: number } {
  const m = (title ?? "").match(/parcela\s+(\d+)\s*\/\s*(\d+)/i);
  if (!m) return { isInstallment: false };
  const current = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total)) return { isInstallment: true };
  return { isInstallment: true, current, total };
}

function guessAccountCategory(desc: string): string | null {
  const d = (desc ?? "").toLowerCase();

  if (d.includes("estorno")) return "Estorno";
  if (d.includes("pagamento de fatura")) return "Pagamento fatura";
  if (d.includes("aplicacao rdb") || d.includes("aplicação rdb")) return "Investimento (RDB)";

  // Pix / transferências
  if (d.includes("transferencia recebida") || d.includes("transferência recebida") || d.includes("pix") && d.includes("recebida")) {
    return "Pix recebido";
  }
  if (d.includes("transferencia enviada") || d.includes("transferência enviada") || d.includes("pix") && d.includes("enviada")) {
    return "Pix enviado";
  }

  if (d.includes("compra no debito") || d.includes("compra no débito")) return "Compra no débito";

  return null;
}

export function parseNubankCsv(csvText: string, source = "nubank_credit"): NubankTx[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  const rows = (parsed.data ?? []).filter(Boolean);

  // Normaliza headers e também tenta corrigir mojibake no header
  const normalizedRows: ParsedRow[] = rows.map((r) => {
    const out: ParsedRow = {};
    for (const [k, v] of Object.entries(r)) {
      const key = normalizeHeader(fixMojibake(k));
      out[key] = fixMojibake((v ?? "").toString());
    }
    return out;
  });

  // Detecta “tipo” pelo header presente, mesmo que source venha errado
  // Cartão/fatura: date,title,amount
  // Conta: data,valor,identificador,descricao
  const sample = normalizedRows[0] || {};
  const hasCardHeaders = ("date" in sample || "title" in sample) && ("amount" in sample);
  const hasAccountHeaders = ("data" in sample || "date" in sample) && ("valor" in sample || "amount" in sample) && ("identificador" in sample || "transaction_id" in sample || "id" in sample);

  const inferredSource =
    hasAccountHeaders ? "nubank_account" :
    hasCardHeaders ? "nubank_credit" :
    source;

  // Chaves (card)
  const cardDateKeys = ["date", "data"];
  const cardTitleKeys = ["title", "titulo", "descricao", "description", "estabelecimento", "merchant"];
  const cardAmountKeys = ["amount", "valor", "valor (r$)", "valor_rs", "valor r$"];
  const cardCategoryKeys = ["category", "categoria"];
  const cardIdKeys = ["id", "identificador", "transaction_id"];

  // Chaves (account)
  const accDateKeys = ["data", "date"];
  const accAmountKeys = ["valor", "amount"];
  const accIdKeys = ["identificador", "id", "transaction_id"];
  const accDescKeys = ["descricao", "descrição", "description", "title", "titulo"];

  const txs: NubankTx[] = [];

  for (const row of normalizedRows) {
    // Decide se é conta ou cartão por linha (tolerante)
    const isAccountLike =
      pick(row, accIdKeys).trim() !== "" &&
      (pick(row, accDescKeys).trim() !== "") &&
      (pick(row, accAmountKeys).trim() !== "");

    if (isAccountLike) {
      // --- CONTA ---
      const dateRaw = pick(row, accDateKeys);
      const occurredAt = parseDateBR(dateRaw) ?? parseIsoDate(dateRaw);
      const amountRaw = pick(row, accAmountKeys).trim();
      const externalId = pick(row, accIdKeys).trim() || null;
      const descRaw = pick(row, accDescKeys).trim();

      if (!occurredAt || !amountRaw || !descRaw) continue;

      const amountCents = toCentsFromBRL(amountRaw);

      // categoria por heurística
      const categoryRaw = guessAccountCategory(descRaw);

      const hashBase = [
        "nubank_account",
        occurredAt.toISOString().slice(0, 10),
        descRaw.toLowerCase(),
        String(amountCents),
        categoryRaw ?? "",
        externalId ?? ""
      ].join("|");

      txs.push({
        source: "nubank_account",
        externalId,
        description: descRaw,
        categoryRaw,
        amountCents,
        occurredAt,
        rowHash: sha256(hashBase)
      });

      continue;
    }

    // --- CARTÃO/FATURA ---
    const dateRaw = pick(row, cardDateKeys);
    const titleRaw = pick(row, cardTitleKeys).trim();
    const amountRaw = pick(row, cardAmountKeys).trim();
    const occurredAt = parseIsoDate(dateRaw) ?? parseDateBR(dateRaw);
    const externalId = pick(row, cardIdKeys).trim() || null;
    const originalCategory = pick(row, cardCategoryKeys).trim() || null;

    if (!occurredAt || !titleRaw || !amountRaw) continue;

    const amountCents = toCentsFromBRL(amountRaw);

    const inst = detectInstallment(titleRaw);
    const categoryRaw =
      inst.isInstallment
        ? (originalCategory ? `Compra parcelada • ${originalCategory}` : "Compra parcelada")
        : originalCategory;

    const hashBase = [
      inferredSource,
      occurredAt.toISOString().slice(0, 10),
      titleRaw.toLowerCase(),
      String(amountCents),
      categoryRaw ?? "",
      externalId ?? ""
    ].join("|");

    txs.push({
      source: inferredSource,
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
