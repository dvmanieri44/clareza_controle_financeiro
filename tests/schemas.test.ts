import { describe, expect, it } from "vitest";
import { accountSchema, cardSchema, cents, color, currency, date, entrySchema, month, name, positiveCents, positiveCurrency } from "@/lib/domain/schemas";
import { MAX_MONEY } from "@/lib/domain/finance";

describe("validação de datas e competências", () => {
  it.each(["1900-01-01", "2199-12-31", "2000-02-29", "2028-02-29"])("aceita a data real %s", value => expect(date.safeParse(value).success).toBe(true));
  it.each(["1899-12-31", "2200-01-01", "1900-02-29", "2026-02-29", "2026-04-31", "2026-00-01", "2026-01-00", "2026-10-17T12:00:00Z", "17/10/2026", "2026-1-1", ""])("rejeita a data inválida %s", value => expect(date.safeParse(value).success).toBe(false));
  it.each(["1900-01", "2199-12", "2026-10"])("aceita a competência %s", value => expect(month.safeParse(value).success).toBe(true));
  it.each(["1899-12", "2200-01", "2026-00", "2026-13", "2026-1", "2026-10-01"])("rejeita a competência %s", value => expect(month.safeParse(value).success).toBe(false));
});

describe("nomes, cores e valores monetários", () => {
  it("remove espaços periféricos dos nomes sem alterar o conteúdo", () => expect(name.parse("  Minha conta  ")).toBe("Minha conta"));
  it.each(["", " ", "a", "a".repeat(121)])("rejeita nome vazio, curto ou acima do limite", value => expect(name.safeParse(value).success).toBe(false));
  it("aceita exatamente 120 caracteres", () => expect(name.parse("a".repeat(120))).toHaveLength(120));
  it.each(["#000000", "#FFFFFF", "#16aB59"])("aceita a cor %s", value => expect(color.safeParse(value).success).toBe(true));
  it.each(["#fff", "red", "#gg0000", "167459"])("rejeita a cor %s", value => expect(color.safeParse(value).success).toBe(false));
  it("preserva limites em centavos inteiros", () => {
    expect(cents.parse(0)).toBe(0);
    expect(cents.parse(MAX_MONEY)).toBe(MAX_MONEY);
    expect(positiveCents.parse(1)).toBe(1);
  });
  it.each([-1, 1.5, Infinity, NaN, MAX_MONEY + 1])("rejeita centavos inválidos: %s", value => expect(cents.safeParse(value).success).toBe(false));
  it("converte a entrada monetária e apresenta erro de validação para texto inválido", () => {
    expect(currency.parse("R$ 1.234,56")).toBe(123456);
    expect(currency.safeParse("inexistente").success).toBe(false);
    expect(positiveCurrency.safeParse("0,00").success).toBe(false);
    expect(positiveCurrency.safeParse("-1,00").success).toBe(false);
  });
});

const entry = { description: "Compra", amount: 100, kind: "expense", accountId: "conta", categoryId: "categoria", date: "2026-10-17", dueDate: "", status: "settled", notes: "" };
describe("validação dos cadastros", () => {
  it("aceita uma transação sem vencimento e com observação de até 1000 caracteres", () => expect(entrySchema.parse({ ...entry, notes: "a".repeat(1000) }).notes).toHaveLength(1000));
  it.each([{ amount: 0 }, { amount: -100 }, { accountId: "" }, { categoryId: "" }, { kind: "purchase" }, { status: "paid" }, { dueDate: "2026-02-30" }, { notes: "a".repeat(1001) }])("rejeita uma transação inválida: %j", patch => expect(entrySchema.safeParse({ ...entry, ...patch }).success).toBe(false));
  it("aceita saldo inicial negativo, mas não fracionário ou fora do limite", () => {
    const account = { name: "Conta", type: "Conta corrente", initialBalance: -MAX_MONEY, color: "#167459" };
    expect(accountSchema.parse(account).initialBalance).toBe(-MAX_MONEY);
    expect(accountSchema.safeParse({ ...account, initialBalance: -MAX_MONEY - 1 }).success).toBe(false);
    expect(accountSchema.safeParse({ ...account, initialBalance: 1.5 }).success).toBe(false);
    expect(accountSchema.safeParse({ ...account, type: "Banco inválido" }).success).toBe(false);
  });
  it("aceita fechamento e vencimento nos limites de 1 a 31", () => {
    expect(cardSchema.safeParse({ name: "Cartão", limit: 1, closingDay: 1, dueDay: 31, color: "#167459" }).success).toBe(true);
  });
  it.each([{ limit: 0 }, { closingDay: 0 }, { closingDay: 32 }, { dueDay: 32 }, { dueDay: 1.5 }])("rejeita um cartão inválido: %j", patch => expect(cardSchema.safeParse({ name: "Cartão", limit: 10000, closingDay: 5, dueDay: 15, color: "#167459", ...patch }).success).toBe(false));
});
