"use client";
import type { FormConfig } from "@/components/form-dialog";
import { moneyInput, parseMoney, today } from "@/lib/domain/finance";
import { type Entry } from "@/lib/domain/types";
import * as repo from "@/lib/firebase/repository";
import { text, select, useFinanceOptions } from "@/features/finance/shared";
export function useEntryForm(setForm: (config: FormConfig) => void) {
  const { uid, activeAccounts, accountOptions, categoryOptions, needAccount } = useFinanceOptions();
  function openEntry(entry?: Entry) {
    if (!needAccount()) return;
    setForm({ title: entry ? "Editar transação" : "Nova transação", fields: [text("description", "Descrição"), text("amount", "Valor (R$)", { type: "money" }), select("kind", "Tipo", [{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }]), select("categoryId", "Categoria", categoryOptions()), select("accountId", "Conta", accountOptions), text("date", "Data da transação", { type: "date" }), text("dueDate", "Vencimento", { type: "date", required: false }), select("status", "Situação", [{ value: "pending", label: "Pendente" }, { value: "settled", label: "Pago / recebido" }]), text("notes", "Observações", { type: "textarea", required: false })], defaults: entry ? { ...entry, amount: moneyInput(entry.amount), installment: String(entry.installment), installments: String(entry.installments) } : { date: today(), kind: "expense", status: "settled", accountId: activeAccounts[0]?.id || "" }, submit: async v => { await repo.saveEntry(uid, { description: v.description, amount: parseMoney(v.amount), kind: v.kind as "income" | "expense", categoryId: v.categoryId, accountId: v.accountId, date: v.date, dueDate: v.dueDate, status: v.status as "pending" | "settled", notes: v.notes }, entry?.id); } });
  }
  return openEntry;
}
