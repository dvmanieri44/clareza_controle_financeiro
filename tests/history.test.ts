import { describe, expect, it } from "vitest";
import { compareEntries, historyBranches, matchesDescription, unpaidMonthRanges, type HistoryFilters } from "@/lib/domain/history";

const defaults: HistoryFilters = { month: "2026-10", kind: "", accountId: "", categoryId: "", startDate: "", endDate: "", search: "", sort: "date-desc" };
describe("planejamento do histórico", () => {
  it("separa a competência do cartão da data de caixa", () => {
    const branches = historyBranches(defaults);
    expect(branches.find(branch => branch.kind === "purchase")).toMatchObject({ invoiceMonth: "2026-10", startDate: undefined, endDate: undefined });
    expect(branches.find(branch => branch.kind === "expense")).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-31", invoiceMonth: undefined });
  });
  it("cruza datas explícitas com o mês apenas para movimentações de caixa", () => {
    const branches = historyBranches({ ...defaults, startDate: "2026-09-20", endDate: "2026-10-15" });
    expect(branches.find(branch => branch.kind === "income")?.startDate).toBe("2026-10-01");
    expect(branches.find(branch => branch.kind === "purchase")?.startDate).toBe("2026-09-20");
    expect(historyBranches({ ...defaults, kind: "income", startDate: "2026-11-01" })).toEqual([]);
  });
  it("inclui origem e destino no filtro de conta", () => {
    expect(historyBranches({ ...defaults, kind: "transfer", accountId: "a" }).map(branch => branch.accountField)).toEqual(["accountId", "toAccountId"]);
    expect(historyBranches({ ...defaults, month: "", kind: "expense" })[0].startDate).toBeUndefined();
  });
  it.each([{ month: "2026-13" }, { startDate: "2026-02-30" }, { startDate: "2026-10-02", endDate: "2026-10-01" }, { kind: "invalid" }, { sort: "invalid" }])("rejeita filtros inválidos antes da consulta: %j", patch => {
    expect(() => historyBranches({ ...defaults, ...patch } as HistoryFilters)).toThrow();
  });
  it("mantém desempate por documento em todas as ordenações", () => {
    const a = { id: "a", date: "2026-10-01", amount: 100 }, b = { ...a, id: "b" };
    expect(compareEntries(a, b, "date-asc")).toBeLessThan(0);
    expect(compareEntries(a, b, "date-desc")).toBeGreaterThan(0);
    expect(compareEntries(a, b, "amount-desc")).toBeGreaterThan(0);
    expect(compareEntries(a, { ...b, amount: 200 }, "amount-desc")).toBeGreaterThan(0);
  });
  it("busca substring sem diferenciar caixa e preserva acentos", () => {
    expect(matchesDescription({ description: "Café Central" }, "  FÉ  ")).toBe(true);
    expect(matchesDescription({ description: "Café Central" }, "cafe")).toBe(false);
  });
  it("gera lacunas de meses não pagos sem repetir meses ou incluir os pagos", () => {
    expect(unpaidMonthRanges(["2026-02", "2026-01", "2026-02", "2026-04"])).toEqual([{ start: "1900-01", end: "2026-01" }, { start: "2026-03", end: "2026-04" }, { start: "2026-05", end: "2200-01" }]);
    expect(unpaidMonthRanges(["2199-12"])).toEqual([{ start: "1900-01", end: "2199-12" }]);
    expect(unpaidMonthRanges(["1900-01"])[0].start).toBe("1900-02");
    expect(unpaidMonthRanges([])).toEqual([{ start: "1900-01", end: "2200-01" }]);
  });
});
