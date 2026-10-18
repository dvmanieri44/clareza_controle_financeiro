"use client";
import { useId, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/components/providers";
import { Panel } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteImportRule, errorMessage, saveImportRule } from "@/lib/firebase/repository";
import { validateRule } from "@/lib/domain/import-rules";
import type { ImportRule } from "@/lib/domain/types";

export function ImportRuleSettings() {
  const { user, data, deletionPending } = useFinance();
  const id = useId();
  const [pattern, setPattern] = useState("");
  const [match, setMatch] = useState<"exact" | "contains">("contains");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [remove, setRemove] = useState<ImportRule | null>(null);
  const categories = data.categories.filter(category => !category.archived && category.type === "expense");
  async function save() {
    if (!user || busy || deletionPending) return;
    setProblem("");
    try { validateRule(pattern, match, categoryId); } catch (error) { setProblem(errorMessage(error)); return; }
    setBusy(true);
    try { await saveImportRule(user.uid, pattern, match, categoryId); setPattern(""); toast.success("Regra salva. Ela será sugerida nas próximas importações."); }
    catch (error) { setProblem(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Panel title="Categorias na importação" className="lg:col-span-2" action={<Sparkles aria-hidden="true" size={20} />}>
    <p className="mb-5 text-sm text-muted-foreground">Defina uma categoria para descrições recorrentes. As regras sugerem categorias na prévia; você sempre confere antes de importar. Salvar a mesma descrição e comparação atualiza a regra.</p>
    <form noValidate className="grid gap-4 md:grid-cols-2" aria-busy={busy} onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="field-label" htmlFor={`${id}-pattern`}>Descrição<input id={`${id}-pattern`} className="input mt-2" value={pattern} maxLength={120} placeholder="Ex.: mercado" onChange={event => setPattern(event.target.value)} disabled={busy || deletionPending} required /></label>
      <label className="field-label" htmlFor={`${id}-match`}>Como comparar<select id={`${id}-match`} className="input mt-2" value={match} onChange={event => setMatch(event.target.value as typeof match)} disabled={busy || deletionPending}><option value="contains">Contém estas palavras</option><option value="exact">Descrição inteira</option></select></label>
      <label className="field-label" htmlFor={`${id}-category`}>Categoria<select id={`${id}-category`} className="input mt-2" value={categoryId} onChange={event => setCategoryId(event.target.value)} disabled={busy || deletionPending} required><option value="">Selecione…</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <div className="flex items-end"><Button disabled={busy || deletionPending || !categories.length}>{busy ? "Salvando…" : "Salvar regra"}</Button></div>
    </form>
    {problem && <p role="alert" className="error-box mt-4">{problem}</p>}
    <p className="my-4 text-sm text-muted-foreground">A comparação ignora acentos, maiúsculas e pontuação. Regras de descrição inteira têm preferência; depois, vale a mais específica. Categorias arquivadas não são sugeridas.</p>
    {!data.importRules.length ? <p className="text-sm text-muted-foreground">Nenhuma regra salva. Você também pode lembrar as categorias ao confirmar uma fatura.</p> : <ul className="divide-y divide-border">{[...data.importRules].sort((a, b) => a.pattern.localeCompare(b.pattern)).map(rule => {
      const category = data.categories.find(item => item.id === rule.categoryId);
      return <li key={rule.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{rule.pattern}</p><p className="text-sm text-muted-foreground">{rule.match === "exact" ? "Descrição inteira" : "Contém estas palavras"} → {category?.name || "Categoria indisponível"}{category?.archived ? " (arquivada)" : ""}</p></div><Button variant="ghost" size="icon" disabled={busy || deletionPending} aria-label={`Excluir regra ${rule.pattern}`} onClick={() => { setProblem(""); setRemove(rule); }}><Trash2 aria-hidden="true" /></Button></li>;
    })}</ul>}
    {remove && <Dialog open busy={busy} onOpenChange={open => { if (!open) setRemove(null); }} title="Excluir regra?" description={`A categoria deixará de ser sugerida para “${remove.pattern}”. As compras já importadas permanecem iguais.`}>
      {problem && <p role="alert" className="error-box mb-4">{problem}</p>}
      <div className="form-actions"><Button variant="outline" disabled={busy} onClick={() => setRemove(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={async () => { if (!user) return; setBusy(true); setProblem(""); try { await deleteImportRule(user.uid, remove.id); setRemove(null); toast.success("Regra excluída."); } catch (error) { setProblem(errorMessage(error)); } finally { setBusy(false); } }}>{busy ? "Excluindo…" : "Excluir regra"}</Button></div>
    </Dialog>}
  </Panel>;
}
