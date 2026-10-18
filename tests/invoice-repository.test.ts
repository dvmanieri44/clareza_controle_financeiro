import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceImportItem } from "@/lib/domain/invoice-import";

type Document = Record<string, unknown>;
type Ref = { path: string };
type Write = { ref: Ref; data: Document; update: boolean };
const state = vi.hoisted(() => ({ documents: new Map<string, Document>(), writes: [] as Write[], transactions: 0 }));
vi.mock("@/lib/firebase/client", () => ({ firebase: () => ({ db: {} }) }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join("/") }),
  doc: (parent: Ref, id: string) => ({ path: `${parent.path}/${id}` }),
  getDocs: vi.fn(),
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
import { importInvoice } from "@/lib/firebase/repository";

const item: InvoiceImportItem = { id: `nu_${"a".repeat(64)}`, date: "2026-09-20", description: "Loja de exemplo - Parcela 3/10", amount: 1299, categoryId: "c" };
beforeEach(() => {
  state.documents.clear(); state.writes.length = 0; state.transactions = 0;
  state.documents.set("users/u/cards/card", { name: "Cartão", revision: 1, archived: false, dueDay: 31 });
  state.documents.set("users/u/categories/c", { type: "expense", archived: false });
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
});
