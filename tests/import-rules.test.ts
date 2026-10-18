import { describe, expect, it } from "vitest";
import { importRuleId, normalizeDescription, rememberedRules, similarPurchase, suggestCategory, validateRule } from "@/lib/domain/import-rules";
import type { Category, Entry, ImportRule } from "@/lib/domain/types";

const categories: Category[] = [
  { id: "food", name: "Comida", type: "expense", archived: false, color: "#000000", icon: "tag", createdAt: "" },
  { id: "other", name: "Outros", type: "expense", archived: false, color: "#000000", icon: "tag", createdAt: "" },
  { id: "old", name: "Antiga", type: "expense", archived: true, color: "#000000", icon: "tag", createdAt: "" },
  { id: "income", name: "Receita", type: "income", archived: false, color: "#000000", icon: "tag", createdAt: "" },
];
const rule = (pattern: string, categoryId = "food", match: ImportRule["match"] = "contains"): ImportRule => ({ id: pattern, pattern, categoryId, match, createdAt: "" });
describe("categorias lembradas na importação", () => {
  it("normaliza acentos, caixa, espaços e pontuação sem descartar números", () => {
    expect(normalizeDescription("  CAFÉ * São-João 123 ")).toBe("cafe sao joao 123");
  });
  it("prioriza descrição inteira sobre uma regra genérica", () => {
    expect(suggestCategory("MERCADO CENTRAL", [rule("mercado"), rule("mercado central", "other", "exact")], categories)).toBe("other");
  });
  it("prefere o conjunto de palavras mais específico e não casa pedaços de palavras", () => {
    expect(suggestCategory("mercado central loja", [rule("mercado"), rule("mercado central", "other")], categories)).toBe("other");
    expect(suggestCategory("supermercado", [rule("mercado")], categories)).toBe("");
  });
  it("não sugere categorias arquivadas, de receita ou removidas", () => {
    expect(suggestCategory("mercado", [rule("mercado", "old"), rule("mercado", "income"), rule("mercado", "missing")], categories)).toBe("");
  });
  it("deixa conflitos igualmente específicos sem sugestão", () => {
    expect(suggestCategory("loja casa", [rule("loja", "food"), rule("casa", "other")], categories)).toBe("");
    expect(suggestCategory("loja casa", [rule("loja"), rule("casa")], categories)).toBe("food");
  });
  it("lembra uma única regra por descrição e ignora escolhas conflitantes", () => {
    expect(rememberedRules([{ description: "CAFÉ", categoryId: "food" }, { description: "cafe", categoryId: "food" }, { description: "Loja", categoryId: "food" }, { description: "LOJA", categoryId: "other" }, { description: "!", categoryId: "food" }])).toEqual([{ pattern: "cafe", categoryId: "food", match: "exact" }]);
  });
  it("identifica compras semelhantes por cartão, mês, dia, valor e descrição normalizada", () => {
    const entries = [{ kind: "purchase", cardId: "card", invoiceMonth: "2026-10", date: "2026-09-20", amount: 1200, description: "CAFÉ * Central" }] as Entry[];
    const row = { date: "2026-09-20", amount: 1200, description: "cafe central" };
    expect(similarPurchase(entries, "card", "2026-10", row)).toBe(true);
    expect(similarPurchase(entries, "other", "2026-10", row)).toBe(false);
    expect(similarPurchase(entries, "card", "2026-11", row)).toBe(false);
    expect(similarPurchase(entries, "card", "2026-10", { ...row, amount: 1201 })).toBe(false);
    expect(similarPurchase(entries, "card", "2026-10", { ...row, date: "2026-09-21" })).toBe(false);
  });
  it("valida regras e rejeita entradas sem descrição ou categoria válida", () => {
    expect(validateRule(" Café! ", "exact", "food")).toEqual({ pattern: "cafe", match: "exact", categoryId: "food" });
    for (const [pattern, match, category] of [["!", "exact", "food"], ["x".repeat(121), "exact", "food"], ["cafe", "invalid", "food"], ["cafe", "contains", ""], ["cafe", "contains", "a/b"]]) expect(() => validateRule(pattern, match, category)).toThrow();
  });
  it("mantém IDs estáveis e separa comparações exatas de palavras contidas", async () => {
    expect(await importRuleId("CAFÉ!", "exact")).toBe(await importRuleId("cafe", "exact"));
    expect(await importRuleId("cafe", "exact")).not.toBe(await importRuleId("cafe", "contains"));
  });
});
