# Import Modal UX Redesign

**Date:** 2026-05-05  
**Status:** Approved

## Problem

The current import modal presents all transaction fields inline in a wide 10-column table. This makes classifying purchases difficult for two reasons:

1. **Category selection is a flat `<select>` dropdown** — with many categories listed as plain text, no grouping, no search. Hard to find the right one quickly.
2. **Too many fields per row** — normalized name, person, payment type, wallet, category, tags, notes, and rule creation are all jammed into fixed-width columns, making each row feel overwhelming.

## Solution: Split View Modal

Replace the wide table with a two-panel layout:

- **Left panel** — compact, scrollable list of all transactions
- **Right panel** — focused detail view for the selected transaction

### Left Panel (Transaction List)

Each row shows:
- Checkbox (include/exclude from import)
- Description (truncated if long)
- Date
- Amount
- Status badge:
  - Yellow "sem categoria" — needs attention
  - Amber "💡 Sugestão X%" — has an AI suggestion, not yet accepted
  - Green "✓ Categoria — Subcategoria" — already classified

Top toolbar:
- Text filter input (filters descriptions in real time)
- Filter chips: "Todas" | "Sem categoria" (quickly focus on unclassified rows)

Clicking any row opens it in the right panel. The previously selected row is highlighted with a blue left border.

### Right Panel (Detail View)

Divided into sections, top to bottom:

**Transaction header**
- Description (large, prominent)
- Amount (large, red)
- Metadata chips: date, payment type, person, wallet

**AI Suggestion (when present and category not yet set)**
- Amber box at the top of the category section
- Shows: suggested category name + confidence % + source description
- One-click "Aceitar" button — applies all suggested fields instantly

**Category picker**
- Search input: filters category list as the user types (matches group name or category name)
- Group buttons: one per group (🍽️ Alimentação, 🏠 Fixa, 🎬 Lazer, etc.) — clicking a group expands its subcategories as chips below
- Subcategory chips: clicking selects the category (chip turns green)
- Only one group expanded at a time

**Other fields** (below the category picker, less prominent)
- Display name (normalized) — text input
- Pessoa — select: Pedro / Mirela / Ambos
- Carteira — select: Salário / Vale Alimentação / Outros
- Notas — text input

**Secondary actions** (footer of the panel, small links)
- "➕ Criar regra para futuras importações" — expands an inline rule draft section at the bottom of the right panel (same fields as current sub-row, reused as-is)
- "⇄ Dividir 50/50" — sets Pessoa = Ambos, adds tag "Fixa Dividida"

**Navigation buttons**
- "Classificar e avançar →" (primary) — saves current fields and moves to next uncategorized transaction
- "Pular →" (secondary) — moves to next without saving changes

### Auto-advance with Undo

After clicking "Classificar e avançar →":
1. Panel immediately advances to the next uncategorized transaction
2. A toast notification appears at the bottom of the screen for ~3 seconds:  
   `"[Description] classificado como [Categoria]" [Desfazer]`
3. Clicking "Desfazer" reverts the classification and returns to that transaction

### Header (unchanged from current)

- Title + subtitle
- Progress pill: "Sem categoria: N de M"
- Count pill: "Selecionados: N"
- "Cancelar" button
- "Confirmar importação ✓" button (primary)

## What Changes vs. Current UI

| Current | New |
|---|---|
| 10-column table, horizontal scroll | Split view, no horizontal scroll |
| Category = flat `<select>` dropdown | Category = search + group chips + subcategory chips |
| AI suggestion buried in category column | AI suggestion box at top, prominent |
| All fields inline in table row | Secondary fields collapsed into lower section of panel |
| Rule creation = sub-row spanning all columns | Rule creation = link at bottom of panel |
| No navigation between rows | "Classificar e avançar →" + "Pular →" |
| No undo | Toast with 3s undo |
| No filter | Filter by text + "Sem categoria" chip |

## What Does NOT Change

- The data model: `PreviewTx`, `PreviewIncome`, `RuleDraft` types stay the same
- The API: `/api/import/nubank/preview` and `/api/import/nubank/commit` stay the same
- The suggestion engine: `getSuggestions`, `acceptSuggestion`, `draftFromSuggestion` logic stays the same
- Checkbox-based include/exclude per transaction
- "Confirmar importação" triggers the same commit flow

## Out of Scope

- Rule creation UI redesign (reused as-is, placed behind a link in the panel)
- Mobile layout (desktop-first, responsive improvements deferred)
- Keyboard navigation shortcuts
- Bulk editing (select multiple + apply category to all)
