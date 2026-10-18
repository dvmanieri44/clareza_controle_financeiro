"use client";
import type { FormConfig } from "@/components/form-dialog";
import { moneyInput, parseMoney } from "@/lib/domain/finance";
import { accountTypes, type Account } from "@/lib/domain/types";
import * as repo from "@/lib/firebase/repository";
import { text, select, useFinanceOptions } from "@/features/finance/shared";
export function useAccountForm(setForm: (config: FormConfig) => void) {
  const { uid } = useFinanceOptions();
  function openAccount(account?: Account) { setForm({ title: account ? "Editar conta" : "Nova conta", fields: [text("name", "Nome da conta"), select("type", "Tipo de conta", accountTypes.map(t => ({ value: t, label: t }))), text("initialBalance", "Saldo inicial (R$)", { type: "signedMoney", disabled: !!account, help: "Incluído desde o início do histórico. Após salvar, ajuste o saldo com receitas ou despesas." }), text("color", "Cor", { type: "color" })], defaults: account ? { ...account, initialBalance: moneyInput(account.initialBalance), archived: String(account.archived) } : { initialBalance: "0,00", type: "Conta corrente" }, submit: v => repo.saveAccount(uid, { name: v.name, type: v.type as typeof accountTypes[number], initialBalance: parseMoney(v.initialBalance), color: v.color }, account?.id) }); }
  return openAccount;
}
