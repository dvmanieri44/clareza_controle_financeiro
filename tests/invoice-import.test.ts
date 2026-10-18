import { describe, expect, it } from "vitest";
import { invoiceImportId, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, normalizeStatementDate, parseNubankCsv, parseStatementAmount, validateInvoiceImport, type InvoiceImportItem } from "@/lib/domain/invoice-import";

const csv = 'date,title,amount\r\n2026-10-14,Compra de exemplo,"11,95"\r\n2026-10-14,Compra de exemplo,"11,95"\r\n2026-10-13,Pagamento recebido,"-100,00"\r\n';
const item: InvoiceImportItem = { id: `nu_${"a".repeat(64)}`, date: "2026-10-14", description: "Compra de exemplo", amount: 1195, categoryId: "c" };

describe("CSV de fatura Nubank", () => {
  it("lê o formato date/title/amount com vírgula decimal entre aspas", () => {
    const rows = parseNubankCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ line: 2, date: "2026-10-14", description: "Compra de exemplo", amount: 1195, issues: [] });
    expect(rows[2].amount).toBe(-10000);
  });
  it("preserva compras idênticas com chaves distintas e destaca a repetição", () => {
    const rows = parseNubankCsv(csv);
    expect(rows[0].sourceKey).not.toBe(rows[1].sourceKey);
    expect(rows.slice(0, 2).every(row => row.repeated)).toBe(true);
    expect(rows[2].repeated).toBe(false);
    expect(parseNubankCsv(csv).map(row => row.sourceKey)).toEqual(rows.map(row => row.sourceKey));
  });
  it("aceita BOM, cabeçalhos em português e ponto e vírgula", () => {
    const rows = parseNubankCsv('\uFEFFData;Descrição;Valor\n14/10/2026;Compra de exemplo;1.234,56\n');
    expect(rows[0]).toMatchObject({ date: "2026-10-14", description: "Compra de exemplo", amount: 123456, issues: [] });
  });
  it("lê descrições com vírgulas, aspas escapadas e quebra de linha", () => {
    const rows = parseNubankCsv('date,title,amount\n2026-10-14,"Loja, ""teste""",12.30');
    expect(rows[0].description).toBe('Loja, "teste"');
    const multiline = parseNubankCsv('date,title,amount\n2026-10-14,"Loja\nCentro",12.30\n2026-10-15,Outra loja,1.00');
    expect(multiline[0].description).toBe("Loja Centro");
    expect(multiline[1].line).toBe(4);
  });
  it("ignora linhas vazias e mantém a localização física dos lançamentos", () => {
    expect(parseNubankCsv('\n\ndate;title;amount\n\n2026-10-14;Loja;12,00\n\n')[0]).toMatchObject({ line: 5, amount: 1200 });
  });
  it("destaca colunas ausentes, datas, descrições e valores inválidos sem descartá-los", () => {
    const rows = parseNubankCsv('date,title,amount\n2026-02-30,A,abc\n2026-10-14,Loja,12,34\n');
    expect(rows[0].issues).toHaveLength(3);
    expect(rows[0].amount).toBeNull();
    expect(rows[1].issues.join(" ")).toMatch(/colunas/);
  });
  it.each(["", " \n ", "date,title,amount\n", "outro,cabecalho\n1,2", "date,title,amount,amount\n2026-10-14,Loja,1,1", 'date,title,amount\n2026-10-14,"Loja,1', 'date,title,amount\n2026-10-14,Loj"a,1', 'date,title,amount\n2026-10-14,"Loja"texto,1'])("rejeita arquivo vazio ou CSV malformado", source => expect(() => parseNubankCsv(source)).toThrow());
  it("limita o tamanho e a quantidade de linhas antes de processar o arquivo", () => {
    expect(() => parseNubankCsv("a".repeat(MAX_IMPORT_BYTES + 1))).toThrow(/2 MB/);
    expect(() => parseNubankCsv("date,title,amount\n" + "2026-10-14,Loja,1\n".repeat(MAX_IMPORT_ROWS + 1))).toThrow(/500/);
    expect(parseNubankCsv("date,title,amount\n" + "2026-10-14,Loja,1\n".repeat(MAX_IMPORT_ROWS))).toHaveLength(MAX_IMPORT_ROWS);
  });
  it("mantém a mesma chave quando a planilha muda a representação do valor e da data", () => {
    const a = parseNubankCsv('date,title,amount\n2026-10-14,Loja,12.30')[0];
    const b = parseNubankCsv('Data;Descrição;Valor\n14/10/2026;Loja;12,30')[0];
    expect(a.sourceKey).toBe(b.sourceKey);
  });
});

describe("valores e datas do extrato", () => {
  it.each([["11,95", 1195], ["11.95", 1195], ["12", 1200], ["-100,00", -10000], ["1.234,56", 123456], ["R$ 0,01", 1], ["-0.00", 0]])("converte %s sem perda de centavos", (source, expected) => expect(parseStatementAmount(String(source))).toBe(expected));
  it.each(["NaN", "Infinity", "1e3", "12.345", "12,345", "1.2.3", "1,00R$", "90.000.000.000,01"])("rejeita valor ambíguo ou fora do limite %s", source => expect(() => parseStatementAmount(source)).toThrow());
  it.each(["2026-02-30", "30/02/2026", "1899-01-01", "2200-01-01", "20261014"])("rejeita a data %s", source => expect(() => normalizeStatementDate(source)).toThrow());
});

describe("identificação e confirmação da importação", () => {
  it("produz o mesmo ID no reenvio e separa cartões e competências", async () => {
    const key = parseNubankCsv(csv)[0].sourceKey;
    const id = await invoiceImportId("card", "2026-10", key);
    expect(id).toMatch(/^nu_[a-f0-9]{64}$/);
    expect(await invoiceImportId("card", "2026-10", key)).toBe(id);
    expect(await invoiceImportId("outro", "2026-10", key)).not.toBe(id);
    expect(await invoiceImportId("card", "2026-11", key)).not.toBe(id);
    expect(await invoiceImportId("card", "2026-10", parseNubankCsv(csv)[1].sourceKey)).not.toBe(id);
  });
  it("aceita só a seleção revisada e normaliza a descrição", () => {
    expect(validateInvoiceImport([{ ...item, description: "  Compra de exemplo  " }], "2026-10")).toEqual([item]);
    expect(() => validateInvoiceImport([], "2026-10")).toThrow();
    expect(() => validateInvoiceImport([item, item], "2026-10")).toThrow(/repetidos/);
    expect(() => validateInvoiceImport([item], "2026-13")).toThrow();
  });
  it.each([{ amount: -1 }, { amount: 0 }, { amount: 1.5 }, { id: "invalido" }, { categoryId: "" }, { categoryId: "a".repeat(121) }, { date: "2026-02-30" }, { description: "a" }])("recusa lançamento inválido antes de acessar o banco: %j", patch => expect(() => validateInvoiceImport([{ ...item, ...patch }], "2026-10")).toThrow());
  it("limita a seleção e as categorias para uma gravação atômica", () => {
    const items = Array.from({ length: 201 }, (_, index) => ({ ...item, id: `nu_${index.toString(16).padStart(64, "0")}` }));
    expect(() => validateInvoiceImport(items, "2026-10")).toThrow(/200/);
    expect(validateInvoiceImport(items.slice(0, 200), "2026-10")).toHaveLength(200);
    expect(() => validateInvoiceImport(items.slice(0, 11).map((value, index) => ({ ...value, categoryId: `c${index}` })), "2026-10")).toThrow(/10 categorias/);
  });
});
