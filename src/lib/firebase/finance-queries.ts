import { collection, documentId, getAggregateFromServer, getDocs, limit, orderBy, query, startAfter, sum, where, type QueryConstraint } from "firebase/firestore";
import { firebase } from "./client";
import { entriesCollection, entryFromDoc } from "./history";
import { collections, type Account, type Card, type FinanceData } from "../domain/types";
import { monthDate, shiftMonth, today } from "../domain/finance";
import { unpaidMonthRanges } from "../domain/history";

export async function sumEntries(uid: string, filters: QueryConstraint[]) {
  return (await getAggregateFromServer(query(entriesCollection(uid), ...filters), { total: sum("amount") })).data().total;
}

export async function totalBalance(uid: string, accounts: Account[], asOf: string, accountId?: string) {
  const common = [where("status", "==", "settled"), where("date", "<=", asOf)];
  if (accountId) common.push(where("accountId", "==", accountId));
  const [income, expense, invoices, sent, received] = await Promise.all([
    sumEntries(uid, [...common, where("kind", "==", "income")]),
    sumEntries(uid, [...common, where("kind", "==", "expense")]),
    sumEntries(uid, [...common, where("kind", "==", "invoicePayment")]),
    accountId ? sumEntries(uid, [...common, where("kind", "==", "transfer")]) : 0,
    accountId ? sumEntries(uid, [where("status", "==", "settled"), where("kind", "==", "transfer"), where("toAccountId", "==", accountId), where("date", "<=", asOf)]) : 0,
  ]);
  const initial = accounts.filter(account => !accountId || account.id === accountId).reduce((sum, account) => sum + account.initialBalance, 0);
  return initial + income - expense - invoices - sent + received;
}

export async function accountBalances(uid: string, accounts: Account[]) {
  const values = await Promise.all(accounts.map(async account => [account.id, await totalBalance(uid, accounts, today(), account.id)] as const));
  return Object.fromEntries(values);
}

export async function monthEntries(uid: string, month: string) {
  const [cash, purchases] = await Promise.all([
    getDocs(query(entriesCollection(uid), where("kind", "in", ["income", "expense", "transfer", "invoicePayment"]), where("date", ">=", `${month}-01`), where("date", "<=", monthDate(month, 31)))),
    getDocs(query(entriesCollection(uid), where("kind", "==", "purchase"), where("invoiceMonth", "==", month))),
  ]);
  return [...cash.docs, ...purchases.docs].map(entryFromDoc);
}

export async function invoiceEntries(uid: string, cardId: string, month: string) {
  return (await getDocs(query(entriesCollection(uid), where("cardId", "==", cardId), where("invoiceMonth", "==", month)))).docs.map(entryFromDoc);
}

export async function cardOutstanding(uid: string, cards: Card[]) {
  return Object.fromEntries(await Promise.all(cards.map(async card => {
    const base = [where("cardId", "==", card.id)];
    const [purchases, payments] = await Promise.all([
      sumEntries(uid, [...base, where("kind", "==", "purchase")]),
      sumEntries(uid, [...base, where("kind", "==", "invoicePayment")]),
    ]);
    return [card.id, purchases - payments];
  })));
}

export interface Upcoming { id: string; description: string; amount: number; date: string; card: boolean; }
async function openCardInvoices(uid: string, card: Card): Promise<Upcoming[]> {
  const paid = await getDocs(query(entriesCollection(uid), where("kind", "==", "invoicePayment"), where("cardId", "==", card.id)));
  const ranges = unpaidMonthRanges(paid.docs.map(doc => String(doc.data().invoiceMonth)));
  const invoices: Upcoming[] = [];
  for (const range of ranges) {
    let from = range.start;
    while (invoices.length < 4 && from < range.end) {
      const snapshot = await getDocs(query(entriesCollection(uid), where("kind", "==", "purchase"), where("cardId", "==", card.id), where("invoiceMonth", ">=", from), where("invoiceMonth", "<", range.end), orderBy("invoiceMonth"), limit(1)));
      if (snapshot.empty) break;
      const purchase = entryFromDoc(snapshot.docs[0]);
      const amount = await sumEntries(uid, [where("kind", "==", "purchase"), where("cardId", "==", card.id), where("invoiceMonth", "==", purchase.invoiceMonth)]);
      invoices.push({ id: `${card.id}|${purchase.invoiceMonth}`, description: `Fatura ${card.name}`, amount, date: purchase.dueDate, card: true });
      from = shiftMonth(purchase.invoiceMonth, 1);
    }
    if (invoices.length === 4) break;
  }
  return invoices;
}

export async function dashboardData(uid: string, accounts: Account[], cards: Card[], month: string) {
  const first = shiftMonth(month, -5);
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5));
  const [cash, purchases, recent, pending, invoices, currentBalance, evolution] = await Promise.all([
    getDocs(query(entriesCollection(uid), where("kind", "in", ["income", "expense", "transfer", "invoicePayment"]), where("date", ">=", `${first}-01`), where("date", "<=", monthDate(month, 31)))),
    getDocs(query(entriesCollection(uid), where("kind", "==", "purchase"), where("invoiceMonth", ">=", first), where("invoiceMonth", "<=", month))),
    getDocs(query(entriesCollection(uid), orderBy("date", "desc"), orderBy("createdAt", "desc"), limit(5))),
    getDocs(query(entriesCollection(uid), where("kind", "==", "expense"), where("status", "==", "pending"))),
    Promise.all(cards.map(card => openCardInvoices(uid, card))),
    totalBalance(uid, accounts, today()),
    Promise.all(months.map(async period => [period, await totalBalance(uid, accounts, monthDate(period, 31))] as const)),
  ]);
  const entries = [...new Map([...cash.docs, ...purchases.docs].map(doc => [doc.id, entryFromDoc(doc)])).values()];
  const upcoming = [...pending.docs.map(doc => { const entry = entryFromDoc(doc); return { id: entry.id, description: entry.description, amount: entry.amount, date: entry.dueDate || entry.date, card: false }; }), ...invoices.flat()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  return { entries, recent: recent.docs.map(entryFromDoc), upcoming, totalBalance: currentBalance, evolution: Object.fromEntries(evolution) };
}
export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;

export async function featureHistory(uid: string, key: "goalMovements" | "snapshots") {
  return (await getDocs(collection(firebase().db, "users", uid, key))).docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

export async function exportAllData(uid: string): Promise<FinanceData> {
  const result = {} as FinanceData;
  for (const key of collections) {
    const records: unknown[] = [];
    let cursor: string | null = null;
    while (true) {
      const parts: QueryConstraint[] = [orderBy(documentId()), limit(200)];
      if (cursor) parts.push(startAfter(cursor));
      const snapshot = await getDocs(query(collection(firebase().db, "users", uid, key), ...parts));
      records.push(...snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      if (snapshot.size < 200) break;
      cursor = snapshot.docs.at(-1)!.id;
    }
    Object.assign(result, { [key]: records });
  }
  return result;
}
