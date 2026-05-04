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
