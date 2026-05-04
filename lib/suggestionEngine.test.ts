import { describe, it, expect } from "vitest";
import { tokenize, jaccardSimilarity } from "./suggestionEngine";

describe("tokenize", () => {
  it("converte para minúsculas", () => {
    expect(tokenize("UBER")).toEqual(["uber"]);
  });

  it("remove acentos", () => {
    expect(tokenize("AÇAÍ")).toEqual(["acai"]);
  });

  it("remove prefixos de ruído: PIX, PAG, DM, IFD", () => {
    expect(tokenize("PIX")).toEqual([]);
    expect(tokenize("PAG")).toEqual([]);
    expect(tokenize("DM")).toEqual([]);
    expect(tokenize("IFD")).toEqual([]);
  });

  it("remove sequências numéricas longas (>=6 dígitos)", () => {
    expect(tokenize("UBER 123456789")).toEqual(["uber"]);
  });

  it("mantém números curtos", () => {
    expect(tokenize("PARCELA 1")).toEqual(["parcela"]);
  });

  it("separa tokens por caracteres especiais", () => {
    expect(tokenize("UBER*TRIP")).toEqual(["uber", "trip"]);
  });

  it("filtra tokens com menos de 3 caracteres", () => {
    expect(tokenize("UBER SP")).toEqual(["uber"]);
  });

  it("caso real: fatura Nubank com ID e estado", () => {
    expect(tokenize("UBER *TRIP 12345678 SP")).toEqual(["uber", "trip"]);
  });

  it("caso real: iFood", () => {
    expect(tokenize("IFOOD*PEDIDO 987654")).toEqual(["ifood", "pedido"]);
  });
});

describe("jaccardSimilarity", () => {
  it("retorna 1.0 para conjuntos idênticos", () => {
    expect(jaccardSimilarity(["uber", "trip"], ["uber", "trip"])).toBe(1);
  });

  it("retorna 0 para conjuntos disjuntos", () => {
    expect(jaccardSimilarity(["uber"], ["ifood"])).toBe(0);
  });

  it("retorna valor correto para sobreposição parcial", () => {
    // interseção={uber}, união={uber,trip,eats} → 1/3
    expect(jaccardSimilarity(["uber", "trip"], ["uber", "eats"])).toBeCloseTo(1 / 3);
  });

  it("retorna 0 para arrays vazios", () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });

  it("retorna 0 se um dos arrays for vazio", () => {
    expect(jaccardSimilarity(["uber"], [])).toBe(0);
  });
});

import { findBestMatch } from "./suggestionEngine";

describe("findBestMatch", () => {
  const history = [
    {
      description: "UBER *TRIP 11111111 SP",
      categoryId: "cat-transporte",
      normalized: "Uber",
      person: "PEDRO",
      wallet: "SALARIO",
      paymentType: "DEBITO_PIX",
      tags: ["Transporte"],
      occurredAt: new Date("2026-03-01"),
    },
    {
      description: "IFOOD*PEDIDO 22222222",
      categoryId: "cat-alimentacao",
      normalized: "iFood",
      person: "MIRELA",
      wallet: "VALE_ALIMENTACAO",
      paymentType: "DEBITO_PIX",
      tags: ["Delivery"],
      occurredAt: new Date("2026-03-05"),
    },
  ];

  it("retorna a melhor sugestão acima do threshold", () => {
    const result = findBestMatch("UBER *TRIP 99999999 RJ", history);
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("cat-transporte");
    expect(result!.confidence).toBe(1);
    expect(result!.sourceDescription).toBe("UBER *TRIP 11111111 SP");
    expect(result!.suggestedNormalized).toBe("Uber");
  });

  it("retorna null quando nenhuma descrição supera o threshold de 0.6", () => {
    const result = findBestMatch("NETFLIX ASSINATURA", history);
    expect(result).toBeNull();
  });

  it("retorna null para histórico vazio", () => {
    expect(findBestMatch("UBER *TRIP 12345", [])).toBeNull();
  });

  it("em empate de score, retorna o match mais recente", () => {
    const tiedHistory = [
      {
        description: "UBER *TRIP 11111111",
        categoryId: "cat-old",
        normalized: "Uber Antigo",
        person: "PEDRO",
        wallet: "SALARIO",
        paymentType: "DEBITO_PIX",
        tags: [],
        occurredAt: new Date("2026-01-01"),
      },
      {
        description: "UBER *TRIP 22222222",
        categoryId: "cat-new",
        normalized: "Uber Novo",
        person: "PEDRO",
        wallet: "SALARIO",
        paymentType: "DEBITO_PIX",
        tags: [],
        occurredAt: new Date("2026-04-01"),
      },
    ];
    const result = findBestMatch("UBER *TRIP 33333333", tiedHistory);
    expect(result!.categoryId).toBe("cat-new");
  });
});
