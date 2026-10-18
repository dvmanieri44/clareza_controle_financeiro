import { date, month as monthSchema } from "./schemas";
import { monthDate } from "./finance";
import type { Entry, EntryKind } from "./types";

export type HistorySort = "date-desc" | "date-asc" | "amount-desc";
export interface HistoryFilters {
  month: string; kind: string; categoryId: string; accountId: string;
  startDate: string; endDate: string; search: string; sort: HistorySort;
}
export const entryKinds: EntryKind[] = ["income", "expense", "transfer", "purchase", "invoicePayment"];
export interface HistoryBranch {
  kind: EntryKind; categoryId?: string; accountField?: "accountId" | "toAccountId";
  accountId?: string; invoiceMonth?: string; startDate?: string; endDate?: string;
}
export interface EntryCursor { id: string; date: string; amount: number; }
export interface HistoryCursor extends EntryCursor { uid: string; filterKey: string; }
export const historyKey = (filters: HistoryFilters) => JSON.stringify(filters);

export function historyBranches(filters: HistoryFilters): HistoryBranch[] {
  if (filters.month) monthSchema.parse(filters.month);
  if (filters.startDate) date.parse(filters.startDate);
  if (filters.endDate) date.parse(filters.endDate);
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error("A data inicial deve ser anterior ou igual à final.");
  if (filters.kind && !entryKinds.includes(filters.kind as EntryKind)) throw new Error("Tipo de transação inválido.");
  if (!["date-desc", "date-asc", "amount-desc"].includes(filters.sort)) throw new Error("Ordenação inválida.");
  return entryKinds.filter(kind => (!filters.kind || kind === filters.kind)
    && (!filters.categoryId || kind !== "transfer" && kind !== "invoicePayment")
    && (!filters.accountId || kind !== "purchase")).flatMap(kind => {
    let startDate = filters.startDate, endDate = filters.endDate;
    if (filters.month && kind !== "purchase") {
      startDate = [startDate, `${filters.month}-01`].sort().at(-1)!;
      endDate = endDate ? [endDate, monthDate(filters.month, 31)].sort()[0] : monthDate(filters.month, 31);
    }
    if (startDate && endDate && startDate > endDate) return [];
    const base: HistoryBranch = { kind, categoryId: filters.categoryId || undefined, invoiceMonth: kind === "purchase" ? filters.month || undefined : undefined, startDate: startDate || undefined, endDate: endDate || undefined };
    if (!filters.accountId) return [base];
    return (kind === "transfer" ? ["accountId", "toAccountId"] : ["accountId"]).map(accountField => ({ ...base, accountField: accountField as "accountId" | "toAccountId", accountId: filters.accountId }));
  });
}

export function compareEntries(a: EntryCursor, b: EntryCursor, sort: HistorySort): number {
  const id = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const day = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  return sort === "date-asc" ? day || id : sort === "amount-desc" ? b.amount - a.amount || -day || -id : -day || -id;
}
export function matchesDescription(entry: Pick<Entry, "description">, search: string) {
  return entry.description.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"));
}

/** Meses pagos formam intervalos excluídos; a consulta lê somente faturas ainda abertas. */
export function unpaidMonthRanges(paidMonths: string[]) {
  let start = "1900-01";
  const ranges: { start: string; end: string }[] = [];
  for (const paid of [...new Set(paidMonths)].sort()) {
    monthSchema.parse(paid);
    if (start < paid) ranges.push({ start, end: paid });
    const [year, month] = paid.split("-").map(Number);
    start = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  }
  if (start < "2200-01") ranges.push({ start, end: "2200-01" });
  return ranges;
}
