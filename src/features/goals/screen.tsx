"use client";
import { ResourceStatus, useResource } from "@/features/finance/use-resource";
import { featureHistory } from "@/lib/firebase/finance-queries";
import type { GoalMovement } from "@/lib/domain/types";

import { useCallback, useState } from "react";
import { Plus, Target } from "lucide-react";
import { Empty, Panel, Progress } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { money, moneyInput, parseMoney, shortDate } from "@/lib/domain/finance";
import { type Goal } from "@/lib/domain/types";
import * as repo from "@/lib/firebase/repository";
import { text, select, Actions, FeatureHeading, useFinanceOptions, useFeatureDialogs, ArchiveToggle } from "@/features/finance/shared";

export function GoalsScreen() {
  const { uid, data: coreData } = useFinanceOptions();
  const { setForm, confirmArchive, dialogs } = useFeatureDialogs(uid);
  const [showArchived, setShowArchived] = useState(false);
  const load = useCallback(() => featureHistory(uid, "goalMovements"), [uid]);
  const resource = useResource(uid + ":goalMovements", load);
  const data = { ...coreData, goalMovements: (resource.value || []) as GoalMovement[] };
  function openGoal(goal?: Goal) { setForm({ title: goal ? "Editar meta" : "Nova meta", fields: [text("name", "Nome do objetivo"), text("target", "Valor desejado (R$)", { type: "money" }), text("deadline", "Prazo", { type: "date", required: false })], defaults: goal ? { name: goal.name, target: moneyInput(goal.target), deadline: goal.deadline } : {}, submit: v => repo.saveGoal(uid, { name: v.name, target: parseMoney(v.target), deadline: v.deadline }, goal?.id) }); }
  function openGoalMovement(goal: Goal) { setForm({ title: `Movimentar · ${goal.name}`, description: "Este é um registro de reserva para o objetivo. Não movimenta contas nem gera receitas ou despesas.", fields: [select("direction", "Operação", [{ value: "deposit", label: "Aporte" }, { value: "withdraw", label: "Retirada" }]), text("amount", "Valor (R$)", { type: "money" }), text("notes", "Observações", { type: "textarea", required: false })], defaults: { direction: "deposit" }, submit: v => repo.moveGoal(uid, goal.id, parseMoney(v.amount) * (v.direction === "withdraw" ? -1 : 1), v.notes) }); }
  const archivedToggle = <ArchiveToggle checked={showArchived} onChange={setShowArchived} items={data.goals} />;
  const primary: [string, () => void] = ["Nova meta", () => openGoal()];
  if (!resource.value) return <ResourceStatus error={resource.error} />;
  return <><FeatureHeading section="metas" action={<Button onClick={primary[1]}><Plus />{primary[0]}</Button>} /><>{archivedToggle}<div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{data.goals.filter(g => showArchived || !g.archived).map(g => <Panel key={g.id}><div className="flex justify-between"><span className="account-symbol"><Target /></span><Actions label={g.name} edit={!g.archived ? () => openGoal(g) : undefined} remove={!g.archived ? () => confirmArchive("goals", g.id, false) : undefined} restore={g.archived ? () => confirmArchive("goals", g.id, true) : undefined} /></div><h2 className="mb-1 mt-5 text-lg font-semibold">{g.name}</h2><p className="text-xs text-muted-foreground">{g.deadline ? `Até ${shortDate(g.deadline)}` : "Um passo de cada vez"}{g.archived && " · Arquivada"}</p><div className="mb-3 mt-6 flex justify-between"><strong>{money(g.current)}</strong><span className="text-sm text-primary">{Math.round(g.current / g.target * 100)}%</span></div><Progress label={`Meta ${g.name}`} percent={g.current / g.target * 100} /><p className="mb-5 mt-3 text-xs text-muted-foreground">Objetivo: {money(g.target)}</p>{!g.archived && <Button className="w-full" variant="outline" onClick={() => openGoalMovement(g)}><Plus />Registrar aporte ou retirada</Button>}<details className="mt-4 text-xs"><summary className="cursor-pointer text-muted-foreground">Histórico de movimentações</summary><div className="mt-3 space-y-2">{data.goalMovements.filter(m => m.goalId === g.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(m => <div key={m.id} className="flex justify-between gap-2"><span>{shortDate(m.date)} {m.notes}</span><span>{money(m.amount)}</span></div>)}</div></details></Panel>)}</div>{!data.goals.length && <Panel><Empty title="Crie sua primeira meta" description="Defina um objetivo e acompanhe sua reserva." action={<Button onClick={() => openGoal()}>Criar minha primeira meta</Button>} /></Panel>}</>{dialogs}</>;
}
