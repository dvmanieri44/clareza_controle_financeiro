import { addMonths, format, getDaysInMonth, parseISO } from "date-fns";
import type { Account, Budget, Card, Entry, Recurrence } from "./types";

export const MAX_MONEY = 9_000_000_000_000;
export function money(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100); }
export function parseMoney(input: string): number {
  const clean = input.trim().replace(/R\$\s?/, "").replace(/\s/g, "");
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(clean)) throw new Error("Informe um valor como 1.234,56.");
  const [whole, fraction = ""] = clean.replace(/\./g, "").split(",");
  const sign = whole.startsWith("-") ? -1 : 1;
  const cents = sign * (Number(whole.replace("-", "")) * 100 + Number(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_MONEY) throw new Error("Valor fora do limite permitido.");
  return cents;
}
export function moneyInput(value: number) { return (value / 100).toFixed(2).replace(".", ","); }
export function today() { return format(new Date(), "yyyy-MM-dd"); }
export function monthOf(date = today()) { return date.slice(0, 7); }
export function shortDate(date: string) { return date ? format(parseISO(date), "dd/MM/yyyy") : "—"; }
export function monthLabel(month: string) { return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(parseISO(`${month}-15`)); }
export function shiftMonth(month: string, amount: number) { return format(addMonths(parseISO(`${month}-01`), amount), "yyyy-MM"); }
export function monthDate(month: string, day: number) { const d = parseISO(`${month}-01`); return `${month}-${String(Math.min(day, getDaysInMonth(d))).padStart(2, "0")}`; }
export function balance(account: Account, entries: Entry[], asOf = "9999-12-31") {
  return entries.filter(e => e.status === "settled" && e.date <= asOf).reduce((sum, e) => {
    if (e.kind === "purchase") return sum;
    if (e.kind === "transfer") return sum + (e.toAccountId === account.id ? e.amount : 0) - (e.accountId === account.id ? e.amount : 0);
    if (e.accountId !== account.id) return sum;
    return sum + (e.kind === "income" ? e.amount : -e.amount);
  }, account.initialBalance);
}
export function totals(entries: Entry[], month?: string) {
  return entries.reduce((acc, e) => {
    const period = e.kind === "purchase" ? e.invoiceMonth : monthOf(e.date);
    if (month && period !== month) return acc;
    if (e.kind === "income" && e.status === "settled") acc.income += e.amount;
    if ((e.kind === "expense" && e.status === "settled") || e.kind === "purchase") acc.expense += e.amount;
    return acc;
  }, { income: 0, expense: 0 });
}
export function expenseByCategory(entries: Entry[], month: string) {
  const result: Record<string, number> = {};
  for (const e of entries) if ((e.kind === "expense" && e.status === "settled" && monthOf(e.date) === month) || (e.kind === "purchase" && e.invoiceMonth === month)) result[e.categoryId] = (result[e.categoryId] || 0) + e.amount;
  return result;
}
export function budgetProgress(budget: Budget, entries: Entry[]) { const used = expenseByCategory(entries, budget.month)[budget.categoryId] || 0; return { used, percent: budget.amount ? Math.round(used / budget.amount * 100) : 0 }; }
export function splitInstallments(amount: number, count: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isInteger(count) || count < 1 || count > 60 || amount < count) throw new Error("Parcelamento inválido (1 a 60 parcelas, mínimo de R$ 0,01 cada).");
  return Array.from({ length: count }, (_, i) => Math.floor(amount / count) + (i < amount % count ? 1 : 0));
}
// A competência é o mês do vencimento. No dia do fechamento a compra entra na próxima fatura.
export function firstInvoiceMonth(date: string, card: Pick<Card, "closingDay" | "dueDay">) {
  const purchaseMonth = monthOf(date);
  const actualClosing = monthDate(purchaseMonth, card.closingDay);
  const closeMonth = date >= actualClosing ? shiftMonth(purchaseMonth, 1) : purchaseMonth;
  return card.dueDay <= card.closingDay ? shiftMonth(closeMonth, 1) : closeMonth;
}
export function invoiceTotal(entries: Entry[], cardId: string, month: string) { return entries.filter(e => e.kind === "purchase" && e.cardId === cardId && e.invoiceMonth === month).reduce((sum, e) => sum + e.amount, 0); }
export function paymentId(cardId: string, month: string) { return `invoice_${cardId}_${month}`; }
export function recurrenceOccurrences(rule: Recurrence, through: string) {
  if (rule.archived) return [];
  const output: { id: string; date: string }[] = [];
  const last = rule.endDate && rule.endDate < through ? rule.endDate : through;
  for (let month = monthOf(rule.startDate); month <= monthOf(last); month = shiftMonth(month, 1)) {
    if (output.length >= 120) throw new Error("Gere no máximo 120 ocorrências por recorrência.");
    const date = monthDate(month, Number(rule.startDate.slice(8, 10)));
    if (date >= rule.startDate && date <= last) output.push({ id: `rec_${rule.id}_${month}`, date });
  }
  return output;
}
export function investmentReturn(invested: number, current: number) { return { nominal: current - invested, percent: invested > 0 ? (current - invested) / invested * 100 : 0 }; }
export function goalAfterMovement(current: number, amount: number) { const result = current + amount; if (!Number.isSafeInteger(result) || result < 0 || result > MAX_MONEY) throw new Error("O saldo da meta ficaria inválido."); return result; }
