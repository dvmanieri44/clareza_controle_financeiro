import { afterEach, describe, expect, it, vi } from "vitest";
import { balance, budgetProgress, expenseByCategory, firstInvoiceMonth, goalAfterMovement, investmentReturn, MAX_MONEY, money, moneyInput, monthDate, monthLabel, monthOf, parseMoney, paymentId, recurrenceOccurrences, shiftMonth, shortDate, splitInstallments, today, totals } from "@/lib/domain/finance";
import type { Account, Entry, Recurrence } from "@/lib/domain/types";

const account: Account = { id: "a", name: "Conta", type: "Dinheiro", initialBalance: -1000, color: "#167459", archived: false, createdAt: "" };
const entry = (patch: Partial<Entry> = {}): Entry => ({ id: "e", createdAt: "", kind: "expense", description: "Compra", amount: 100, date: "2026-10-17", dueDate: "", status: "settled", accountId: "a", toAccountId: "", categoryId: "c", cardId: "", invoiceMonth: "", groupId: "", installment: 0, installments: 0, notes: "", recurrenceId: "", ...patch });
const recurrence: Recurrence = { id: "r", createdAt: "", description: "Aluguel", kind: "expense", amount: 10000, accountId: "a", categoryId: "c", startDate: "2020-01-31", endDate: "", notes: "", archived: false };
afterEach(() => vi.useRealTimers());

describe("limites monetários", () => {
  it("aceita exatamente o limite positivo e negativo, preservando centavos", () => {
    expect(parseMoney("90.000.000.000,00")).toBe(MAX_MONEY);
    expect(parseMoney("-90.000.000.000,00")).toBe(-MAX_MONEY);
    expect(() => parseMoney("90.000.000.000,01")).toThrow();
    expect(() => parseMoney("-90.000.000.000,01")).toThrow();
  });
  it.each(["1R$2", "1,00R$", "1.23,45", "+1,00", "1e2", "--1,00"])("rejeita uma representação ambígua %s", value => expect(() => parseMoney(value)).toThrow());
  it("normaliza zero negativo e mantém frações de um dígito", () => {
    expect(Object.is(parseMoney("-0,00"), 0)).toBe(true);
    expect(parseMoney("1,2")).toBe(120);
    expect(moneyInput(-12345)).toBe("-123,45");
    expect(money(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
  it.each([0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])("não parcela um total inválido %s", value => expect(() => splitInstallments(value, 2)).toThrow());
  it.each([0, -1, 61, 1.5, NaN])("não aceita quantidade inválida %s", count => expect(() => splitInstallments(10000, count)).toThrow());
  it("não altera a soma nem deixa parcelas diferirem mais de um centavo", () => {
    for (const total of [60, 99, 10001, MAX_MONEY]) for (const count of [1, 2, 3, 12, 60]) {
      const parts = splitInstallments(total, count);
      expect(parts.reduce((sum, value) => sum + value, 0)).toBe(total);
      expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
    }
  });
});

describe("calendário e competência", () => {
  it("usa o dia local sem antecipar a data na virada de UTC", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 17, 23, 59));
    expect(today()).toBe("2026-10-17");
    expect(monthOf()).toBe("2026-10");
    expect(shortDate("2026-10-17")).toBe("17/10/2026");
    expect(shortDate("")).toBe("—");
    expect(monthLabel("2026-10")).toMatch(/out.*26/);
  });
  it("ajusta fevereiro e atravessa a virada do ano nos dois sentidos", () => {
    expect(monthDate("2026-02", 31)).toBe("2026-02-28");
    expect(monthDate("2028-02", 31)).toBe("2028-02-29");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("aplica fechamento e vencimento no mesmo dia ao ciclo seguinte", () => {
    expect(firstInvoiceMonth("2026-12-04", { closingDay: 5, dueDay: 5 })).toBe("2027-01");
    expect(firstInvoiceMonth("2026-12-05", { closingDay: 5, dueDay: 5 })).toBe("2027-02");
    expect(paymentId("card", "2026-10")).toBe("invoice_card_2026-10");
  });
});

describe("isolamento das movimentações nos cálculos", () => {
  it("preserva saldo inicial negativo e ignora movimentos de outra conta", () => {
    expect(balance(account, [])).toBe(-1000);
    expect(balance(account, [entry({ accountId: "outra" }), entry({ kind: "transfer", accountId: "outra", toAccountId: "terceira" })])).toBe(-1000);
    expect(balance(account, [entry({ kind: "transfer", accountId: "outra", toAccountId: "a" })])).toBe(-900);
  });
  it("agrupa apenas despesas de caixa e parcelas na competência correta", () => {
    const entries = [entry(), entry({ amount: 200, status: "pending" }), entry({ kind: "income" }), entry({ kind: "transfer" }), entry({ kind: "invoicePayment" }), entry({ categoryId: "d", amount: 300, kind: "purchase", date: "2026-09-01", invoiceMonth: "2026-10" }), entry({ kind: "purchase", invoiceMonth: "2026-11" })];
    expect(expenseByCategory(entries, "2026-10")).toEqual({ c: 100, d: 300 });
    expect(totals(entries, "2026-10")).toEqual({ income: 100, expense: 400 });
    expect(totals([])).toEqual({ income: 0, expense: 0 });
    expect(budgetProgress({ id: "b", createdAt: "", categoryId: "c", month: "2026-10", amount: 0 }, entries)).toEqual({ used: 100, percent: 0 });
  });
  it("não divide por zero e preserva prejuízo nominal", () => {
    expect(investmentReturn(10000, 7500)).toEqual({ nominal: -2500, percent: -25 });
    expect(investmentReturn(0, 100)).toEqual({ nominal: 100, percent: 0 });
  });
  it.each([[-1, 0], [MAX_MONEY, 1], [100, -101], [1.5, 1], [0, Infinity]])("rejeita saldo de meta inválido: %s + %s", (current, amount) => expect(() => goalAfterMovement(current, amount)).toThrow());
});

describe("limites da geração de recorrências", () => {
  it("gera no máximo 120 competências, sem perder a última", () => {
    const rows = recurrenceOccurrences(recurrence, "2029-12-31");
    expect(rows).toHaveLength(120);
    expect(rows.at(-1)).toEqual({ id: "rec_r_2029-12", date: "2029-12-31" });
    expect(() => recurrenceOccurrences(recurrence, "2030-01-31")).toThrow(/120/);
  });
  it("não gera registros anteriores ao início ou posteriores ao término", () => {
    expect(recurrenceOccurrences(recurrence, "2019-12-31")).toEqual([]);
    expect(recurrenceOccurrences({ ...recurrence, endDate: "2020-02-28" }, "2026-10-17")).toEqual([{ id: "rec_r_2020-01", date: "2020-01-31" }]);
    expect(recurrenceOccurrences({ ...recurrence, startDate: "2020-02-29", endDate: "2020-03-29" }, "2026-10-17").map(row => row.date)).toEqual(["2020-02-29", "2020-03-29"]);
  });
});
