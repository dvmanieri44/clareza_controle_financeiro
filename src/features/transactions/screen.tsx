"use client";
import { useEntryForm } from "@/features/transactions/use-entry-form";
import { useState } from "react";
import { InfoButton } from "@/components/info-button";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, Plus } from "lucide-react";

import { Badge, Empty, Metric, Panel } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { money, monthOf, shortDate, totals } from "@/lib/domain/finance";

import * as repo from "@/lib/firebase/repository";
import { CategoryIcon, Actions, FeatureHeading, useFinanceOptions, useFeatureDialogs } from "@/features/finance/shared";

export function TransactionsScreen() {
  const { uid, data } = useFinanceOptions();
  const { setForm, setConfirmation, dialogs } = useFeatureDialogs(uid);
  const [month, setMonth] = useState(monthOf());
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [sort, setSort] = useState("date-desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const openEntry = useEntryForm(setForm);

  const filteredEntries = data.entries.filter(e => (!month || (e.kind === "purchase" ? e.invoiceMonth : monthOf(e.date)) === month) && (!query || e.description.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) && (!typeFilter || e.kind === typeFilter) && (!categoryFilter || e.categoryId === categoryFilter) && (!accountFilter || e.accountId === accountFilter || e.toAccountId === accountFilter) && (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate)).sort((a, b) => sort === "amount-desc" ? b.amount - a.amount : sort === "date-asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  const filteredTotals = totals(filteredEntries);
  const primary: [string, () => void] = ["Nova transação", () => openEntry()];
  return <><FeatureHeading section="transacoes" month={month} setMonth={setMonth} action={<Button onClick={primary[1]}><Plus />{primary[0]}</Button>} /><><div className="mb-6 grid gap-4 sm:grid-cols-3"><Metric label="Receitas filtradas" value={filteredTotals.income} hint="Recebidas no período" icon={<ArrowDownLeft />} /><Metric label="Despesas filtradas" value={filteredTotals.expense} hint="Pagas + compras no cartão" icon={<ArrowUpRight />} /><Metric label="Resultado filtrado" value={filteredTotals.income - filteredTotals.expense} hint="Transferências não entram no resultado" icon={<ArrowLeftRight />} /></div><Panel><label className="field-label mb-4">Buscar transação<input className="input" placeholder="Descrição da transação" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <details className="mb-5"><summary className="cursor-pointer text-primary">Filtros e ordenação{[typeFilter, categoryFilter, accountFilter, startDate, endDate].filter(Boolean).length > 0 && <span className="ml-2"><Badge>{[typeFilter, categoryFilter, accountFilter, startDate, endDate].filter(Boolean).length} ativos</Badge></span>}</summary>
      <div className="filters mt-3">
        <label className="field-label">Tipo<select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">Todos os tipos</option><option value="income">Receitas</option><option value="expense">Despesas</option><option value="transfer">Transferências</option><option value="purchase">Compras no cartão</option><option value="invoicePayment">Pagamentos de fatura</option></select></label>
        <label className="field-label">Categoria<select className="input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="">Todas as categorias</option>{data.categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
        <label className="field-label">Conta<select className="input" value={accountFilter} onChange={e => setAccountFilter(e.target.value)}><option value="">Todas as contas</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="field-label">Ordenação<select className="input" value={sort} onChange={e => setSort(e.target.value)}><option value="date-desc">Mais recentes</option><option value="date-asc">Mais antigas</option><option value="amount-desc">Maior valor</option></select></label>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="field-label">Data inicial<input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label className="field-label">Data final<input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={!month} onChange={e => setMonth(e.target.checked ? "" : monthOf())} />Ver todos os meses</label>
        <Button variant="ghost" onClick={() => { setQuery(""); setTypeFilter(""); setCategoryFilter(""); setAccountFilter(""); setStartDate(""); setEndDate(""); setSort("date-desc"); }}>Limpar filtros</Button>
      </div></details><p role="status" className="sr-only">{filteredEntries.length} transações encontradas.</p>{filteredEntries.length ? <div className="table-scroll" role="region" aria-label="Transações filtradas" tabIndex={0}><table><caption className="sr-only">Transações conforme os filtros selecionados</caption><thead><tr><th scope="col">Descrição / categoria</th><th scope="col">Conta / cartão</th><th scope="col">Data / vencimento</th><th scope="col">Situação</th><th scope="col" className="text-right">Valor</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>{filteredEntries.map(e => <tr key={e.id}><td><div className="flex items-center gap-3"><CategoryIcon category={data.categories.find(c => c.id === e.categoryId)} /><div><p className="font-medium">{e.description}</p><p className="table-secondary">{data.categories.find(c => c.id === e.categoryId)?.name || (e.kind === "transfer" ? "Transferência" : "Pagamento de fatura")}{!e.groupId.startsWith("nu_") && e.installments > 0 && ` · ${e.installment}/${e.installments}`}{e.recurrenceId && " · Recorrente"}</p>{e.notes && <InfoButton title={`Observações: ${e.description}`} text={e.notes} />}</div></div></td><td>{data.accounts.find(a => a.id === e.accountId)?.name || data.cards.find(c => c.id === e.cardId)?.name}{e.toAccountId && <p className="table-secondary">→ {data.accounts.find(a => a.id === e.toAccountId)?.name}</p>}</td><td>{shortDate(e.date)}{e.dueDate && <p className="table-secondary">Venc. {shortDate(e.dueDate)}</p>}</td><td><Badge tone={e.status === "settled" ? "green" : "amber"}>{e.status === "settled" ? "Efetivado" : "Pendente"}</Badge></td><td className={`text-right font-semibold tabular-nums ${e.kind === "income" ? "text-positive" : ""}`}>{e.kind === "income" ? "+ " : ""}{money(e.amount)}</td><td><div className="flex items-center justify-end">{["income", "expense"].includes(e.kind) && <>{e.status === "pending" && <Button variant="ghost" size="icon" aria-label={`Confirmar pagamento ou recebimento de ${e.description}`} onClick={() => setConfirmation({ title: "Confirmar movimentação?", description: "O valor será efetivado com a data de hoje e passará a compor o saldo da conta.", action: () => repo.settleEntry(uid, e.id) })}><Check /></Button>}<Actions label={e.description} edit={() => openEntry(e)} remove={!e.recurrenceId ? () => setConfirmation({ title: "Excluir transação?", description: "O registro será removido e os saldos serão recalculados.", action: () => repo.deleteEntry(uid, e.id) }) : undefined} /></>}{e.kind === "transfer" && <Actions label={e.description} remove={() => setConfirmation({ title: "Excluir transferência?", description: "Os saldos das duas contas serão recalculados.", action: () => repo.deleteEntry(uid, e.id) })} />}</div></td></tr>)}</tbody></table></div> : <Empty title="Nenhuma transação por aqui" description="Adicione uma movimentação ou ajuste os filtros para encontrar seus registros." />}</Panel></>{dialogs}</>;
}
