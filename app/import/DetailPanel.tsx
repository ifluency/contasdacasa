"use client";

import { useMemo, useState } from "react";
import type {
  PreviewItem,
  PreviewTx,
  PreviewIncome,
  Category,
  RuleDraft,
  Person,
  Wallet,
  PaymentType,
  IncomeType,
} from "./types";
import { formatBRL, sourceLabel, groupIcon } from "./importLogic";
import { CategoryPicker } from "./CategoryPicker";

// ── TagsPicker ────────────────────────────────────────────────────────────────

function TagsPicker({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const selectedSet = useMemo(() => new Set(value), [value]);

  function toggle(tag: string) {
    const next = new Set(selectedSet);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onChange(Array.from(next));
  }

  function addNew() {
    const t = newTag.trim();
    if (!t) return;
    const next = new Set(selectedSet);
    next.add(t);
    onChange(Array.from(next));
    setNewTag("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="border rounded-lg px-3 py-2 text-xs w-full text-left bg-white"
        onClick={() => setOpen((v) => !v)}
      >
        {value.length
          ? `${value.length} tag(s): ${value.slice(0, 2).join(", ")}${value.length > 2 ? "…" : ""}`
          : "Selecionar tags"}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow-lg p-3">
          <div className="text-xs font-semibold mb-2">Tags</div>
          <div className="max-h-40 overflow-y-auto pr-1 space-y-1">
            {options.map((tag) => (
              <label key={tag} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSet.has(tag)}
                  onChange={() => toggle(tag)}
                />
                <span className="break-words">{tag}</span>
              </label>
            ))}
            {options.length === 0 && (
              <div className="text-xs text-zinc-500">Sem sugestões.</div>
            )}
          </div>
          <div className="mt-3 border-t pt-3">
            <div className="text-xs font-semibold mb-2">Adicionar nova</div>
            <div className="flex gap-2">
              <input
                className="border rounded-lg p-2 text-xs w-full"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNew()}
                placeholder="Ex.: Caixinha"
              />
              <button
                type="button"
                className="border rounded-lg px-3 py-2 text-xs bg-zinc-900 text-white"
                onClick={addNew}
              >
                Add
              </button>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className="text-xs underline" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

type Props = {
  item: PreviewItem | null;
  categories: Category[];
  tagOptions: string[];
  ruleDraft: RuleDraft | null;
  acceptedSuggestion: boolean;
  onUpdateTx: (rowHash: string, patch: Partial<PreviewTx>) => void;
  onUpdateIncome: (previewId: string, patch: Partial<PreviewIncome>) => void;
  onAcceptSuggestion: (
    rowHash: string,
    suggestion: NonNullable<PreviewTx["suggestion"]>
  ) => void;
  onAdvance: () => void;
  onSkip: () => void;
  onOpenRule: () => void;
  onCloseRule: () => void;
  onSetDraft: (patch: Partial<RuleDraft>) => void;
  onSaveRule: (applyNow: boolean) => void;
};

export function DetailPanel({
  item,
  categories,
  tagOptions,
  ruleDraft,
  acceptedSuggestion,
  onUpdateTx,
  onUpdateIncome,
  onAcceptSuggestion,
  onAdvance,
  onSkip,
  onOpenRule,
  onCloseRule,
  onSetDraft,
  onSaveRule,
}: Props) {
  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-zinc-400">
        Selecione uma transação na lista.
      </div>
    );
  }

  const dateStr = new Intl.DateTimeFormat("pt-BR").format(new Date(item.occurredAt));
  const isTx = item.kind === "transaction";
  const tx = isTx ? (item as PreviewTx) : null;
  const income = !isTx ? (item as PreviewIncome) : null;

  function chipCls(color: string) {
    return `inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-[11px] font-medium ${color}`;
  }

  function paymentChip(p: PaymentType) {
    if (p === "DEBITO_PIX") return chipCls("bg-blue-50 text-blue-700 border-blue-200");
    if (p === "CREDITO_A_VISTA") return chipCls("bg-purple-50 text-purple-700 border-purple-200");
    if (p === "PARCELADO") return chipCls("bg-amber-50 text-amber-800 border-amber-200");
    return chipCls("bg-zinc-100 text-zinc-600 border-zinc-200");
  }

  function paymentLabel(p: PaymentType) {
    if (p === "DEBITO_PIX") return "🔵 Débito/PIX";
    if (p === "CREDITO_A_VISTA") return "🟣 Crédito à vista";
    if (p === "PARCELADO") return "🟠 Parcelado";
    return "⚪ Ignorar";
  }

  function walletChip(w: Wallet) {
    if (w === "SALARIO") return chipCls("bg-emerald-50 text-emerald-800 border-emerald-200");
    if (w === "VALE_ALIMENTACAO") return chipCls("bg-lime-50 text-lime-800 border-lime-200");
    return chipCls("bg-zinc-100 text-zinc-600 border-zinc-200");
  }

  function walletLabel(w: Wallet) {
    if (w === "SALARIO") return "🟢 Salário";
    if (w === "VALE_ALIMENTACAO") return "🟡 Vale";
    return "⚫ Outros";
  }

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide mt-5 mb-2">
      {children}
    </div>
  );

  return (
    <div className="p-5 overflow-y-auto h-full">
      {/* Transaction header */}
      <div className="mb-1">
        <div className="text-lg font-bold text-zinc-900">{item.description}</div>
        {tx?.installmentCurrent && tx.installmentTotal && (
          <div className="text-xs text-zinc-500 mt-0.5">
            Parcela {tx.installmentCurrent}/{tx.installmentTotal}
          </div>
        )}
      </div>
      <div className="text-2xl font-extrabold text-red-600 mb-3">
        {formatBRL(item.amountCents)}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1">
        <span className={chipCls("bg-zinc-100 text-zinc-600 border-zinc-200")}>{dateStr}</span>
        <span className={chipCls("bg-zinc-100 text-zinc-600 border-zinc-200")}>{sourceLabel(item.source)}</span>
        {tx && <span className={paymentChip(tx.paymentType)}>{paymentLabel(tx.paymentType)}</span>}
        <span className={chipCls("bg-zinc-100 text-zinc-600 border-zinc-200")}>
          {item.person === "PEDRO" ? "Pedro" : item.person === "MIRELA" ? "Mirela" : "Ambos"}
        </span>
        <span className={walletChip(item.wallet)}>{walletLabel(item.wallet)}</span>
      </div>

      {/* ── TRANSACTION fields ─────────────────────────────────────────────── */}
      {tx && (
        <>
          <SectionLabel>Categoria</SectionLabel>
          <CategoryPicker
            categories={categories}
            selectedCategoryId={tx.categoryId}
            suggestion={tx.suggestion}
            onSelect={(id) => onUpdateTx(tx.rowHash, { categoryId: id })}
            onAcceptSuggestion={() =>
              tx.suggestion && onAcceptSuggestion(tx.rowHash, tx.suggestion)
            }
          />

          <SectionLabel>Outros campos</SectionLabel>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-600">Nome de exibição</label>
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                value={tx.normalized}
                onChange={(e) => onUpdateTx(tx.rowHash, { normalized: e.target.value })}
                placeholder="Ex.: Spotify"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-600">Pessoa</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={tx.person}
                  onChange={(e) =>
                    onUpdateTx(tx.rowHash, { person: e.target.value as Person })
                  }
                >
                  <option value="PEDRO">Pedro</option>
                  <option value="MIRELA">Mirela</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">Carteira</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={tx.wallet}
                  onChange={(e) =>
                    onUpdateTx(tx.rowHash, { wallet: e.target.value as Wallet })
                  }
                >
                  <option value="SALARIO">Salário</option>
                  <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                  <option value="OUTROS">Outros</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">Tipo de pagamento</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={tx.paymentType}
                  onChange={(e) =>
                    onUpdateTx(tx.rowHash, { paymentType: e.target.value as PaymentType })
                  }
                >
                  <option value="DEBITO_PIX">Débito/PIX</option>
                  <option value="CREDITO_A_VISTA">Crédito à vista</option>
                  <option value="PARCELADO">Parcelado</option>
                  <option value="IGNORAR">Ignorar</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">Tags</label>
                <div className="mt-1">
                  <TagsPicker
                    value={tx.tags ?? []}
                    options={tagOptions}
                    onChange={(next) => onUpdateTx(tx.rowHash, { tags: next })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-600">Notas</label>
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                value={tx.notes ?? ""}
                onChange={(e) => onUpdateTx(tx.rowHash, { notes: e.target.value })}
                placeholder="Observações..."
              />
            </div>
          </div>

          {/* Secondary actions */}
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={ruleDraft?.open ? onCloseRule : onOpenRule}
            >
              {ruleDraft?.open
                ? "▲ Fechar regra"
                : "➕ Criar regra para futuras importações"}
            </button>
            <button
              type="button"
              className="text-xs text-emerald-700 hover:underline"
              onClick={() => {
                const nextTags = new Set([...(tx.tags ?? []), "Fixa Dividida"]);
                onUpdateTx(tx.rowHash, {
                  person: "AMBOS",
                  tags: Array.from(nextTags),
                });
              }}
            >
              ⇄ Dividir 50/50
            </button>
          </div>

          {acceptedSuggestion && tx.suggestion && !ruleDraft?.open && (
            <button
              type="button"
              className="mt-1 text-xs text-blue-600 hover:underline"
              onClick={onOpenRule}
            >
              Criar regra para futuras importações →
            </button>
          )}
        </>
      )}

      {/* ── INCOME fields ──────────────────────────────────────────────────── */}
      {income && (
        <>
          <SectionLabel>Campos</SectionLabel>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-600">Pessoa</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={income.person}
                  onChange={(e) =>
                    onUpdateIncome(income.previewId, { person: e.target.value as Person })
                  }
                >
                  <option value="PEDRO">Pedro</option>
                  <option value="MIRELA">Mirela</option>
                  <option value="AMBOS">Ambos</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-600">Carteira</label>
                <select
                  className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                  value={income.wallet}
                  onChange={(e) =>
                    onUpdateIncome(income.previewId, { wallet: e.target.value as Wallet })
                  }
                >
                  <option value="SALARIO">Salário</option>
                  <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                  <option value="OUTROS">Outros</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600">Tipo de entrada</label>
              <select
                className="mt-1 w-full border rounded-lg px-2 py-2 text-sm"
                value={income.incomeType}
                onChange={(e) =>
                  onUpdateIncome(income.previewId, {
                    incomeType: e.target.value as IncomeType,
                  })
                }
              >
                <option value="SALARIO">Salário</option>
                <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                <option value="OUTROS">Outros</option>
                <option value="RESTANTE_MES_ANTERIOR">Restante Mês Anterior</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-600">Notas</label>
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm resize-none"
                rows={2}
                value={income.notes ?? ""}
                onChange={(e) =>
                  onUpdateIncome(income.previewId, { notes: e.target.value })
                }
                placeholder="Observações..."
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-100">
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={ruleDraft?.open ? onCloseRule : onOpenRule}
            >
              {ruleDraft?.open
                ? "▲ Fechar regra"
                : "➕ Criar regra para futuras importações"}
            </button>
          </div>
        </>
      )}

      {/* ── Rule draft section (expandable) ───────────────────────────────── */}
      {ruleDraft?.open && (
        <div className="mt-4 bg-zinc-50 border border-zinc-200 rounded-xl p-4">
          <div className="text-sm font-semibold mb-3">Criar regra (para próximos imports)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium">Alvo</label>
              <select
                className="mt-1 w-full border rounded-lg p-2 text-xs"
                value={ruleDraft.target}
                onChange={(e) =>
                  onSetDraft({ target: e.target.value as "TRANSACTION" | "INCOME" })
                }
              >
                <option value="TRANSACTION">Transação</option>
                <option value="INCOME">Entrada</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Match</label>
              <select
                className="mt-1 w-full border rounded-lg p-2 text-xs"
                value={ruleDraft.matchType}
                onChange={(e) =>
                  onSetDraft({
                    matchType: e.target.value as "CONTAINS" | "STARTS_WITH" | "REGEX",
                  })
                }
              >
                <option value="CONTAINS">Contém</option>
                <option value="STARTS_WITH">Começa com</option>
                <option value="REGEX">Regex</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Prioridade</label>
              <input
                className="mt-1 w-full border rounded-lg p-2 text-xs"
                type="number"
                value={ruleDraft.priority}
                onChange={(e) => onSetDraft({ priority: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs font-medium">Padrão (pattern)</label>
              <input
                className="mt-1 w-full border rounded-lg p-2 text-xs"
                value={ruleDraft.pattern}
                onChange={(e) => onSetDraft({ pattern: e.target.value })}
              />
              <div className="text-[11px] text-zinc-500 mt-1">
                Use um trecho estável (não precisa colar tudo).
              </div>
            </div>
            {ruleDraft.target === "TRANSACTION" ? (
              <>
                <div>
                  <label className="text-xs font-medium">Renomear para</label>
                  <input
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.renameTo}
                    onChange={(e) => onSetDraft({ renameTo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Categoria</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.categoryId}
                    onChange={(e) => onSetDraft({ categoryId: e.target.value })}
                  >
                    <option value="">(nenhuma)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {groupIcon(c.groupName)} {c.groupName} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Tags</label>
                  <input
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.tags}
                    onChange={(e) => onSetDraft({ tags: e.target.value })}
                    placeholder="Separadas por vírgula"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Pessoa</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.person}
                    onChange={(e) => onSetDraft({ person: e.target.value as "" | Person })}
                  >
                    <option value="">(não setar)</option>
                    <option value="PEDRO">Pedro</option>
                    <option value="MIRELA">Mirela</option>
                    <option value="AMBOS">Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Tipo</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.paymentType}
                    onChange={(e) =>
                      onSetDraft({ paymentType: e.target.value as "" | PaymentType })
                    }
                  >
                    <option value="">(não setar)</option>
                    <option value="DEBITO_PIX">Débito/PIX</option>
                    <option value="CREDITO_A_VISTA">Crédito à vista</option>
                    <option value="PARCELADO">Parcelado</option>
                    <option value="IGNORAR">Ignorar</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Carteira</label>
                  <select
                    className="mt-1 w-full border rounded-lg p-2 text-xs"
                    value={ruleDraft.wallet}
                    onChange={(e) =>
                      onSetDraft({ wallet: e.target.value as "" | Wallet })
                    }
                  >
                    <option value="">(não setar)</option>
                    <option value="SALARIO">Salário</option>
                    <option value="VALE_ALIMENTACAO">Vale</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-medium">Tipo de entrada</label>
                <select
                  className="mt-1 w-full border rounded-lg p-2 text-xs"
                  value={ruleDraft.incomeType}
                  onChange={(e) =>
                    onSetDraft({ incomeType: e.target.value as "" | IncomeType })
                  }
                >
                  <option value="">(obrigatório)</option>
                  <option value="SALARIO">Salário</option>
                  <option value="VALE_ALIMENTACAO">Vale Alimentação</option>
                  <option value="OUTROS">Outros</option>
                  <option value="RESTANTE_MES_ANTERIOR">Restante Mês Anterior</option>
                </select>
              </div>
            )}
          </div>

          {(ruleDraft.error || ruleDraft.ok) && (
            <div
              className={`mt-3 text-sm border rounded-lg p-3 ${
                ruleDraft.error
                  ? "bg-red-50 border-red-200 text-red-800"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}
            >
              {ruleDraft.error ?? ruleDraft.ok}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="border rounded-lg px-4 py-2 bg-zinc-900 text-white text-sm disabled:opacity-50"
              onClick={() => onSaveRule(false)}
              disabled={!!ruleDraft.saving}
            >
              {ruleDraft.saving ? "Salvando..." : "Salvar regra"}
            </button>
            <button
              className="border rounded-lg px-4 py-2 bg-white text-sm disabled:opacity-50"
              onClick={() => onSaveRule(true)}
              disabled={!!ruleDraft.saving}
            >
              {ruleDraft.saving ? "Salvando..." : "Salvar e aplicar nesta linha"}
            </button>
            <button
              className="border rounded-lg px-4 py-2 bg-white text-sm"
              onClick={onCloseRule}
              disabled={!!ruleDraft.saving}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          Pular →
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="flex-1 bg-zinc-900 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-zinc-800"
        >
          Classificar e avançar →
        </button>
      </div>
    </div>
  );
}
