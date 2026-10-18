import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceImportItem } from "@/lib/domain/invoice-import";

type Document = Record<string, unknown>;
type Ref = { path: string };
type Write = { ref: Ref; data: Document; update: boolean };
const state = vi.hoisted(() => ({ documents: new Map<string, Document>(), writes: [] as Write[], transactions: 0 }));
vi.mock("@/lib/firebase/client", () => ({ firebase: () => ({ db: {} }) }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/") }),
  doc: (parent: Ref, ...parts: string[]) => ({ path: [parent.path, ...parts].filter(Boolean).join("/") }),
  getDocs: vi.fn(),
  deleteDoc: async (ref: Ref) => { state.documents.delete(ref.path); },
  runTransaction: async (_db: unknown, work: (tx: { get: (ref: Ref) => Promise<{ exists: () => boolean; data: () => Document | undefined }>; set: (ref: Ref, data: Document) => void; update: (ref: Ref, data: Document) => void }) => Promise<unknown>) => {
    state.transactions++;
    const pending: Write[] = [];
    const result = await work({
      get: async ref => {
        if (pending.length) throw new Error("Leitura após escrita na transação.");
        return { exists: () => state.documents.has(ref.path), data: () => state.documents.get(ref.path) };
      },
      set: (ref, data) => pending.push({ ref, data, update: false }),
      update: (ref, data) => pending.push({ ref, data, update: true }),
    });
    for (const write of pending) state.documents.set(write.ref.path, { ...(write.update ? state.documents.get(write.ref.path) : {}), ...write.data });
    state.writes.push(...pending);
    return result;
  },
}));
import { deleteImportRule, importInvoice, initializeUser, saveImportRule } from "@/lib/firebase/repository";
import { importRuleId } from "@/lib/domain/import-rules";

const item: InvoiceImportItem = { id: `nu_${"a".repeat(64)}`, date: "2026-09-20", description: "Loja de exemplo - Parcela 3/10", amount: 1299, categoryId: "c" };
beforeEach(() => {
  state.documents.clear(); state.writes.length = 0; state.transactions = 0;
  state.documents.set("users/u/cards/card", { name: "Cartão", revision: 1, archived: false, dueDay: 31 });
  state.documents.set("users/u/categories/c", { type: "expense", archived: false });
});
afterEach(() => vi.unstubAllGlobals());
describe("inicialização e retomada da exclusão", () => {
  it("inicializa apenas perfil e categorias de um usuário novo", async () => {
    expect(await initializeUser("new")).toBe(false);
    expect(state.documents.get("users/new")).toMatchObject({ version: 1 });
    expect(state.writes.filter(write => write.ref.path.startsWith("users/new/categories/"))).toHaveLength(9);
    expect(state.writes).toHaveLength(10);
  });
  it("não recria categorias de perfis existentes, inclusive durante exclusão", async () => {
    state.documents.set("users/u", { createdAt: "2026-10-01T00:00:00.000Z", version: 1 });
    expect(await initializeUser("u")).toBe(false);
    state.documents.set("users/u", { createdAt: "2026-10-01T00:00:00.000Z", version: 1, deletionStartedAt: "2026-10-18T00:00:00.000Z" });
    expect(await initializeUser("u")).toBe(true);
    expect(state.writes).toHaveLength(0);
  });
  it("mantém a retomada local mesmo se o perfil já foi removido", async () => {
    vi.stubGlobal("localStorage", { getItem: () => "pending" });
    expect(await initializeUser("u")).toBe(true);
    expect(state.documents.has("users/u")).toBe(false);
    expect(state.writes).toHaveLength(0);
  });
});
describe("gravação da seleção de fatura", () => {
  it("grava somente a parcela da competência escolhida e atualiza a revisão do cartão", async () => {
    expect(await importInvoice("u", "card", "2026-10", [item])).toEqual({ added: 1, skipped: 0 });
    expect(state.documents.get(`users/u/entries/${item.id}_1`)).toMatchObject({ kind: "purchase", amount: 1299, invoiceMonth: "2026-10", dueDate: "2026-10-31", date: "2026-09-20", description: item.description, installment: 1, installments: 1, groupId: item.id, status: "pending" });
    expect(state.writes).toHaveLength(2);
    expect(state.documents.get("users/u/cards/card")?.revision).toBe(2);
  });
  it("não duplica nem altera a revisão ao reenviar os mesmos lançamentos", async () => {
    await importInvoice("u", "card", "2026-10", [item]);
    expect(await importInvoice("u", "card", "2026-10", [item])).toEqual({ added: 0, skipped: 1 });
    expect(state.writes).toHaveLength(2);
  });
  it("preserva duas compras legítimas iguais com identificadores distintos", async () => {
    expect(await importInvoice("u", "card", "2026-10", [item, { ...item, id: `nu_${"b".repeat(64)}` }])).toEqual({ added: 2, skipped: 0 });
    expect(state.writes.filter(write => !write.update)).toHaveLength(2);
  });
  it("não grava nada em uma fatura paga", async () => {
    state.documents.set("users/u/entries/invoice_card_2026-10", { kind: "invoicePayment" });
    await expect(importInvoice("u", "card", "2026-10", [item])).rejects.toThrow(/já foi paga/);
    expect(state.writes).toHaveLength(0);
    expect(state.documents.get("users/u/cards/card")?.revision).toBe(1);
  });
  it.each([{ type: "income", archived: false }, { type: "expense", archived: true }])("não usa categoria de receita ou arquivada", async category => {
    state.documents.set("users/u/categories/c", category);
    await expect(importInvoice("u", "card", "2026-10", [item])).rejects.toThrow();
    expect(state.writes).toHaveLength(0);
  });
  it("rejeita cartão ausente ou arquivado sem gravação parcial", async () => {
    state.documents.delete("users/u/cards/card");
    await expect(importInvoice("u", "card", "2026-10", [item])).rejects.toThrow();
    expect(state.writes).toHaveLength(0);
    state.documents.set("users/u/cards/card", { archived: true });
    await expect(importInvoice("u", "card", "2026-10", [item])).rejects.toThrow();
    expect(state.writes).toHaveLength(0);
  });
  it("valida o valor antes de iniciar a transação", async () => {
    await expect(importInvoice("u", "card", "2026-10", [{ ...item, amount: -100 }])).rejects.toThrow();
    expect(state.transactions).toBe(0);
    expect(state.writes).toHaveLength(0);
  });
  it("salva a regra junto às compras somente quando solicitado e mantém createdAt ao atualizá-la", async () => {
    await importInvoice("u", "card", "2026-10", [item], true);
    const rules = state.writes.filter(write => write.ref.path.includes("/importRules/"));
    expect(rules).toHaveLength(1);
    expect(rules[0].data).toMatchObject({ match: "exact", categoryId: "c", pattern: "loja de exemplo parcela 3 10" });
    const createdAt = rules[0].data.createdAt;
    state.documents.set("users/u/categories/other", { type: "expense", archived: false });
    await importInvoice("u", "card", "2026-11", [{ ...item, id: `nu_${"c".repeat(64)}`, categoryId: "other" }], true);
    expect(state.documents.get(rules[0].ref.path)).toMatchObject({ categoryId: "other", createdAt });
  });
  it("não lembra regras de compras já existentes nem descrições com categorias conflitantes", async () => {
    await importInvoice("u", "card", "2026-10", [item]);
    await importInvoice("u", "card", "2026-10", [item], true);
    expect(state.writes.filter(write => write.ref.path.includes("/importRules/"))).toHaveLength(0);
    state.documents.set("users/u/categories/other", { type: "expense", archived: false });
    await importInvoice("u", "card", "2026-11", [{ ...item, id: `nu_${"d".repeat(64)}` }, { ...item, id: `nu_${"e".repeat(64)}`, categoryId: "other" }], true);
    expect(state.writes.filter(write => write.ref.path.includes("/importRules/"))).toHaveLength(0);
  });
  it("permite criar, atualizar e excluir uma regra sem alterar compras", async () => {
    await saveImportRule("u", "MERCADO!", "contains", "c");
    const id = await importRuleId("mercado", "contains");
    const path = `users/u/importRules/${id}`;
    const createdAt = state.documents.get(path)?.createdAt;
    state.documents.set("users/u/categories/other", { type: "expense", archived: false });
    await saveImportRule("u", "mercado", "contains", "other");
    expect(state.documents.get(path)).toMatchObject({ pattern: "mercado", categoryId: "other", createdAt });
    expect(state.writes.every(write => write.ref.path.includes("/importRules/"))).toBe(true);
    await deleteImportRule("u", id);
    expect(state.documents.has(path)).toBe(false);
  });
  it("não salva regras para categoria inválida ou arquivada", async () => {
    state.documents.set("users/u/categories/income", { type: "income", archived: false });
    state.documents.set("users/u/categories/old", { type: "expense", archived: true });
    for (const id of ["income", "old", "missing"]) await expect(saveImportRule("u", "mercado", "contains", id)).rejects.toThrow();
    expect(state.writes).toHaveLength(0);
  });
});
