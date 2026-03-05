import Papa from "papaparse";
import { normalizeHeader, sha256, toCentsFromBRL, parseDateBR } from "./utils";

type ParsedRow = Record<string, string>;

export type ParsedTx = {
  source: string;
  externalId?: string | null;
  description: string;
  categoryRaw?: string | null;
  amountCents: number;
  occurredAt: Date;
  monthKey: string; // YYYY-MM
  paymentType: "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO";
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
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

function monthKeyFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function fixMojibake(s: string): string {
  const str = (s ?? "").toString();
  if (!/[ÃâÂ]/.test(str)) return str;
  try {
    const bytes = new Uint8Array([...str].map((ch) => ch.charCodeAt(0)));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded || str;
  } catch {
    return str;
  }
}

function detectInstallment(title: string): { current?: number; total?: number } | null {
  const m = (title ?? "").match(/parcela\s+(\d+)\s*\/\s*(\d+)/i);
  if (!m) return null;
  const current = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total)) return { current: null as any, total: null as any };
  return { current, total };
}

export function parseNubankCsv(csvText: string): ParsedTx[] {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  const rows = (parsed.data ?? []).filter(Boolean);

  const normalizedRows: ParsedRow[] = rows.map((r) => {
    const out: ParsedRow = {};
    for (const [k, v] of Object.entries(r)) {
      const key = normalizeHeader(fixMojibake(k));
      out[key] = fixMojibake((v ?? "").toString());
    }
    return out;
  });

  const sample = normalizedRows[0] || {};
  const looksLikeCard = ("date" in sample) && ("title" in sample) && ("amount" in sample);
  const looksLikeAccount =
    ("data" in sample || "date" in sample) &&
    ("valor" in sample || "amount" in sample) &&
    ("identificador" in sample || "id" in sample);

  const txs: ParsedTx[] = [];

  // Card keys
  const cardDateKeys = ["date", "data"];
  const cardTitleKeys = ["title", "titulo", "descricao", "description"];
  const cardAmountKeys = ["amount", "valor"];
  const cardIdKeys = ["id", "identificador", "transaction_id"];

  // Account keys
  const accDateKeys = ["data", "date"];
  const accAmountKeys = ["valor", "amount"];
  const accIdKeys = ["identificador", "id", "transaction_id"];
  const accDescKeys = ["descricao", "descrição", "description", "title"];

  for (const row of normalizedRows) {
    const hasAccId = pick(row, accIdKeys).trim() !== "";
    const hasAccDesc = pick(row, accDescKeys).trim() !== "";
    const hasAccAmount = pick(row, accAmountKeys).trim() !== "";

    const isAccountRow = looksLikeAccount || (hasAccId && hasAccDesc && hasAccAmount);

    if (isAccountRow) {
      const dateRaw = pick(row, accDateKeys);
      const occurredAt = parseDateBR(dateRaw) ?? parseIsoDate(dateRaw);
      const amountRaw = pick(row, accAmountKeys).trim();
      const externalId = pick(row, accIdKeys).trim() || null;
      const desc = pick(row, accDescKeys).trim();

      if (!occurredAt || !amountRaw || !desc) continue;

      const amountCents = toCentsFromBRL(amountRaw);

      const mk = monthKeyFromDate(occurredAt);

      const hashBase = ["nubank_account", mk, occurredAt.toISOString().slice(0, 10), desc.toLowerCase(), String(amountCents), externalId ?? ""].join("|");

      txs.push({
        source: "nubank_account",
        externalId,
        description: desc,
        categoryRaw: null,
        amountCents,
        occurredAt,
        monthKey: mk,
        paymentType: "DEBITO_PIX",
        installmentCurrent: null,
        installmentTotal: null,
        rowHash: sha256(hashBase)
      });

      continue;
    }

    // Card row
    const dateRaw = pick(row, cardDateKeys);
    const occurredAt = parseIsoDate(dateRaw) ?? parseDateBR(dateRaw);
    const title = pick(row, cardTitleKeys).trim();
    const amountRaw = pick(row, cardAmountKeys).trim();
    const externalId = pick(row, cardIdKeys).trim() || null;

    if (!occurredAt || !title || !amountRaw) continue;

    const amountCents = toCentsFromBRL(amountRaw);
    const mk = monthKeyFromDate(occurredAt);

    const inst = detectInstallment(title);
    const paymentType = inst && inst.total && inst.total > 1 ? "PARCELADO" : "CREDITO_A_VISTA";

    const hashBase = ["nubank_credit", mk, occurredAt.toISOString().slice(0, 10), title.toLowerCase(), String(amountCents), externalId ?? "", String(inst?.current ?? ""), String(inst?.total ?? "")].join("|");

    txs.push({
      source: looksLikeCard ? "nubank_credit" : "nubank_credit",
      externalId,
      description: title,
      categoryRaw: paymentType === "PARCELADO" ? "Compra parcelada" : null,
      amountCents,
      occurredAt,
      monthKey: mk,
      paymentType,
      installmentCurrent: inst?.current ?? null,
      installmentTotal: inst?.total ?? null,
      rowHash: sha256(hashBase)
    });
  }

  return txs;
}
