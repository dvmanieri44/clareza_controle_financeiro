"use client";
import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { Check, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/finance-ui";
import { useFinance } from "@/components/providers";
import { errorMessage, importInvoice } from "@/lib/firebase/repository";
import { money, moneyInput, parseMoney } from "@/lib/domain/finance";
import { date as dateSchema, month as monthSchema, name, positiveCents } from "@/lib/domain/schemas";
import { invoiceImportId, MAX_IMPORT_BYTES, MAX_IMPORT_SELECTION, parseNubankCsv, type InvoiceCsvRow } from "@/lib/domain/invoice-import";
import { normalizeDescription, rememberedRules, similarPurchase, suggestCategory } from "@/lib/domain/import-rules";
import { invoiceEntries } from "@/lib/firebase/finance-queries";
import { ResourceStatus, useResource } from "@/features/finance/use-resource";

interface ReviewRow extends InvoiceCsvRow { id: string; selected: boolean; amountText: string; categoryId: string; suggestedCategoryId: string; }

function rowProblems(row: ReviewRow): string[] {
  const issues = row.issues.filter(issue => issue.startsWith("Quantidade de colunas"));
  if (!dateSchema.safeParse(row.date).success) issues.push("Corrija a data.");
  if (!name.safeParse(row.description).success) issues.push("A descrição deve ter entre 2 e 120 caracteres.");
  try { positiveCents.parse(parseMoney(row.amountText)); } catch { issues.push("Informe um valor maior que zero."); }
  if (!row.categoryId) issues.push("Escolha uma categoria.");
  return issues;
}

export function InvoiceImportDialog({ initialMonth, close, onImported }: { initialMonth: string; close: () => void; onImported: (month: string) => void }) {
  const { user, data } = useFinance();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const cards = data.cards.filter(card => !card.archived);
  const categories = data.categories.filter(category => !category.archived && category.type === "expense");
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [month, setMonth] = useState(initialMonth);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [category, setCategory] = useState("");
  const [dragging, setDragging] = useState(false);
  const [rememberCategories, setRememberCategories] = useState(false);
  const uid = user!.uid;
  const loadInvoice = useCallback(() => cardId ? invoiceEntries(uid, cardId, month) : Promise.resolve([]), [uid, cardId, month]);
  const invoice = useResource(`${uid}:invoice:${cardId}:${month}`, loadInvoice);
  const entries = invoice.value || [];
  const existing = new Set(entries.map(entry => entry.id));
  const duplicate = (row: ReviewRow) => existing.has(`${row.id}_1`);
  const isCredit = (row: ReviewRow) => row.amount !== null && row.amount <= 0;
  const selected = rows.filter(row => row.selected && !isCredit(row) && !duplicate(row));
  const invalid = selected.filter(row => rowProblems(row).length);
  const rulesToRemember = rememberedRules(selected.filter(row => !rowProblems(row).length));
  const conflictingDescriptions = new Set(selected.filter(row => row.categoryId).map(row => normalizeDescription(row.description))).size > rulesToRemember.length;
  const total = selected.reduce((sum, row) => { try { return sum + parseMoney(row.amountText); } catch { return sum; } }, 0);
  const credits = rows.filter(isCredit);
  const importedCount = rows.filter(duplicate).length;
  const card = cards.find(item => item.id === cardId);
  const paid = entries.some(entry => entry.kind === "invoicePayment" && entry.cardId === cardId && entry.invoiceMonth === month);

  function chooseFile(candidate?: File) {
    if (busy) return;
    setProblem("");
    if (!candidate) return;
    if (!/\.csv$/i.test(candidate.name)) { setProblem("Escolha o arquivo CSV da fatura Nubank."); return; }
    if (candidate.size > MAX_IMPORT_BYTES) { setProblem("O arquivo deve ter no máximo 2 MB."); return; }
    setFile(candidate);
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragging(false);
    if (busy) return;
    if (event.dataTransfer.files.length !== 1) { setProblem("Envie um arquivo por vez."); return; }
    chooseFile(event.dataTransfer.files[0]);
  }
  async function preview() {
    setProblem("");
    if (!cardId || !card) { setProblem("Escolha um cartão ativo."); return; }
    if (!monthSchema.safeParse(month).success) { setProblem("Escolha o mês de vencimento da fatura."); return; }
    if (!file) { setProblem("Selecione o CSV da fatura."); return; }
    if (!invoice.value) { setProblem("Aguarde a consulta da fatura antes de conferir o arquivo."); return; }
    if (paid) { setProblem("Esta fatura já foi paga. Escolha uma fatura em aberto."); return; }
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      let source: string;
      try { source = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
      catch { source = new TextDecoder("windows-1252").decode(buffer); }
      const parsed = parseNubankCsv(source);
      const signatures = parsed.map(row => JSON.stringify([row.date, normalizeDescription(row.description), row.amount ?? row.rawAmount]));
      const repetitions = new Map<string, number>();
      signatures.forEach(signature => repetitions.set(signature, (repetitions.get(signature) || 0) + 1));
      let count = 0;
      const identifiers = await Promise.all(parsed.map(row => invoiceImportId(cardId, month, row.sourceKey)));
      const prepared: ReviewRow[] = parsed.map((row, index) => {
        const rowId = identifiers[index];
        const manualMatch = similarPurchase(entries, cardId, month, row);
        const available = row.amount !== null && row.amount > 0 && !row.issues.length && !existing.has(`${rowId}_1`) && !manualMatch;
        const selected = available && count++ < MAX_IMPORT_SELECTION;
        const categoryId = suggestCategory(row.description, data.importRules, categories);
        return { ...row, repeated: row.repeated || (repetitions.get(signatures[index]) || 0) > 1, id: rowId, selected, amountText: row.amount === null ? row.rawAmount : moneyInput(row.amount), categoryId, suggestedCategoryId: categoryId };
      });
      setRows(prepared); setReview(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
    } catch (error) { setProblem(error instanceof Error ? error.message : "Não foi possível ler o arquivo."); }
    finally { setBusy(false); }
  }
  function updateRow(index: number, patch: Partial<ReviewRow>) { setRows(old => old.map((row, current) => current === index ? { ...row, ...patch } : row)); }
  function selectAvailable(select: boolean) {
    let count = 0;
    setRows(old => old.map(row => ({ ...row, selected: select && !duplicate(row) && !isCredit(row) && !row.issues.some(issue => issue.startsWith("Quantidade de colunas")) && count++ < MAX_IMPORT_SELECTION })));
  }
  async function confirm() {
    setProblem("");
    if (!user || !invoice.value || invalid.length || !selected.length || selected.length > MAX_IMPORT_SELECTION) return;
    if (paid) { setProblem("Esta fatura foi paga. Não é possível importar compras."); return; }
    setBusy(true);
    try {
      const result = await importInvoice(user.uid, cardId, month, selected.map(row => ({ id: row.id, date: row.date, description: row.description, amount: parseMoney(row.amountText), categoryId: row.categoryId })), rememberCategories);
      toast.success(`${result.added} compra(s) importada(s).${result.skipped ? ` ${result.skipped} já existiam.` : ""}`);
      onImported(month); close();
    } catch (error) { setProblem(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Dialog open wide={review} busy={busy} onOpenChange={open => { if (!open) close(); }} title="Importar fatura Nubank" description={review ? "Confira as compras antes de confirmar." : "Escolha a fatura e envie o CSV exportado pelo Nubank."}>
    {!review ? <form className="grid gap-5" noValidate onSubmit={event => { event.preventDefault(); void preview(); }}>
      <label className="field-label" htmlFor={`${id}-card`}>Cartão<select id={`${id}-card`} className="input" value={cardId} onChange={event => setCardId(event.target.value)} disabled={busy} required><option value="">Selecione…</option>{cards.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="field-label" htmlFor={`${id}-month`}>Mês de vencimento da fatura<input id={`${id}-month`} className="input" type="month" value={month} onChange={event => setMonth(event.target.value)} disabled={busy} required /></label>
      <div className={`import-dropzone${dragging ? " import-dropzone-active" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        <FileUp aria-hidden="true" size={32} className="mx-auto text-primary" />
        <p className="my-3" role="status">{file ? file.name : "Arraste o CSV para cá ou selecione um arquivo."}</p>
        <input ref={fileInput} id={`${id}-file`} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} onChange={event => chooseFile(event.target.files?.[0])} disabled={busy} />
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" />{file ? "Trocar arquivo" : "Selecionar CSV"}</Button>
        <p className="mt-3 text-xs text-muted-foreground">CSV, até 2 MB. O arquivo é lido no seu navegador.</p>
      </div>
      {!cards.length && <p className="error-box">Cadastre um cartão antes de importar a fatura.</p>}
      {!categories.length && <p className="error-box">Cadastre uma categoria de despesa antes de importar.</p>}
      {!invoice.value && <ResourceStatus error={invoice.error} />}
      {problem && <p role="alert" className="error-box">{problem}</p>}
      <div className="form-actions"><Button type="button" variant="outline" onClick={close} disabled={busy}>Cancelar</Button><Button disabled={busy || !invoice.value || !cards.length || !categories.length}>{busy ? <><Loader2 aria-hidden="true" className="animate-spin" />Lendo arquivo…</> : "Conferir lançamentos"}</Button></div>
    </form> : <div className="grid gap-5" aria-busy={busy}>
      <div className="import-summary"><div><h2 ref={summaryRef} tabIndex={-1} className="text-lg font-semibold">{card?.name} · {month.split("-").reverse().join("/")}</h2><p className="text-sm text-muted-foreground">{rows.length} linhas · {importedCount} já importadas · {credits.length} pagamentos/créditos fora da seleção</p></div><div><span className="text-sm text-muted-foreground">Compras selecionadas</span><p className="text-2xl font-semibold">{selected.length} · {money(total)}</p></div></div>
      <div className="import-category-tools"><label className="field-label" htmlFor={`${id}-category`}>Categoria das compras selecionadas<select id={`${id}-category`} className="input" value={category} onChange={event => setCategory(event.target.value)} disabled={busy}><option value="">Escolha uma categoria…</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Button type="button" variant="outline" disabled={busy || !category} onClick={() => setRows(old => old.map(row => row.selected && !isCredit(row) && !duplicate(row) ? { ...row, categoryId: category, suggestedCategoryId: "" } : row))}>Aplicar categoria</Button></div>
      <p className="text-sm text-muted-foreground">Categorias sugeridas pelas suas regras podem ser alteradas. Compras semelhantes já cadastradas começam desmarcadas; confira antes de incluí-las.</p>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" disabled={busy} onClick={() => selectAvailable(true)}>Selecionar até {MAX_IMPORT_SELECTION} compras</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => selectAvailable(false)}>Desmarcar todas</Button></div>
      <div className="table-scroll import-table-scroll" role="region" aria-label="Prévia dos lançamentos da fatura" tabIndex={0}>
        <table className="import-table"><caption className="sr-only">Confira data, descrição, valor e categoria de cada lançamento antes de importar.</caption><thead><tr><th scope="col">Importar</th><th scope="col">Data</th><th scope="col">Descrição</th><th scope="col">Valor (R$)</th><th scope="col">Categoria</th><th scope="col">Conferência</th></tr></thead><tbody>
          {rows.map((row, index) => {
            const credit = isCredit(row), exists = duplicate(row), issues = rowProblems(row);
            let currentAmount: number | null = null;
            try { currentAmount = parseMoney(row.amountText); } catch { /* O erro é exibido na conferência. */ }
            const manualMatch = !exists && similarPurchase(entries, cardId, month, { ...row, amount: currentAmount });
            const locked = busy || credit || exists;
            const label = `linha ${row.line}: ${row.description}`;
            return <tr key={row.id} className={credit || exists ? "import-row-muted" : undefined}>
              <td><input type="checkbox" className="size-7 accent-primary" checked={row.selected && !credit && !exists} onChange={event => updateRow(index, { selected: event.target.checked })} disabled={locked} aria-label={`Importar ${label}`} /></td>
              <td><input className="input" type="date" value={dateSchema.safeParse(row.date).success ? row.date : ""} onChange={event => updateRow(index, { date: event.target.value })} disabled={locked} aria-label={`Data da ${label}`} aria-invalid={row.selected && !dateSchema.safeParse(row.date).success} /></td>
              <td><input className="input" value={row.description} onChange={event => updateRow(index, { description: event.target.value, suggestedCategoryId: "" })} maxLength={120} disabled={locked} aria-label={`Descrição da linha ${row.line}`} aria-invalid={row.selected && !name.safeParse(row.description).success} /></td>
              <td><input className="input tabular-nums" inputMode="decimal" value={row.amountText} onChange={event => updateRow(index, { amountText: event.target.value })} disabled={locked} aria-label={`Valor da ${label}`} /></td>
              <td>{!credit && !exists && <><select className="input" value={row.categoryId} onChange={event => updateRow(index, { categoryId: event.target.value, suggestedCategoryId: "" })} disabled={busy} aria-label={`Categoria da ${label}`} aria-invalid={row.selected && !row.categoryId}><option value="">Selecione…</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{row.suggestedCategoryId && <span className="mt-1 block text-sm text-primary">Sugerida pela sua regra</span>}</>}</td>
              <td>{credit ? <Badge>Pagamento/crédito</Badge> : exists ? <Badge tone="green">Já importada</Badge> : <>{row.repeated && <Badge tone="amber">Repetida no arquivo: confira</Badge>}{manualMatch && <Badge tone="amber">Compra semelhante já existe</Badge>}{(row.selected || row.issues.length > 0) && issues.length > 0 && <p className="field-error">{issues.join(" ")}</p>}{row.selected && !issues.length && <span className="inline-flex items-center gap-1 text-sm text-positive"><Check aria-hidden="true" size={16} />Pronta</span>}</>}</td>
            </tr>;
          })}
        </tbody></table>
      </div>
      <p className="text-sm text-muted-foreground">Somente as linhas selecionadas serão lançadas nesta fatura. Parcelas futuras e pagamentos/créditos não são criados.</p>
      <div className="rounded-xl border border-border p-4"><label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={rememberCategories} onChange={event => setRememberCategories(event.target.checked)} disabled={busy} /><span>Lembrar as categorias destas descrições nas próximas faturas<span className="mt-1 block text-muted-foreground">Ao confirmar, até {rulesToRemember.length} regra(s) de descrição inteira serão salvas ou atualizadas junto às compras novas. Gerencie em Configurações.</span></span></label>{rememberCategories && conflictingDescriptions && <p className="mt-3 text-sm text-muted-foreground">Descrições com categorias diferentes ou sem categoria válida não serão lembradas.</p>}</div>
      <p role="status" className={invalid.length || selected.length > MAX_IMPORT_SELECTION ? "text-sm text-destructive" : "sr-only"}>{invalid.length ? `Corrija ${invalid.length} linha(s) selecionada(s) antes de importar.` : selected.length > MAX_IMPORT_SELECTION ? `Selecione no máximo ${MAX_IMPORT_SELECTION} compras por vez.` : `${selected.length} compras selecionadas para conferência.`}</p>
      {problem && <p role="alert" className="error-box">{problem}</p>}
      {!invoice.value && <ResourceStatus error={invoice.error} />}
      <div className="form-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => { setReview(false); setRows([]); setProblem(""); }}>Voltar</Button><Button type="button" disabled={busy || !invoice.value || !!invalid.length || !selected.length || selected.length > MAX_IMPORT_SELECTION || paid} onClick={() => void confirm()}>{busy ? <><Loader2 aria-hidden="true" className="animate-spin" />Importando…</> : `Confirmar ${selected.length} compra(s)`}</Button></div>
    </div>}
  </Dialog>;
}
