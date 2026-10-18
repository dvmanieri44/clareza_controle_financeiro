import { date as dateSchema, month as monthSchema, name, positiveCents } from "./schemas";
import { parseMoney } from "./finance";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_SELECTION = 200;

export interface InvoiceCsvRow {
  line: number;
  date: string;
  description: string;
  amount: number | null;
  rawAmount: string;
  sourceKey: string;
  issues: string[];
  repeated: boolean;
}
export interface InvoiceImportItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string;
}

function csvRecords(text: string, delimiter: string) {
  const records: { cells: string[]; line: number }[] = [];
  let cells: string[] = [], field = "", quoted = false, closedQuote = false, line = 1, startLine = 1;
  function finishField() { cells.push(field.trim()); field = ""; closedQuote = false; }
  function finishRecord() {
    finishField();
    if (cells.some(value => value !== "")) records.push({ cells, line: startLine });
    cells = [];
    if (records.length > MAX_IMPORT_ROWS + 1) throw new Error(`O arquivo pode ter no máximo ${MAX_IMPORT_ROWS} lançamentos.`);
  }
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index++; }
      else if (quoted) { quoted = false; closedQuote = true; }
      else if (!field.trim() && !closedQuote) quoted = true;
      else throw new Error(`Aspas inválidas na linha ${line}. Exporte novamente a fatura em CSV.`);
    } else if (quoted) {
      field += char;
      if (char === "\n") line++;
    } else if (char === delimiter) finishField();
    else if (char === "\n" || char === "\r") {
      finishRecord();
      if (char === "\r" && text[index + 1] === "\n") index++;
      line++; startLine = line;
    } else {
      if (closedQuote && char.trim()) throw new Error(`Conteúdo inesperado após aspas na linha ${line}.`);
      field += char;
    }
  }
  if (quoted) throw new Error("O CSV tem aspas sem fechamento. Exporte novamente a fatura.");
  if (field || cells.length) finishRecord();
  return records;
}

function normalizedHeader(value: string) { return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

export function parseStatementAmount(value: string): number {
  const clean = value.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (clean.includes(",")) return parseMoney(clean);
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(clean)) throw new Error("Valor inválido.");
  return parseMoney(clean.replace(".", ","));
}

export function normalizeStatementDate(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const result = match ? `${match[3]}-${match[2]}-${match[1]}` : trimmed;
  return dateSchema.parse(result);
}

export function parseNubankCsv(input: string): InvoiceCsvRow[] {
  if (input.length > MAX_IMPORT_BYTES) throw new Error("O arquivo deve ter no máximo 2 MB.");
  const text = input.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("O arquivo está vazio.");
  // O Nubank usa vírgulas; a alternativa aceita arquivos salvos por planilhas em português.
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) || "";
  const delimiter = firstLine.includes(";") ? ";" : ",";
  const records = csvRecords(text, delimiter);
  const header = records.shift()?.cells.map(normalizedHeader) || [];
  const dateIndex = header.findIndex(value => ["date", "data"].includes(value));
  const titleIndex = header.findIndex(value => ["title", "descricao", "description"].includes(value));
  const amountIndex = header.findIndex(value => ["amount", "valor"].includes(value));
  if ([dateIndex, titleIndex, amountIndex].some(index => index < 0)) throw new Error("CSV não reconhecido. Use a exportação da fatura Nubank com as colunas date, title e amount.");
  if (new Set(header).size !== header.length) throw new Error("O cabeçalho tem colunas repetidas. Exporte novamente a fatura em CSV.");
  if (!records.length) throw new Error("O CSV não contém lançamentos.");
  const occurrences = new Map<string, number>();
  const totals = new Map<string, number>();
  const rows = records.map(record => {
    const issues: string[] = [];
    if (record.cells.length !== header.length) issues.push("Quantidade de colunas diferente do cabeçalho.");
    const rawDate = record.cells[dateIndex] || "";
    const description = (record.cells[titleIndex] || "").replace(/\s+/g, " ").trim().normalize("NFC");
    const rawAmount = record.cells[amountIndex] || "";
    let date = rawDate, amount: number | null = null;
    try { date = normalizeStatementDate(rawDate); } catch { issues.push("Data inválida."); }
    if (!name.safeParse(description).success) issues.push("A descrição deve ter entre 2 e 120 caracteres.");
    try { amount = parseStatementAmount(rawAmount); } catch { issues.push("Valor inválido."); }
    const signature = JSON.stringify([date, description, amount ?? rawAmount]);
    const occurrence = (occurrences.get(signature) || 0) + 1;
    occurrences.set(signature, occurrence); totals.set(signature, occurrence);
    return { line: record.line, date, description, amount, rawAmount, issues, signature, sourceKey: JSON.stringify([signature, occurrence]), repeated: false };
  });
  return rows.map(({ signature, ...row }) => ({ ...row, repeated: (totals.get(signature) || 0) > 1 }));
}

/** Cada repetição legítima tem um ordinal; reenviar o mesmo arquivo mantém os IDs. */
export async function invoiceImportId(cardId: string, month: string, sourceKey: string): Promise<string> {
  monthSchema.parse(month);
  const bytes = new TextEncoder().encode(JSON.stringify([cardId, month, sourceKey]));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return "nu_" + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function validateInvoiceImport(items: InvoiceImportItem[], month: string): InvoiceImportItem[] {
  monthSchema.parse(month);
  if (!items.length || items.length > MAX_IMPORT_SELECTION) throw new Error(`Selecione de 1 a ${MAX_IMPORT_SELECTION} compras por importação.`);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error("Há identificadores repetidos na seleção.");
  if (new Set(items.map(item => item.categoryId)).size > 10) throw new Error("Use no máximo 10 categorias por importação.");
  return items.map(item => {
    if (!/^nu_[a-f0-9]{64}$/.test(item.id)) throw new Error("Identificador de importação inválido. Selecione o arquivo novamente.");
    if (!item.categoryId || item.categoryId.length > 120) throw new Error("Escolha uma categoria para cada compra selecionada.");
    return { id: item.id, date: dateSchema.parse(item.date), description: name.parse(item.description), amount: positiveCents.parse(item.amount), categoryId: item.categoryId };
  });
}
