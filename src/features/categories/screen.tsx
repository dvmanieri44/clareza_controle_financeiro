"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Panel } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { type Category } from "@/lib/domain/types";
import * as repo from "@/lib/firebase/repository";
import { text, select, CategoryIcon, Actions, FeatureHeading, useFinanceOptions, useFeatureDialogs, ArchiveToggle } from "@/features/finance/shared";

export function CategoriesScreen() {
  const { uid, data } = useFinanceOptions();
  const { setForm, confirmArchive, dialogs } = useFeatureDialogs(uid);
  const [showArchived, setShowArchived] = useState(false);
  function openCategory(category?: Category) { setForm({ title: category ? "Editar categoria" : "Nova categoria", fields: [text("name", "Nome"), select("type", "Tipo", [{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }], { disabled: !!category }), text("color", "Cor", { type: "color" }), select("icon", "Ícone", [{ value: "tag", label: "Etiqueta" }, { value: "utensils", label: "Alimentação" }, { value: "home", label: "Casa" }, { value: "car", label: "Carro" }, { value: "heart", label: "Coração" }, { value: "book", label: "Livro" }, { value: "sparkles", label: "Estrelas" }, { value: "wallet", label: "Carteira" }])], defaults: category ? { name: category.name, type: category.type, color: category.color, icon: category.icon } : { type: "expense", icon: "tag" }, submit: v => repo.saveCategory(uid, { name: v.name, type: v.type as "income" | "expense", color: v.color, icon: v.icon }, category?.id) }); }
  const archivedToggle = <ArchiveToggle checked={showArchived} onChange={setShowArchived} items={data.categories} />;
  const primary: [string, () => void] = ["Nova categoria", () => openCategory()];
  return <><FeatureHeading section="categorias" action={<Button onClick={primary[1]}><Plus />{primary[0]}</Button>} /><>{archivedToggle}<div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.categories.filter(c => showArchived || !c.archived).map(c => <Panel key={c.id}><div className="flex items-center gap-3"><CategoryIcon category={c} /><div className="min-w-0 flex-1"><h2 className="font-medium">{c.name}</h2><p className="mt-1 text-xs text-muted-foreground">{c.type === "income" ? "Receita" : "Despesa"}{c.archived && " · Arquivada"}</p></div><Actions label={c.name} edit={!c.archived ? () => openCategory(c) : undefined} remove={!c.archived ? () => confirmArchive("categories", c.id, false) : undefined} restore={c.archived ? () => confirmArchive("categories", c.id, true) : undefined} /></div></Panel>)}</div></>{dialogs}</>;
}
