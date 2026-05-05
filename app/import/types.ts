export type Uploader = "PEDRO" | "MIRELA";
export type Person = "PEDRO" | "MIRELA" | "AMBOS";
export type Wallet = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS";
export type PaymentType = "DEBITO_PIX" | "CREDITO_A_VISTA" | "PARCELADO" | "IGNORAR";
export type IncomeType = "SALARIO" | "VALE_ALIMENTACAO" | "OUTROS" | "RESTANTE_MES_ANTERIOR";

export type Category = {
  id: string;
  groupName: string;
  name: string;
};

export type PreviewTx = {
  kind: "transaction";
  rowHash: string;
  source: string;
  externalId: string | null;
  occurredAt: string;
  monthKey: string;
  description: string;
  normalized: string;
  amountCents: number;
  person: Person;
  wallet: Wallet;
  paymentType: PaymentType;
  categoryId: string | null;
  tags: string[];
  installmentCurrent: number | null;
  installmentTotal: number | null;
  notes: string | null;
  suggestion?: {
    categoryId: string;
    confidence: number;
    sourceDescription: string;
    suggestedNormalized?: string;
    suggestedPerson?: Person;
    suggestedWallet?: Wallet;
    suggestedPaymentType?: PaymentType;
    suggestedTags: string[];
  };
};

export type PreviewIncome = {
  kind: "income";
  previewId: string;
  source: string;
  externalId: string | null;
  occurredAt: string;
  monthKey: string;
  description: string;
  amountCents: number;
  person: Person;
  wallet: Wallet;
  incomeType: IncomeType;
  notes: string | null;
};

export type PreviewItem = PreviewTx | PreviewIncome;

export type RuleDraft = {
  open: boolean;
  target: "TRANSACTION" | "INCOME";
  matchType: "CONTAINS" | "STARTS_WITH" | "REGEX";
  pattern: string;
  priority: number;
  renameTo: string;
  categoryId: string;
  tags: string;
  person: "" | Person;
  paymentType: "" | PaymentType;
  wallet: "" | Wallet;
  incomeType: "" | IncomeType;
  saving?: boolean;
  error?: string;
  ok?: string;
};

export type UndoState = {
  key: string;
  description: string;
  prevCategoryId: string | null;
  categoryName: string;
};
