import { collection, count, documentId, getAggregateFromServer, getDocs, limit, orderBy, query, startAfter, sum, where, type QueryConstraint } from "firebase/firestore";
import { firebase } from "./client";
import { compareEntries, historyBranches, historyKey, matchesDescription, type EntryCursor, type HistoryBranch, type HistoryCursor, type HistoryFilters } from "../domain/history";
import { totals } from "../domain/finance";
import type { Entry } from "../domain/types";

export const HISTORY_PAGE_SIZE = 25;
export const entriesCollection = (uid: string) => collection(firebase().db, "users", uid, "entries");
export const entryFromDoc = (doc: { id: string; data: () => unknown }): Entry => ({ ...(doc.data() as Omit<Entry, "id">), id: doc.id });

function constraints(branch: HistoryBranch, sort: HistoryFilters["sort"], settled = false, ordered = true): QueryConstraint[] {
  const filters: QueryConstraint[] = [where("kind", "==", branch.kind)];
  if (branch.invoiceMonth) filters.push(where("invoiceMonth", "==", branch.invoiceMonth));
  if (branch.categoryId) filters.push(where("categoryId", "==", branch.categoryId));
  if (branch.accountField) filters.push(where(branch.accountField, "==", branch.accountId));
  if (settled) filters.push(where("status", "==", "settled"));
  if (branch.startDate) filters.push(where("date", ">=", branch.startDate));
  if (branch.endDate) filters.push(where("date", "<=", branch.endDate));
  if (!ordered) return filters;
  if (sort === "amount-desc") {
    // Torna amount o primeiro campo de desigualdade para ordenar também com intervalo de datas.
    filters.push(where("amount", ">=", 1), orderBy("amount", "desc"), orderBy("date", "desc"));
  } else filters.push(orderBy("date", sort === "date-asc" ? "asc" : "desc"));
  filters.push(orderBy(documentId(), sort === "date-asc" ? "asc" : "desc"));
  return filters;
}

async function rawPage(uid: string, filters: HistoryFilters, cursor: EntryCursor | null, size: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const branches = historyBranches(filters);
  const snapshots = await Promise.all(branches.map(branch => {
    const parts = constraints(branch, filters.sort);
    if (cursor) parts.push(filters.sort === "amount-desc" ? startAfter(cursor.amount, cursor.date, cursor.id) : startAfter(cursor.date, cursor.id));
    return getDocs(query(entriesCollection(uid), ...parts, limit(size + 1)));
  }));
  signal?.throwIfAborted();
  const entries = [...new Map(snapshots.flatMap(snapshot => snapshot.docs.map(entryFromDoc)).map(entry => [entry.id, entry])).values()].sort((a, b) => compareEntries(a, b, filters.sort));
  return { entries: entries.slice(0, size), more: entries.length > size };
}

export async function getHistoryPage(uid: string, filters: HistoryFilters, cursor: HistoryCursor | null = null, size = HISTORY_PAGE_SIZE, signal?: AbortSignal) {
  if (!Number.isInteger(size) || size < 1 || size > 200) throw new Error("Tamanho de página inválido.");
  const filterKey = historyKey(filters);
  if (cursor && (cursor.uid !== uid || cursor.filterKey !== filterKey)) throw new Error("Os filtros mudaram. Volte à primeira página.");
  const matches: Entry[] = [];
  let after: EntryCursor | null = cursor;
  while (matches.length <= size) {
    const page = await rawPage(uid, filters, after, filters.search.trim() ? 50 : size + 1, signal);
    for (const entry of page.entries) {
      after = entry;
      if (matchesDescription(entry, filters.search)) matches.push(entry);
      if (matches.length > size) break;
    }
    if (matches.length > size || !page.more || !page.entries.length) break;
  }
  const entries = matches.slice(0, size);
  const last = entries.at(-1);
  return { entries, next: matches.length > size && last ? { uid, filterKey, id: last.id, date: last.date, amount: last.amount } satisfies HistoryCursor : null };
}

export async function getHistorySummary(uid: string, filters: HistoryFilters, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (filters.search.trim()) {
    // Firestore não oferece busca por substring. Percorre o período em blocos sem guardar o histórico completo.
    let after: EntryCursor | null = null;
    const summary = { count: 0, income: 0, expense: 0 };
    while (true) {
      const page = await rawPage(uid, filters, after, 200, signal);
      const matches = page.entries.filter(entry => matchesDescription(entry, filters.search));
      const amount = totals(matches);
      summary.count += matches.length; summary.income += amount.income; summary.expense += amount.expense;
      if (!page.more || !page.entries.length) return summary;
      after = page.entries.at(-1)!;
    }
  }
  const summaries = await Promise.all(historyBranches(filters).map(async branch => {
    const base = await getAggregateFromServer(query(entriesCollection(uid), ...constraints(branch, filters.sort, false, false)), { count: count(), total: sum("amount") });
    let amount = base.data().total;
    if (branch.kind === "income" || branch.kind === "expense") {
      amount = (await getAggregateFromServer(query(entriesCollection(uid), ...constraints(branch, filters.sort, true, false)), { total: sum("amount") })).data().total;
    }
    return { count: base.data().count, income: branch.kind === "income" ? amount : 0, expense: branch.kind === "expense" || branch.kind === "purchase" ? amount : 0 };
  }));
  return summaries.reduce((total, item) => ({ count: total.count + item.count, income: total.income + item.income, expense: total.expense + item.expense }), { count: 0, income: 0, expense: 0 });
}
