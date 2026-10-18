"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Empty, Panel, Progress } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { budgetProgress, money, moneyInput, monthOf, parseMoney } from "@/lib/domain/finance";
import { type Budget } from "@/lib/domain/types";
import * as repo from "@/lib/firebase/repository";
import { text, select, CategoryIcon, Actions, FeatureHeading, useFinanceOptions, useFeatureDialogs } from "@/features/finance/shared";

export function BudgetsScreen() {
  const { uid, data, categoryOptions } = useFinanceOptions();
  const { setForm, setConfirmation, dialogs } = useFeatureDialogs(uid);
  const [month, setMonth] = useState(monthOf());
  function openBudget(budget?: Budget) { setForm({ title: budget ? "Editar limite" : "Novo orçamento", fields: [select("categoryId", "Categoria", categoryOptions("expense"), { disabled: !!budget }), text("month", "Mês", { type: "month", disabled: !!budget }), text("amount", "Limite (R$)", { type: "money" })], defaults: budget ? { categoryId: budget.categoryId, month: budget.month, amount: moneyInput(budget.amount) } : { month }, submit: v => repo.saveBudget(uid, v.categoryId, v.month, parseMoney(v.amount)) }); }
  const primary: [string, () => void] = ["Definir orçamento", () => openBudget()];
  return <><FeatureHeading section="orcamentos" month={month} setMonth={setMonth} action={<Button onClick={primary[1]}><Plus />{primary[0]}</Button>} /><><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.budgets.filter(b => b.month === month).map(b => { const progress = budgetProgress(b, data.entries); const category = data.categories.find(c => c.id === b.categoryId); return <Panel key={b.id}><div className="flex items-center gap-3"><CategoryIcon category={category} /><h2 className="flex-1 font-medium">{category?.name}</h2><Actions label={category?.name || "orçamento"} edit={() => openBudget(b)} remove={() => setConfirmation({ title: "Excluir orçamento?", description: "Apenas o limite planejado será excluído. As despesas permanecerão no histórico.", action: () => repo.deleteBudget(uid, b.id) })} /></div><div className="mb-4 mt-6 flex items-baseline justify-between"><strong className="text-2xl font-semibold">{money(progress.used)}</strong><span className="text-sm text-muted-foreground">de {money(b.amount)}</span></div><Progress label={`Orçamento de ${category?.name || "categoria"}`} percent={progress.percent} /><div className="mt-4 flex justify-between text-xs"><span className="text-muted-foreground">{progress.percent}% utilizado</span><Badge tone={progress.percent >= 100 ? "red" : progress.percent >= 80 ? "amber" : "green"}>{progress.percent >= 100 ? "Limite atingido" : progress.percent >= 80 ? "Atenção" : "Dentro do plano"}</Badge></div></Panel>; })}</div>{!data.budgets.some(b => b.month === month) && <Panel><Empty title="Planeje um mês com mais tranquilidade" description="Defina limites por categoria para acompanhar seu consumo e receber alertas de 80% e 100%." action={<Button onClick={() => openBudget()}>Definir meu primeiro limite</Button>} /></Panel>}</>{dialogs}</>;
}
