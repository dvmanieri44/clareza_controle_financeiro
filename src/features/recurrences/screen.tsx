"use client";
import { useState } from "react";
import { Plus, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { Empty, Panel } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { money, parseMoney, shortDate, today } from "@/lib/domain/finance";
import * as repo from "@/lib/firebase/repository";
import { text, select, CategoryIcon, Actions, FeatureHeading, useFinanceOptions, useFeatureDialogs, ArchiveToggle } from "@/features/finance/shared";

export function RecurrencesScreen() {
  const { uid, data, activeAccounts, accountOptions, categoryOptions, needAccount } = useFinanceOptions();
  const { setForm, confirmArchive, dialogs } = useFeatureDialogs(uid);
  const [showArchived, setShowArchived] = useState(false);
  function openRecurrence() { if (!needAccount()) return; setForm({ title: "Nova recorrência mensal", description: "O dia é repetido a cada mês, ajustado ao último dia quando necessário. As ocorrências são criadas como pendentes.", fields: [text("description", "Descrição"), text("amount", "Valor (R$)", { type: "money" }), select("kind", "Tipo", [{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }]), select("accountId", "Conta", accountOptions), select("categoryId", "Categoria", categoryOptions()), text("startDate", "Primeiro vencimento", { type: "date" }), text("endDate", "Último vencimento", { type: "date", required: false }), text("notes", "Observações", { type: "textarea", required: false })], defaults: { startDate: today(), kind: "expense", accountId: activeAccounts[0]?.id }, submit: v => repo.saveRecurrence(uid, { description: v.description, amount: parseMoney(v.amount), kind: v.kind as "income" | "expense", accountId: v.accountId, categoryId: v.categoryId, startDate: v.startDate, endDate: v.endDate, notes: v.notes }) }); }
  function openGenerate() { setForm({ title: "Gerar lançamentos", description: "Cria as ocorrências até a data escolhida. Registros existentes são preservados, mesmo se você executar novamente.", fields: [text("through", "Gerar até", { type: "date" })], defaults: { through: today() }, submitLabel: "Gerar", submit: async v => { const count = await repo.generateRecurrences(uid, data.recurrences, v.through); toast.info(`${count} ocorrência(s) criada(s).`); } }); }
  const archivedToggle = <ArchiveToggle checked={showArchived} onChange={setShowArchived} items={data.recurrences} />;
  const primary: [string, () => void] = ["Nova recorrência", openRecurrence];
  return <><FeatureHeading section="recorrencias" action={<Button onClick={primary[1]}><Plus />{primary[0]}</Button>} /><><div className="section-tools">{archivedToggle}<Button variant="outline" onClick={openGenerate}><Repeat2 aria-hidden="true" />Gerar lançamentos</Button></div><Panel>{data.recurrences.filter(r => showArchived || !r.archived).length ? <div className="divide-y divide-border">{data.recurrences.filter(r => showArchived || !r.archived).map(r => <div className="transaction-row" key={r.id}><CategoryIcon category={data.categories.find(c => c.id === r.categoryId)} /><div className="flex-1"><h2 className="text-sm font-medium">{r.description}</h2><p className="table-secondary">Mensal · dia {Number(r.startDate.slice(8))} · {data.accounts.find(a => a.id === r.accountId)?.name}{r.archived && " · Pausada"}</p><p className="table-secondary">De {shortDate(r.startDate)}{r.endDate ? ` até ${shortDate(r.endDate)}` : " · sem prazo"}</p></div><strong className="text-sm">{money(r.amount)}</strong><Actions label={r.description} remove={!r.archived ? () => confirmArchive("recurrences", r.id, false) : undefined} restore={r.archived ? () => confirmArchive("recurrences", r.id, true) : undefined} /></div>)}</div> : <Empty title="Adicione uma conta recorrente" description="Cadastre uma receita ou despesa que se repete todo mês." action={<Button onClick={openRecurrence}>Adicionar recorrência</Button>} />}</Panel></>{dialogs}</>;
}
