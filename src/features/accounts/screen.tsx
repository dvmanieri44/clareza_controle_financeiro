"use client";
import { useAccountForm } from "@/features/accounts/use-account-form";
import { useState } from "react";
import { ArrowLeftRight, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge, Empty, Panel } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { balance, money, parseMoney, today } from "@/lib/domain/finance";

import * as repo from "@/lib/firebase/repository";
import { text, select, Actions, FeatureHeading, useFinanceOptions, useFeatureDialogs, ArchiveToggle } from "@/features/finance/shared";

export function AccountsScreen() {
  const { uid, data, activeAccounts, accountOptions, needAccount } = useFinanceOptions();
  const { setForm, confirmArchive, dialogs } = useFeatureDialogs(uid);
  const [showArchived, setShowArchived] = useState(false);
  const openAccount = useAccountForm(setForm);
  function openTransfer() { if (!needAccount()) return; if (activeAccounts.length < 2) { toast.info("Cadastre pelo menos duas contas para transferir."); return; } setForm({ title: "Transferir entre contas", description: "A transferência altera os saldos das contas sem gerar receita ou despesa.", fields: [select("fromId", "Conta de origem", accountOptions), select("toId", "Conta de destino", accountOptions), text("amount", "Valor (R$)", { type: "money" }), text("date", "Data", { type: "date" })], defaults: { date: today() }, submit: v => repo.transfer(uid, v.fromId, v.toId, parseMoney(v.amount), v.date) }); }
  const archivedToggle = <ArchiveToggle checked={showArchived} onChange={setShowArchived} items={data.accounts} />;
  const primary: [string, () => void] = ["Nova conta", () => openAccount()];
  return <><FeatureHeading section="contas" action={<Button onClick={primary[1]}><Plus />{primary[0]}</Button>} /><><div className="section-tools">{archivedToggle}<Button variant="outline" onClick={openTransfer}><ArrowLeftRight />Transferir</Button></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.accounts.filter(a => showArchived || !a.archived).map(a => <Panel key={a.id}><div className="flex items-start justify-between"><span className="account-symbol" style={{ color: a.color, background: `${a.color}18` }}><Wallet /></span><Actions label={a.name} edit={!a.archived ? () => openAccount(a) : undefined} remove={!a.archived ? () => confirmArchive("accounts", a.id, false) : undefined} restore={a.archived ? () => confirmArchive("accounts", a.id, true) : undefined} /></div><h2 className="mt-5 font-semibold">{a.name} {a.archived && <Badge>Arquivada</Badge>}</h2><p className="mt-1 text-xs text-muted-foreground">{a.type}</p><p className="my-5 text-3xl font-semibold tracking-tight">{money(balance(a, data.entries, today()))}</p><div className="flex justify-between border-t border-border pt-4 text-xs text-muted-foreground"><span>Saldo inicial</span><span>{money(a.initialBalance)}</span></div></Panel>)}</div>{!data.accounts.length && <Panel><Empty title="Adicione sua primeira conta" description="Informe onde você guarda seu dinheiro." action={<Button onClick={() => openAccount()}><Plus />Adicionar conta</Button>} /></Panel>}</>{dialogs}</>;
}
