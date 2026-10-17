import { describe, expect, it } from "vitest";
import { balance, budgetProgress, firstInvoiceMonth, goalAfterMovement, investmentReturn, invoiceTotal, moneyInput, parseMoney, recurrenceOccurrences, splitInstallments, totals } from "@/lib/domain/finance";
import { date } from "@/lib/domain/schemas";
import type { Account, Budget, Entry, Recurrence } from "@/lib/domain/types";
const account: Account = { id: "a", name: "Banco", type: "Conta corrente", initialBalance: 10000, color: "#10b981", archived: false, createdAt: "2026-01-01T00:00:00.000Z" };
const entry = (overrides: Partial<Entry> = {}): Entry => ({ id: "e", kind: "expense", description: "Despesa", amount: 1000, date: "2026-10-05", dueDate: "", status: "settled", accountId: "a", toAccountId: "", categoryId: "food", cardId: "", invoiceMonth: "", groupId: "", installment: 0, installments: 0, notes: "", recurrenceId: "", createdAt: "2026-10-05T12:00:00.000Z", ...overrides });
describe("dinheiro e datas", () => {
  it.each([["1.234,56",123456],["0,01",1],["100",10000],["-12,10",-1210],["R$ 20,50",2050]])("converte %s em centavos exatos", (input, expected) => expect(parseMoney(String(input))).toBe(expected));
  it.each(["1.2", "12,345", "abc", "NaN", "1,2,3", "90000000001", "1e3"])("rejeita %s", v => expect(() => parseMoney(v)).toThrow());
  it("preserva centavos no round trip", () => { for (const v of [1, 99, 100, 123456, -1234, 9000000000000]) expect(parseMoney(moneyInput(v))).toBe(v); });
  it("rejeita dias inexistentes e aceita ano bissexto", () => { expect(date.safeParse("2026-02-30").success).toBe(false); expect(date.safeParse("2028-02-29").success).toBe(true); expect(date.safeParse("2026-13-01").success).toBe(false); });
});
describe("saldos e resultado", () => {
  it("ignora pendências, compras e movimentos posteriores à data de corte", () => expect(balance(account, [entry(), entry({ kind:"income", amount:5000 }), entry({ status:"pending", amount:99999 }), entry({ kind:"purchase", amount:99999 }), entry({ date:"2027-01-01", amount:100000 })], "2026-10-31")).toBe(14000));
  it("transferências preservam a soma e não geram receita ou despesa", () => { const b = { ...account, id:"b", initialBalance:0 }; const transfer = entry({ kind:"transfer", toAccountId:"b", amount:3000 }); expect(balance(account,[transfer])).toBe(7000); expect(balance(b,[transfer])).toBe(3000); expect(totals([transfer])).toEqual({ income:0, expense:0 }); });
  it("pagamento da fatura reduz a conta sem duplicar gasto", () => { const purchase = entry({ kind:"purchase", accountId:"", cardId:"c", invoiceMonth:"2026-10", amount:5000 }); const payment = entry({ kind:"invoicePayment", amount:5000, cardId:"c", invoiceMonth:"2026-10" }); expect(balance(account,[purchase,payment])).toBe(5000); expect(totals([purchase,payment],"2026-10").expense).toBe(5000); });
  it("usa a competência do cartão e a data dos movimentos de caixa", () => expect(totals([entry({ kind:"purchase", invoiceMonth:"2026-11", amount:600 }), entry({ kind:"income", amount:3000 }), entry({ status:"pending", amount:900 })],"2026-10")).toEqual({ income:3000, expense:0 }));
});
describe("parcelas e faturas", () => {
  it("distribui o resto sem perder centavos", () => { expect(splitInstallments(10000,3)).toEqual([3334,3333,3333]); for(let n=1;n<=60;n++) expect(splitInstallments(123456,n).reduce((s,v)=>s+v,0)).toBe(123456); });
  it("rejeita parcelas sem valor e contagem inválida", () => { expect(() => splitInstallments(1,2)).toThrow(); expect(() => splitInstallments(10,0)).toThrow(); expect(() => splitInstallments(100,1.5)).toThrow(); });
  it("apura fechamento e virada do ano", () => { const card = { closingDay:5,dueDay:15 }; expect(firstInvoiceMonth("2026-10-04",card)).toBe("2026-10"); expect(firstInvoiceMonth("2026-10-05",card)).toBe("2026-11"); expect(firstInvoiceMonth("2026-12-20",card)).toBe("2027-01"); expect(firstInvoiceMonth("2026-10-01",{closingDay:25,dueDay:5})).toBe("2026-11"); });
  it("ajusta fechamento no último dia do mês", () => expect(firstInvoiceMonth("2026-02-28",{closingDay:31,dueDay:10})).toBe("2026-04"));
  it("soma somente o cartão e a competência selecionados", () => expect(invoiceTotal([entry({kind:"purchase",cardId:"c",invoiceMonth:"2026-10"}),entry({kind:"purchase",cardId:"d",invoiceMonth:"2026-10"}),entry()],"c","2026-10")).toBe(1000));
});
describe("recorrências, metas e orçamentos", () => {
  const rule: Recurrence = { id:"rent", description:"Aluguel", amount:10000, kind:"expense", accountId:"a", categoryId:"food", startDate:"2026-01-31", endDate:"", notes:"", archived:false, createdAt:"" };
  it("ajusta o dia 31 e mantém IDs determinísticos", () => { const first=recurrenceOccurrences(rule,"2026-03-31"); expect(first.map(v=>v.date)).toEqual(["2026-01-31","2026-02-28","2026-03-31"]); expect(recurrenceOccurrences(rule,"2026-03-31")).toEqual(first); expect(new Set([...first,...first].map(v=>v.id)).size).toBe(3); });
  it("respeita fim e pausa", () => { expect(recurrenceOccurrences({...rule,endDate:"2026-02-28"},"2026-06-01")).toHaveLength(2); expect(recurrenceOccurrences({...rule,archived:true},"2026-12-01")).toHaveLength(0); });
  it("valida retiradas de metas", () => { expect(goalAfterMovement(1000,250)).toBe(1250); expect(goalAfterMovement(1000,-1000)).toBe(0); expect(()=>goalAfterMovement(1000,-1001)).toThrow(); });
  it("considera cartão no orçamento e ignora pagamentos de fatura", () => { const b:Budget={id:"b",categoryId:"food",month:"2026-10",amount:10000,createdAt:""}; expect(budgetProgress(b,[entry({amount:5000}),entry({kind:"purchase",invoiceMonth:"2026-10",amount:3000}),entry({kind:"invoicePayment",amount:3000})])).toEqual({used:8000,percent:80}); expect(budgetProgress(b,[entry({amount:11000})]).percent).toBe(110); });
  it("calcula resultado nominal sem dividir por zero", () => { expect(investmentReturn(10000,12000)).toEqual({nominal:2000,percent:20}); expect(investmentReturn(0,0).percent).toBe(0); });
});
