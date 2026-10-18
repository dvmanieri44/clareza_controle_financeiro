import { collection, doc, getDocs, runTransaction, type DocumentData, type Transaction } from "firebase/firestore";
import { firebase } from "./client";
import type { Account, Card, CollectionMap, CollectionName, Entry, Goal, Investment, Recurrence } from "../domain/types";
import { firstInvoiceMonth, goalAfterMovement, invoiceTotal, monthDate, paymentId, recurrenceOccurrences, shiftMonth, splitInstallments, today } from "../domain/finance";
import { accountSchema, cardSchema, cents, date, entrySchema, name, positiveCents } from "../domain/schemas";
import { z } from "zod";
import { validateInvoiceImport, type InvoiceImportItem } from "../domain/invoice-import";

export function userCollection(uid: string, key: CollectionName) { return collection(firebase().db, "users", uid, key); }
function ref(uid: string, key: CollectionName, id?: string) { return id ? doc(userCollection(uid, key), id) : doc(userCollection(uid, key)); }
const stamp = () => new Date().toISOString();
const emptyEntry = { accountId: "", toAccountId: "", categoryId: "", cardId: "", invoiceMonth: "", groupId: "", installment: 0, installments: 0, notes: "", recurrenceId: "", dueDate: "" };
async function requireActive(tx: Transaction, uid: string, key: "accounts" | "cards" | "categories", id: string) {
  const snap = await tx.get(ref(uid, key, id));
  if (!snap.exists() || snap.data().archived) throw new Error("O registro selecionado não está mais disponível.");
  return snap.data();
}
export function errorMessage(error: unknown) {
  const code = (error as { code?: string }).code || "";
  if (code.includes("permission-denied")) return "Acesso negado. Confira as regras publicadas no Firestore.";
  if (code.includes("unavailable") || code.includes("network")) return "Sem conexão com o Firebase. Verifique a internet e tente novamente.";
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) return "E-mail ou senha inválidos.";
  if (code.includes("email-already-in-use")) return "Este e-mail já está cadastrado.";
  if (code.includes("too-many-requests")) return "Muitas tentativas. Aguarde alguns minutos.";
  if (code.includes("weak-password")) return "Use uma senha com pelo menos 8 caracteres.";
  if (code.includes("invalid-api-key")) return "A configuração do Firebase é inválida. Verifique .env.local.";
  if (code.includes("auth/operation-not-allowed")) return "Habilite o provedor E-mail/senha no Firebase Authentication.";
  if (code.includes("auth/unauthorized-domain")) return "Adicione este domínio aos domínios autorizados do Firebase Authentication.";
  if (code.includes("auth/invalid-email")) return "Informe um e-mail válido.";
  if (error instanceof z.ZodError) return error.issues[0]?.message || "Verifique os campos.";
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}
export async function initializeUser(uid: string) {
  const db = firebase().db;
  const profile = doc(db, "users", uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(profile);
    if (snap.exists()) return;
    tx.set(profile, { createdAt: stamp(), version: 1 });
    const defaults = [
      ["alimentacao", "Alimentação", "expense", "#f59e0b", "utensils"], ["moradia", "Moradia", "expense", "#8b5cf6", "home"],
      ["transporte", "Transporte", "expense", "#3b82f6", "car"], ["saude", "Saúde", "expense", "#ec4899", "heart"],
      ["educacao", "Educação", "expense", "#06b6d4", "book"], ["lazer", "Lazer", "expense", "#f97316", "sparkles"],
      ["salario", "Salário", "income", "#10b981", "wallet"], ["outros-receita", "Outras receitas", "income", "#14b8a6", "tag"],
      ["outros-despesa", "Outras despesas", "expense", "#64748b", "tag"],
    ];
    for (const [id, categoryName, type, color, icon] of defaults) tx.set(ref(uid, "categories", id), { name: categoryName, type, color, icon, archived: false, createdAt: stamp() });
  });
}
export async function saveAccount(uid: string, data: z.infer<typeof accountSchema>, id?: string) {
  const valid = accountSchema.parse(data); const target = ref(uid, "accounts", id);
  await runTransaction(firebase().db, async tx => {
    const previous = await tx.get(target);
    if (previous.exists() && previous.data().initialBalance !== valid.initialBalance) throw new Error("O saldo inicial é fixo após o cadastro. Registre uma movimentação para ajustar o saldo.");
    tx.set(target, { ...valid, archived: previous.data()?.archived || false, createdAt: previous.data()?.createdAt || stamp() });
  });
}
export async function saveCategory(uid: string, data: Pick<CollectionMap["categories"], "name" | "type" | "color" | "icon">, id?: string) {
  const valid = z.object({ name, type: z.enum(["income", "expense"]), color: z.string().regex(/^#[a-fA-F0-9]{6}$/), icon: z.enum(["tag", "utensils", "home", "car", "heart", "book", "sparkles", "wallet"]) }).parse(data);
  const target = ref(uid, "categories", id);
  await runTransaction(firebase().db, async tx => { const old = await tx.get(target); if (old.exists() && old.data().type !== valid.type) throw new Error("O tipo de uma categoria existente não pode ser alterado."); tx.set(target, { ...valid, archived: old.data()?.archived || false, createdAt: old.data()?.createdAt || stamp() }); });
}
// Referências permanecem válidas: registros mestres são arquivados, nunca removidos.
export async function archive(uid: string, key: "accounts" | "categories" | "cards" | "goals" | "investments" | "recurrences", id: string, archived = true) {
  await runTransaction(firebase().db, async tx => {
    const target = ref(uid, key, id); const snap = await tx.get(target); if (!snap.exists()) throw new Error("Registro não encontrado.");
    tx.update(target, { archived, ...(key === "cards" ? { revision: (snap.data().revision || 0) + 1 } : {}) });
  });
}
export async function saveEntry(uid: string, data: z.infer<typeof entrySchema>, id?: string) {
  const valid = entrySchema.parse(data); const target = ref(uid, "entries", id);
  await runTransaction(firebase().db, async tx => {
    const old = await tx.get(target);
    const category = await requireActive(tx, uid, "categories", valid.categoryId);
    await requireActive(tx, uid, "accounts", valid.accountId);
    if (category.type !== valid.kind) throw new Error("A categoria deve corresponder ao tipo da movimentação.");
    if (old.exists() && !["income", "expense"].includes(old.data().kind)) throw new Error("Utilize o módulo de origem desta operação.");
    tx.set(target, { ...emptyEntry, ...valid, recurrenceId: old.data()?.recurrenceId || "", createdAt: old.data()?.createdAt || stamp() });
  });
}
export async function deleteEntry(uid: string, id: string) {
  await runTransaction(firebase().db, async tx => { const target = ref(uid, "entries", id); const snap = await tx.get(target); if (!snap.exists()) return;
    if (snap.data().recurrenceId) throw new Error("Ocorrências recorrentes devem ser editadas. A exclusão permitiria gerá-las novamente.");
    if (!["income", "expense", "transfer"].includes(snap.data().kind)) throw new Error("Esta operação deve ser gerenciada no módulo de cartões."); tx.delete(target);
  });
}
export async function settleEntry(uid: string, id: string) { await runTransaction(firebase().db, async tx => { const target = ref(uid, "entries", id); const snap = await tx.get(target); if (!snap.exists() || !["income", "expense"].includes(snap.data().kind)) throw new Error("Movimentação inválida."); tx.update(target, { status: "settled", date: today() }); }); }
export async function transfer(uid: string, fromId: string, toId: string, amount: number, transferDate: string) {
  positiveCents.parse(amount); date.parse(transferDate); if (fromId === toId) throw new Error("Escolha contas diferentes.");
  await runTransaction(firebase().db, async tx => {
    await requireActive(tx, uid, "accounts", fromId); await requireActive(tx, uid, "accounts", toId);
    tx.set(ref(uid, "entries"), { ...emptyEntry, kind: "transfer", description: "Transferência entre contas", accountId: fromId, toAccountId: toId, amount, date: transferDate, status: "settled", createdAt: stamp() });
  });
}
export async function saveCard(uid: string, data: z.infer<typeof cardSchema>, id?: string) {
  const valid = cardSchema.parse(data); const target = ref(uid, "cards", id);
  await runTransaction(firebase().db, async tx => { const old = await tx.get(target); tx.set(target, { ...valid, archived: old.data()?.archived || false, revision: (old.data()?.revision || 0) + 1, createdAt: old.data()?.createdAt || stamp() }); });
}
export async function purchase(uid: string, input: { cardId: string; description: string; amount: number; date: string; categoryId: string; installments: number; notes: string }) {
  name.parse(input.description); date.parse(input.date); positiveCents.parse(input.amount); z.string().max(1000).parse(input.notes);
  z.number().int().min(1).max(12, "Use no máximo 12 parcelas por compra.").parse(input.installments);
  const amounts = splitInstallments(input.amount, input.installments); const group = ref(uid, "entries").id;
  await runTransaction(firebase().db, async tx => {
    const card = await requireActive(tx, uid, "cards", input.cardId) as Omit<Card, "id">;
    const category = await requireActive(tx, uid, "categories", input.categoryId); if (category.type !== "expense") throw new Error("Selecione uma categoria de despesa.");
    const first = firstInvoiceMonth(input.date, card);
    const months = amounts.map((_, i) => shiftMonth(first, i));
    for (const month of months) { const paid = await tx.get(ref(uid, "entries", paymentId(input.cardId, month))); if (paid.exists()) throw new Error("Uma das faturas já foi paga. Ajuste a data da compra."); }
    amounts.forEach((amount, i) => tx.set(ref(uid, "entries", `${group}_${i + 1}`), { ...emptyEntry, ...input, amount, kind: "purchase", status: "pending", groupId: group, installment: i + 1, invoiceMonth: months[i], dueDate: monthDate(months[i], card.dueDay), createdAt: stamp() }));
    tx.update(ref(uid, "cards", input.cardId), { revision: card.revision + 1 });
  });
}
export async function payInvoice(uid: string, cardId: string, month: string, accountId: string, paidDate: string) {
  date.parse(paidDate);
  // A revisão do cartão serializa compras, exclusões e pagamentos concorrentes.
  const cardRef = ref(uid, "cards", cardId); const paymentRef = ref(uid, "entries", paymentId(cardId, month));
  for (let attempt = 0; attempt < 5; attempt++) {
    const { getDoc } = await import("firebase/firestore");
    const before = await getDoc(cardRef);
    if (!before.exists()) throw new Error("Cartão não encontrado.");
    const all = await getDocs(userCollection(uid, "entries"));
    const total = invoiceTotal(all.docs.map(d => ({ ...d.data(), id: d.id }) as Entry), cardId, month);
    if (total <= 0) throw new Error("Esta fatura não possui compras.");
    try {
      await runTransaction(firebase().db, async tx => {
        const card = await tx.get(cardRef); const paid = await tx.get(paymentRef); await requireActive(tx, uid, "accounts", accountId);
        if (paid.exists()) throw new Error("Esta fatura já foi paga.");
        if (card.data()?.revision !== before.data().revision) throw new Error("CARD_CHANGED");
        tx.set(paymentRef, { ...emptyEntry, kind: "invoicePayment", description: `Fatura ${card.data()?.name} · ${month}`, amount: total, date: paidDate, status: "settled", accountId, cardId, invoiceMonth: month, createdAt: stamp() });
        tx.update(cardRef, { revision: card.data()!.revision + 1 });
      }); return;
    } catch (error) { if ((error as Error).message !== "CARD_CHANGED") throw error; }
  }
  throw new Error("A fatura foi alterada. Tente novamente.");
}
export async function cancelPurchase(uid: string, entry: Entry) {
  const ids = Array.from({ length: entry.installments }, (_, i) => `${entry.groupId}_${i + 1}`);
  await runTransaction(firebase().db, async tx => {
    const cardRef = ref(uid, "cards", entry.cardId); const card = await tx.get(cardRef);
    const originals = await Promise.all(ids.map(id => tx.get(ref(uid, "entries", id))));
    for (const snapshot of originals) {
      if (!snapshot.exists()) throw new Error("A compra já foi alterada. Atualize a página.");
      const live = snapshot.data() as Entry;
      if (live.kind !== "purchase" || live.groupId !== entry.groupId || live.cardId !== entry.cardId) throw new Error("Grupo de parcelas inconsistente.");
      const paid = await tx.get(ref(uid, "entries", paymentId(live.cardId, live.invoiceMonth))); if (paid.exists()) throw new Error("Compras de faturas pagas não podem ser excluídas.");
    }
    originals.forEach(s => { if (s.exists()) tx.delete(s.ref); });
    tx.update(cardRef, { revision: card.data()!.revision + 1 });
  });
}
export async function saveBudget(uid: string, categoryId: string, month: string, amount: number) {
  const { month: monthSchema } = await import("../domain/schemas"); monthSchema.parse(month); positiveCents.parse(amount);
  await runTransaction(firebase().db, async tx => { const category = await requireActive(tx, uid, "categories", categoryId); if (category.type !== "expense") throw new Error("Selecione uma categoria de despesa."); const target = ref(uid, "budgets", `${categoryId}_${month}`); const old = await tx.get(target); tx.set(target, { categoryId, month, amount, createdAt: old.data()?.createdAt || stamp() }); });
}
export async function deleteBudget(uid: string, id: string) { const { deleteDoc } = await import("firebase/firestore"); await deleteDoc(ref(uid, "budgets", id)); }
export async function saveGoal(uid: string, data: { name: string; target: number; deadline: string }, id?: string) {
  name.parse(data.name); positiveCents.parse(data.target); if (data.deadline) date.parse(data.deadline);
  const target = ref(uid, "goals", id);
  await runTransaction(firebase().db, async tx => { const old = await tx.get(target); tx.set(target, { ...data, current: old.data()?.current || 0, lastMovementId: old.data()?.lastMovementId || "", archived: old.data()?.archived || false, createdAt: old.data()?.createdAt || stamp() }); });
}
export async function moveGoal(uid: string, goalId: string, amount: number, notes: string) {
  z.number().int().min(-9_000_000_000_000).max(9_000_000_000_000).refine(v => v !== 0).parse(amount); z.string().max(1000).parse(notes);
  await runTransaction(firebase().db, async tx => { const target = ref(uid, "goals", goalId); const snap = await tx.get(target); if (!snap.exists() || snap.data().archived) throw new Error("Meta indisponível."); const goal = snap.data() as Goal;
    const movement = ref(uid, "goalMovements");
    tx.update(target, { current: goalAfterMovement(goal.current, amount), lastMovementId: movement.id });
    tx.set(movement, { goalId, amount, notes, date: today(), createdAt: stamp() });
  });
}
export async function saveInvestment(uid: string, data: Pick<Investment, "name" | "type" | "institution" | "invested" | "current" | "date">, id?: string) {
  name.parse(data.name); name.parse(data.institution); cents.parse(data.invested); cents.parse(data.current); date.parse(data.date); z.enum(["CDB", "Tesouro Direto", "LCI", "LCA", "Ações", "Fundos", "Outros"]).parse(data.type);
  const target = ref(uid, "investments", id);
  await runTransaction(firebase().db, async tx => { const old = await tx.get(target); if (old.exists() && data.date < old.data().date) throw new Error("A data de referência deve ser igual ou posterior à anterior."); tx.set(target, { ...data, archived: old.data()?.archived || false, createdAt: old.data()?.createdAt || stamp() }); tx.set(ref(uid, "snapshots"), { investmentId: target.id, invested: data.invested, current: data.current, date: data.date, createdAt: stamp() }); });
}
export async function saveRecurrence(uid: string, data: Omit<Recurrence, "id" | "createdAt" | "archived">) {
  name.parse(data.description); positiveCents.parse(data.amount); date.parse(data.startDate); if (data.endDate) { date.parse(data.endDate); if (data.endDate < data.startDate) throw new Error("O fim deve ser posterior ao início."); } z.enum(["income", "expense"]).parse(data.kind); z.string().max(1000).parse(data.notes);
  await runTransaction(firebase().db, async tx => { await requireActive(tx, uid, "accounts", data.accountId); const cat = await requireActive(tx, uid, "categories", data.categoryId); if (cat.type !== data.kind) throw new Error("Categoria incompatível."); tx.set(ref(uid, "recurrences"), { ...data, archived: false, createdAt: stamp() }); });
}
export async function generateRecurrences(uid: string, rules: Recurrence[], through: string) {
  date.parse(through); let count = 0;
  for (const rule of rules.filter(r => !r.archived)) {
    const added = await runTransaction(firebase().db, async tx => {
      const current = await tx.get(ref(uid, "recurrences", rule.id)); if (!current.exists() || current.data().archived) return 0;
      const live = { ...current.data(), id: rule.id } as Recurrence;
      await requireActive(tx, uid, "accounts", live.accountId); await requireActive(tx, uid, "categories", live.categoryId);
      const dates = recurrenceOccurrences(live, through);
      const existing = await Promise.all(dates.map(d => tx.get(ref(uid, "entries", d.id)))); let created = 0;
      dates.forEach((d, i) => { if (existing[i].exists()) return; created++; tx.set(ref(uid, "entries", d.id), { ...emptyEntry, kind: live.kind, description: live.description, amount: live.amount, accountId: live.accountId, categoryId: live.categoryId, date: d.date, dueDate: d.date, notes: live.notes, recurrenceId: rule.id, status: "pending", createdAt: stamp() }); }); return created;
    }); count += added;
  }
  return count;
}
export async function importInvoice(uid: string, cardId: string, month: string, items: InvoiceImportItem[]) {
  const valid = validateInvoiceImport(items, month);
  const db = firebase().db;
  return runTransaction(db, async tx => {
    const targets = valid.map(item => ref(uid, "entries", `${item.id}_1`));
    const existing = await Promise.all(targets.map(target => tx.get(target)));
    const pending = valid.flatMap((item, index) => existing[index].exists() ? [] : [{ item, target: targets[index] }]);
    if (!pending.length) return { added: 0, skipped: valid.length };
    const card = await requireActive(tx, uid, "cards", cardId) as Omit<Card, "id">;
    const paid = await tx.get(ref(uid, "entries", paymentId(cardId, month)));
    if (paid.exists()) throw new Error("Esta fatura já foi paga. Não é possível adicionar compras.");
    for (const categoryId of new Set(pending.map(({ item }) => item.categoryId))) {
      const category = await requireActive(tx, uid, "categories", categoryId);
      if (category.type !== "expense") throw new Error("Use categorias de despesa para importar compras.");
    }
    // Todas as leituras precedem as escritas; cada linha é somente a parcela desta fatura.
    for (const { item, target } of pending) tx.set(target, {
      ...emptyEntry, kind: "purchase", status: "pending", cardId, invoiceMonth: month,
      description: item.description, date: item.date, amount: item.amount, categoryId: item.categoryId,
      dueDate: monthDate(month, card.dueDay), groupId: item.id, installment: 1, installments: 1,
      notes: "Importado do CSV Nubank. Lançamento somente desta fatura; não gera parcelas futuras.", createdAt: stamp(),
    });
    tx.update(ref(uid, "cards", cardId), { revision: card.revision + 1 });
    return { added: pending.length, skipped: valid.length - pending.length };
  });
}
// Tipos auxiliares exportados para a camada de interface.
export type { Account, DocumentData };
