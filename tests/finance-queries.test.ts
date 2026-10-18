import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { balance, totals } from "@/lib/domain/finance";
import type { Account, Card, Entry } from "@/lib/domain/types";
import type { HistoryFilters } from "@/lib/domain/history";

type Clause = { type: string; field?: string; op?: string; value?: unknown; direction?: string; values?: unknown[] };
type Query = { path: string; clauses: Clause[] };
type RecordData = Record<string, unknown>;
const state = vi.hoisted(() => ({ documents: new Map<string, RecordData>(), calls: [] as { query: Query; aggregate: boolean }[], fail: false }));
vi.mock("@/lib/firebase/client", () => ({ firebase: () => ({ db: {} }) }));
vi.mock("firebase/firestore", () => {
  const compare = (a: unknown, b: unknown) => a === b ? 0 : (a as string | number) < (b as string | number) ? -1 : 1;
  function execute(q: Query) {
    if (state.fail) throw new Error("Firestore indisponível");
    const items = [...state.documents].filter(([path]) => path.startsWith(q.path + "/") && path.slice(q.path.length + 1).indexOf("/") < 0).map(([path, data]) => ({ path, id: path.split("/").at(-1)!, data }));
    let rows = items.filter(item => q.clauses.filter(clause => clause.type === "where").every(clause => {
      const value = clause.field === "__name__" ? item.id : item.data[clause.field!];
      if (value === undefined) return false;
      return clause.op === "==" ? value === clause.value : clause.op === "in" ? (clause.value as unknown[]).includes(value) : clause.op === ">=" ? compare(value, clause.value) >= 0 : clause.op === "<=" ? compare(value, clause.value) <= 0 : clause.op === "<" ? compare(value, clause.value) < 0 : false;
    }));
    const orders = q.clauses.filter(clause => clause.type === "order");
    if (!orders.length) orders.push({ type: "order", field: "__name__", direction: "asc" });
    const valueAt = (row: typeof rows[number], field: string) => field === "__name__" ? row.id : row.data[field];
    rows = rows.filter(row => orders.every(order => valueAt(row, order.field!) !== undefined));
    rows.sort((a, b) => {
      for (const order of orders) {
        const delta = compare(valueAt(a, order.field!), valueAt(b, order.field!)) * (order.direction === "desc" ? -1 : 1);
        if (delta) return delta;
      }
      return compare(a.id, b.id);
    });
    const cursor = q.clauses.find(clause => clause.type === "cursor");
    if (cursor) rows = rows.filter(row => {
      for (let index = 0; index < orders.length; index++) {
        const delta = compare(valueAt(row, orders[index].field!), cursor.values![index]) * (orders[index].direction === "desc" ? -1 : 1);
        if (delta) return delta > 0;
      }
      return false;
    });
    const bound = q.clauses.find(clause => clause.type === "limit");
    if (bound) rows = rows.slice(0, Number(bound.value));
    return rows;
  }
  return {
    collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/") }),
    documentId: () => "__name__",
    where: (field: string, op: string, value: unknown) => ({ type: "where", field, op, value }),
    orderBy: (field: string, direction = "asc") => ({ type: "order", field, direction }),
    limit: (value: number) => ({ type: "limit", value }),
    startAfter: (...values: unknown[]) => ({ type: "cursor", values }),
    query: (parent: { path: string }, ...clauses: Clause[]) => ({ ...parent, clauses }),
    sum: (field: string) => ({ type: "sum", field }), count: () => ({ type: "count" }),
    getDocs: async (q: Query) => {
      state.calls.push({ query: q, aggregate: false });
      const rows = execute(q);
      return { empty: !rows.length, size: rows.length, docs: rows.map(row => ({ id: row.id, ref: { path: row.path }, data: () => row.data })) };
    },
    getAggregateFromServer: async (q: Query, spec: Record<string, { type: string; field?: string }>) => {
      state.calls.push({ query: q, aggregate: true });
      const rows = execute(q);
      const data = Object.fromEntries(Object.entries(spec).map(([key, value]) => [key, value.type === "count" ? rows.length : rows.reduce((sum, row) => sum + Number(row.data[value.field!] || 0), 0)]));
      return { data: () => data };
    },
  };
});
import { getHistoryPage, getHistorySummary } from "@/lib/firebase/history";
import { accountBalances, cardOutstanding, dashboardData, exportAllData, invoiceEntries, monthEntries, totalBalance } from "@/lib/firebase/finance-queries";

const filters: HistoryFilters = { month: "2026-10", kind: "", categoryId: "", accountId: "", startDate: "", endDate: "", search: "", sort: "date-desc" };
const entry = (patch: Partial<Entry>): Entry => ({ id: "e", kind: "expense", description: "Compra de mercado", amount: 100, date: "2026-10-10", dueDate: "", status: "settled", accountId: "a", toAccountId: "", categoryId: "food", cardId: "", invoiceMonth: "", groupId: "", installment: 0, installments: 0, notes: "", recurrenceId: "", createdAt: "2026-10-10T12:00:00.000Z", ...patch });
function seed(entries: Entry[], uid = "u") { for (const { id, ...data } of entries) state.documents.set(`users/${uid}/entries/${id}`, data); }
const accounts: Account[] = ["a", "b"].map((id, index) => ({ id, createdAt: "", archived: index === 1, name: id, type: "Conta corrente", initialBalance: 1000, color: "#000000" }));
const cards = [{ id: "card", name: "Cartão", dueDay: 15, closingDay: 5, archived: false, createdAt: "", limit: 100000, color: "#000000", revision: 1 }] as Card[];
const mixed = [
  entry({ id: "old-income", kind: "income", amount: 10000, date: "2025-01-01", categoryId: "salary" }),
  entry({ id: "income", kind: "income", amount: 5000, categoryId: "salary" }),
  entry({ id: "pending-income", kind: "income", amount: 2000, status: "pending", categoryId: "salary" }),
  entry({ id: "expense", amount: 500 }), entry({ id: "pending-expense", amount: 300, status: "pending", dueDate: "2026-10-15" }),
  entry({ id: "purchase", kind: "purchase", accountId: "", cardId: "card", invoiceMonth: "2026-10", date: "2026-09-20", amount: 700, status: "pending", dueDate: "2026-10-15" }),
  entry({ id: "future-purchase", kind: "purchase", accountId: "", cardId: "card", invoiceMonth: "2026-11", amount: 900, status: "pending", dueDate: "2026-11-15" }),
  entry({ id: "paid-purchase", kind: "purchase", accountId: "", cardId: "card", invoiceMonth: "2026-08", date: "2026-07-10", amount: 400, status: "pending", dueDate: "2026-08-15" }),
  entry({ id: "invoice_card_2026-08", kind: "invoicePayment", amount: 400, date: "2026-08-15", cardId: "card", invoiceMonth: "2026-08", categoryId: "" }),
  entry({ id: "transfer", kind: "transfer", amount: 200, toAccountId: "b", categoryId: "" }),
  entry({ id: "future-income", kind: "income", amount: 9999, date: "2027-01-01", accountId: "b", categoryId: "salary" }),
];
beforeEach(() => { state.documents.clear(); state.calls.length = 0; state.fail = false; });

describe("histórico por cursor e resumos completos", () => {
  it("percorre todas as páginas com datas e valores iguais sem repetir ou perder registros", async () => {
    const all = Array.from({ length: 77 }, (_, index) => entry({ id: `e${String(index).padStart(3, "0")}` })); seed(all);
    let cursor = null; const ids: string[] = [];
    do { const page = await getHistoryPage("u", filters, cursor); expect(page.entries.length).toBeLessThanOrEqual(25); ids.push(...page.entries.map(entry => entry.id)); cursor = page.next; } while (cursor);
    expect(ids).toEqual(all.map(entry => entry.id).reverse()); expect(new Set(ids).size).toBe(77);
    expect(state.calls.every(call => call.query.clauses.some(clause => clause.type === "limit" && Number(clause.value) <= 51))).toBe(true);
    expect(await getHistorySummary("u", filters)).toEqual({ count: 77, income: 0, expense: 7700 });
  });
  it("preserva competência, pendências e transferências nos totais", async () => {
    seed(mixed); seed([entry({ id: "other-user", amount: 999999 })], "other");
    const expected = mixed.filter(entry => (entry.kind === "purchase" ? entry.invoiceMonth : entry.date.slice(0, 7)) === "2026-10");
    expect(await getHistorySummary("u", filters)).toEqual({ count: expected.length, ...totals(expected) });
    const page = await getHistoryPage("u", filters);
    expect(page.entries.map(entry => entry.id)).toContain("purchase"); expect(page.entries.map(entry => entry.id)).not.toContain("future-purchase");
    const transfers = await getHistorySummary("u", { ...filters, accountId: "b", kind: "transfer" });
    expect(transfers).toEqual({ count: 1, income: 0, expense: 0 });
  });
  it("aplica categoria, conta e intervalo no servidor antes de paginar", async () => {
    seed(mixed);
    const selected = { ...filters, categoryId: "food", accountId: "a", startDate: "2026-10-01", endDate: "2026-10-31" };
    expect((await getHistoryPage("u", selected)).entries.map(entry => entry.id).sort()).toEqual(["expense", "pending-expense"]);
    expect(await getHistorySummary("u", selected)).toEqual({ count: 2, income: 0, expense: 500 });
    expect(state.calls.every(call => call.query.clauses.some(clause => clause.field === "categoryId" && clause.value === "food"))).toBe(true);
  });
  it("mantém a ordenação por valor com datas filtradas e cursores de documentos removidos", async () => {
    const all = Array.from({ length: 60 }, (_, index) => entry({ id: `e${index}`, amount: 100 + index, date: index === 59 ? "2026-09-01" : "2026-10-10" })); seed(all);
    const selected = { ...filters, sort: "amount-desc" as const, startDate: "2026-10-01" };
    const first = await getHistoryPage("u", selected);
    expect(first.entries[0].amount).toBe(158);
    state.documents.delete(`users/u/entries/${first.entries.at(-1)!.id}`);
    const next = await getHistoryPage("u", selected, first.next);
    expect(next.entries[0].amount).toBe(first.entries.at(-1)!.amount - 1);
  });
  it("encontra descrições em páginas posteriores e soma todos os resultados da busca", async () => {
    seed(Array.from({ length: 160 }, (_, index) => entry({ id: `e${String(index).padStart(3, "0")}`, description: index < 55 ? "Farmácia" : "Mercado", amount: 100 + index })));
    const selected = { ...filters, search: "farmÁcia" };
    const first = await getHistoryPage("u", selected);
    const next = await getHistoryPage("u", selected, first.next);
    const final = await getHistoryPage("u", selected, next.next);
    expect(first.entries).toHaveLength(25); expect(next.entries).toHaveLength(25); expect(final.entries).toHaveLength(5); expect(final.next).toBeNull();
    expect(await getHistorySummary("u", selected)).toEqual({ count: 55, income: 0, expense: Array.from({ length: 55 }, (_, i) => 100 + i).reduce((a, b) => a + b, 0) });
  });
  it("rejeita cursor de outro usuário/filtro e não esconde falhas como lista vazia", async () => {
    seed(Array.from({ length: 30 }, (_, i) => entry({ id: `e${i}` })));
    const page = await getHistoryPage("u", filters);
    await expect(getHistoryPage("other", filters, page.next)).rejects.toThrow(/filtros mudaram/);
    await expect(getHistoryPage("u", { ...filters, sort: "date-asc" }, page.next)).rejects.toThrow(/filtros mudaram/);
    await expect(getHistoryPage("u", filters, null, 0)).rejects.toThrow(/página inválido/);
    state.fail = true;
    await expect(getHistoryPage("u", filters)).rejects.toThrow(/indisponível/);
    await expect(getHistorySummary("u", filters)).rejects.toThrow(/indisponível/);
  });
  it("não inicia varreduras de uma busca que já foi cancelada", async () => {
    const controller = new AbortController(); controller.abort();
    const selected = { ...filters, search: "mercado" };
    await expect(getHistoryPage("u", selected, null, 25, controller.signal)).rejects.toThrow();
    await expect(getHistorySummary("u", selected, controller.signal)).rejects.toThrow();
    expect(state.calls).toHaveLength(0);
  });
});

describe("consultas específicas preservam os cálculos financeiros", () => {
  it("calcula saldos cumulativos incluindo histórico anterior, contas arquivadas e transferências", async () => {
    seed(mixed);
    const asOf = "2026-10-18";
    expect(await totalBalance("u", accounts, asOf)).toBe(accounts.reduce((sum, account) => sum + balance(account, mixed, asOf), 0));
    for (const account of accounts) expect(await totalBalance("u", accounts, asOf, account.id)).toBe(balance(account, mixed, asOf));
    const values = await accountBalances("u", accounts);
    expect(Object.keys(values).sort()).toEqual(["a", "b"]);
    expect(state.calls.every(call => call.aggregate)).toBe(true);
  });
  it("consulta mês/fatura e limite em aberto sem somar novamente pagamentos de fatura", async () => {
    seed(mixed);
    const monthly = await monthEntries("u", "2026-10");
    expect(totals(monthly)).toEqual(totals(mixed, "2026-10"));
    expect((await invoiceEntries("u", "card", "2026-08")).map(entry => entry.id).sort()).toEqual(["invoice_card_2026-08", "paid-purchase"]);
    expect(await cardOutstanding("u", cards)).toEqual({ card: 1600 });
  });
  it("mantém no dashboard saldos anteriores ao período e vencimentos de faturas não pagas", async () => {
    seed(mixed);
    const data = await dashboardData("u", accounts, cards, "2026-10");
    expect(data.evolution["2026-10"]).toBe(accounts.reduce((sum, account) => sum + balance(account, mixed, "2026-10-31"), 0));
    expect(data.entries.some(entry => entry.id === "old-income")).toBe(false);
    expect(data.upcoming.some(item => item.id === "card|2026-08")).toBe(false);
    expect(data.upcoming.find(item => item.id === "card|2026-10")?.amount).toBe(700);
    expect(data.recent[0].id).toBe("future-income");
    expect(totals(data.entries, "2026-10")).toEqual(totals(mixed, "2026-10"));
  });
  it("exporta o histórico completo em blocos, inclusive coleções fora da tela", async () => {
    seed(Array.from({ length: 405 }, (_, index) => entry({ id: `e${index}` })));
    state.documents.set("users/u/goalMovements/m", { amount: 100 }); state.documents.set("users/u/snapshots/s", { current: 100 });
    const data = await exportAllData("u");
    expect(data.entries).toHaveLength(405); expect(data.goalMovements).toHaveLength(1); expect(data.snapshots).toHaveLength(1);
    expect(state.calls.filter(call => call.query.path.endsWith("/entries"))).toHaveLength(3);
  });
});

describe("índices versionados", () => {
  it("inclui as combinações emitidas por filtros, ordenação, totais e consultas financeiras", async () => {
    seed(mixed);
    for (const month of ["", "2026-10"]) for (const kind of ["", "income", "purchase", "transfer"]) for (const categoryId of ["", "food"]) for (const accountId of ["", "a"]) for (const sort of ["date-asc", "date-desc", "amount-desc"] as const) {
      const selected = { ...filters, month, kind, categoryId, accountId, sort };
      await getHistoryPage("u", selected); await getHistorySummary("u", selected);
    }
    await dashboardData("u", accounts, cards, "2026-10"); await accountBalances("u", accounts); await cardOutstanding("u", cards); await invoiceEntries("u", "card", "2026-10");
    const indexes = JSON.parse(readFileSync("firestore.indexes.json", "utf8")).indexes as { fields: { fieldPath: string; order: string }[] }[];
    for (const { query: q, aggregate } of state.calls) {
      const equality = [...new Set(q.clauses.filter(clause => clause.type === "where" && ["==", "in"].includes(clause.op!)).map(clause => clause.field!))];
      let orders = q.clauses.filter(clause => clause.type === "order" && clause.field !== "__name__").map(clause => ({ fieldPath: clause.field!, order: clause.direction === "desc" ? "DESCENDING" : "ASCENDING" }));
      if (!orders.length) orders = [...new Set(q.clauses.filter(clause => clause.type === "where" && !["==", "in"].includes(clause.op!)).map(clause => clause.field!))].map(fieldPath => ({ fieldPath, order: "ASCENDING" }));
      if (aggregate && !orders.some(field => field.fieldPath === "amount")) orders.push({ fieldPath: "amount", order: "ASCENDING" });
      if (equality.length + orders.length < 2) continue;
      const supported = indexes.some(index => index.fields.length === equality.length + orders.length && index.fields.slice(0, equality.length).every(field => equality.includes(field.fieldPath)) && JSON.stringify(index.fields.slice(equality.length)) === JSON.stringify(orders));
      expect(supported, JSON.stringify({ equality, orders })).toBe(true);
    }
  });
});
