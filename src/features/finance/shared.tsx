"use client";
import { useState } from "react";
import { BookOpen, Car, Heart, Home, Pencil, RefreshCw, RotateCcw, Sparkles, Tag, Trash2, Utensils, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/components/providers";
import { PageHeading } from "@/components/finance-ui";
import { FormDialog, type FormConfig, type FormField } from "@/components/form-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { type Category } from "@/lib/domain/types";
import * as repo from "@/lib/firebase/repository";

const titles: Record<string, [string, string]> = {
  dashboard: ["Visão geral", "O saldo considera receitas recebidas, despesas pagas, transferências e pagamentos de fatura até hoje. Metas e investimentos são acompanhados separadamente."],
  transacoes: ["Transações", "Use os filtros para encontrar seus registros. Pendências entram no saldo ao serem confirmadas. Compras de cartão entram nas despesas no mês de vencimento."],
  contas: ["Minhas contas", "Cadastre banco, carteira ou dinheiro. O saldo inicial vale desde o começo do histórico e não pode ser editado depois. Para ajustar o saldo, registre uma entrada ou saída. Arquivar preserva o histórico."],
  cartoes: ["Cartões", "Registre compras ou importe uma fatura CSV do Nubank. O mês selecionado é o do vencimento. Pagar a fatura reduz a conta sem contar novamente as despesas. Compras de faturas pagas não podem ser excluídas."],
  orcamentos: ["Orçamentos", "Defina um limite por categoria e mês. O consumo inclui despesas pagas e parcelas de cartão no vencimento. Os alertas aparecem ao atingir 80% e 100% do limite."],
  metas: ["Metas", "Defina um objetivo e registre aportes ou retiradas para acompanhar sua reserva. Esses registros não alteram o saldo das contas. Movimente o dinheiro real separadamente."],
  investimentos: ["Investimentos", "Atualize os valores com base nos seus extratos. O resultado é a diferença entre o valor atual e o capital informado, sem ajuste por tempo, aportes, impostos ou inflação. Não há consulta automática de cotações."],
  categorias: ["Categorias", "Organize receitas e despesas por assunto. As categorias de uma transação acompanham o tipo escolhido. Arquivar uma categoria preserva o histórico."],
  recorrencias: ["Contas recorrentes", "Cadastre o que se repete mensalmente e use Gerar lançamentos para criar os registros. Não há geração automática. Registros existentes não são duplicados. Para mudar as próximas ocorrências, pause a regra e cadastre outra."],
  configuracoes: ["Configurações", "Personalize a aparência, organize a importação e controle sua conta e seus dados."],
};
export const text = (key: string, label: string, extra: Partial<FormField> = {}): FormField => ({ key, label, ...extra });
export const select = (key: string, label: string, options: NonNullable<FormField["options"]>, extra: Partial<FormField> = {}): FormField => ({ key, label, type: "select", options, ...extra });
const iconMap = { tag: Tag, utensils: Utensils, home: Home, car: Car, heart: Heart, book: BookOpen, sparkles: Sparkles, wallet: Wallet };
export function CategoryIcon({ category }: { category?: Category }) { const Icon = iconMap[category?.icon as keyof typeof iconMap] || Tag; return <span className="transaction-icon" style={{ color: category?.color, background: `${category?.color || "#64748b"}18` }}><Icon size={19} /></span>; }
export function Actions({ edit, remove, restore, label }: { edit?: () => void; remove?: () => void; restore?: () => void; label: string }) { return <div className="flex items-center gap-1">{edit && <Button variant="ghost" size="icon" aria-label={`Editar ${label}`} onClick={edit}><Pencil /></Button>}{remove && <Button variant="ghost" size="icon" aria-label={`Excluir ou arquivar ${label}`} onClick={remove}><Trash2 /></Button>}{restore && <Button variant="ghost" size="icon" aria-label={`Restaurar ${label}`} onClick={restore}><RotateCcw /></Button>}</div>; }
export function FeatureHeading({ section, month, setMonth, action }: { section: string; month?: string; setMonth?: (value: string) => void; action?: React.ReactNode }) {
  const { refresh } = useFinance();
  return <PageHeading title={titles[section][0]} help={titles[section][1]} action={<><Button variant="outline" size="icon" onClick={refresh} aria-label="Atualizar dados"><RefreshCw aria-hidden="true" /></Button>{setMonth && <label className="field-label">{section === "cartoes" ? "Fatura de" : "Mês"}<input type="month" className="input month-picker" value={month} onChange={event => { if (event.target.value) setMonth(event.target.value); }} required={section !== "transacoes"} />{!month && <span className="field-help">Todos os meses</span>}</label>}{action}</>} />;
}
export function useFinanceOptions() {
  const { user, data } = useFinance(); const uid = user!.uid;
  const activeAccounts = data.accounts.filter(a => !a.archived);
  const activeCategories = data.categories.filter(c => !c.archived);
  const activeCards = data.cards.filter(c => !c.archived);
  const accountOptions = activeAccounts.map(a => ({ value: a.id, label: a.name }));
  const categoryOptions = (kind?: string) => activeCategories.filter(c => !kind || c.type === kind).map(c => ({ value: c.id, label: c.name, when: kind ? undefined : { field: "kind", value: c.type } }));
  const needAccount = () => { if (!activeAccounts.length) { toast.info("Cadastre uma conta em Minhas contas para começar."); return false; } return true; };
  return { user, uid, data, activeAccounts, activeCategories, activeCards, accountOptions, categoryOptions, needAccount };
}
export function useFeatureDialogs(uid: string) {
  const { refresh } = useFinance();
  const [form, setForm] = useState<FormConfig | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; action: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmArchive = (key: "accounts" | "categories" | "cards" | "goals" | "investments" | "recurrences", id: string, archived: boolean) => setConfirmation({ title: archived ? "Restaurar registro?" : "Arquivar registro?", description: archived ? "O registro voltará a ficar disponível para novas operações." : "O registro sairá das opções para novas operações. O histórico e suas referências serão preservados. Você poderá restaurá-lo depois.", action: () => repo.archive(uid, key, id, !archived) });
  const dialogs = <>{form && <FormDialog key={form.title + JSON.stringify(form.defaults)} config={{ ...form, submit: async values => { await form.submit(values); refresh(); } }} close={() => setForm(null)} />}{confirmation && <Dialog open busy={busy} onOpenChange={open => { if (!open && !busy) setConfirmation(null); }} title={confirmation.title} description={confirmation.description}><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</Button><Button disabled={busy} onClick={async () => { setBusy(true); try { await confirmation.action(); refresh(); toast.success("Operação concluída."); setConfirmation(null); } catch (error) { toast.error(repo.errorMessage(error)); } finally { setBusy(false); } }}>{busy ? "Salvando…" : "Confirmar"}</Button></div></Dialog>}</>;
  return { setForm, setConfirmation, confirmArchive, dialogs };
}
export function ArchiveToggle({ checked, onChange, items }: { checked: boolean; onChange: (value: boolean) => void; items: { archived: boolean }[] }) {
  return items.some(item => item.archived) ? <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="size-5 accent-primary" />Mostrar arquivados</label> : null;
}
