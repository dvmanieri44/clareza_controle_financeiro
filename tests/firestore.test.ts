import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
const queryContext = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/firebase/client", () => ({ firebase: () => ({ db: queryContext.db }) }));
import { getHistoryPage, getHistorySummary } from "@/lib/firebase/history";
import { totalBalance } from "@/lib/firebase/finance-queries";
import type { HistoryCursor, HistoryFilters } from "@/lib/domain/history";
let env: RulesTestEnvironment;
const createdAt = "2026-10-16T12:00:00.000Z";
const account = { name:"Banco",type:"Conta corrente",initialBalance:10000,color:"#167459",archived:false,createdAt };
const category = { name:"Comida",type:"expense",color:"#167459",icon:"tag",archived:false,createdAt };
const entry = { kind:"expense",description:"Almoço",amount:1000,date:"2026-10-16",dueDate:"",status:"settled",accountId:"a",toAccountId:"",categoryId:"c",cardId:"",invoiceMonth:"",groupId:"",installment:0,installments:0,notes:"",recurrenceId:"",createdAt };
beforeAll(async () => { env = await initializeTestEnvironment({projectId:"demo-financeiro",firestore:{host:"127.0.0.1",port:8080,rules:readFileSync("firestore.rules","utf8")}}); }, 30000);
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await env.withSecurityRulesDisabled(async ctx => { const db=ctx.firestore(); await setDoc(doc(db,"users/alice/accounts/a"),account); await setDoc(doc(db,"users/alice/accounts/b"),account); await setDoc(doc(db,"users/alice/categories/c"),category); await setDoc(doc(db,"users/alice/cards/card"),{name:"Cartão",limit:100000,closingDay:5,dueDay:15,color:"#167459",archived:false,revision:1,createdAt}); }); });
describe("isolamento e validação no Firestore", () => {
  it("executa paginação e agregações reais no emulador e bloqueia consultas entre usuários", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore(); const batch = writeBatch(db);
      for (let index = 0; index < 60; index++) batch.set(doc(db, `users/alice/entries/e${String(index).padStart(3, "0")}`), entry);
      batch.set(doc(db, "users/alice/entries/imported"), { ...entry, kind: "purchase", accountId: "", cardId: "card", status: "pending", invoiceMonth: "2026-10", date: "2026-09-01", dueDate: "2026-10-15", amount: 5000, groupId: "imported", installment: 1, installments: 1 });
      await batch.commit();
    });
    queryContext.db = env.authenticatedContext("alice").firestore();
    const filters: HistoryFilters = { month: "2026-10", kind: "", accountId: "", categoryId: "", startDate: "", endDate: "", search: "", sort: "date-desc" };
    const ids: string[] = []; let cursor: HistoryCursor | null = null;
    do { const page = await getHistoryPage("alice", filters, cursor); ids.push(...page.entries.map(entry => entry.id)); cursor = page.next; } while (cursor);
    expect(ids).toHaveLength(61); expect(new Set(ids).size).toBe(61);
    expect(await getHistorySummary("alice", filters)).toEqual({ count: 61, income: 0, expense: 65000 });
    expect(await totalBalance("alice", [], "2026-10-31")).toBe(-60000);
    const byAmount = { ...filters, sort: "amount-desc" as const, startDate: "2026-09-01", endDate: "2026-10-31" };
    expect((await getHistoryPage("alice", byAmount)).entries[0].id).toBe("imported");
    queryContext.db = env.authenticatedContext("bob").firestore();
    await assertFails(getHistoryPage("alice", filters));
    await assertFails(getHistorySummary("alice", filters));
  }, 30000);
  it("permite o proprietário e bloqueia terceiros e anônimos", async () => { const alice=env.authenticatedContext("alice").firestore(); const bob=env.authenticatedContext("bob").firestore(); const anon=env.unauthenticatedContext().firestore(); await assertSucceeds(getDoc(doc(alice,"users/alice/accounts/a"))); await assertFails(getDoc(doc(bob,"users/alice/accounts/a"))); await assertFails(getDoc(doc(anon,"users/alice/accounts/a"))); await assertFails(setDoc(doc(bob,"users/alice/entries/e"),entry)); });
  it("rejeita valores inválidos, extras e referências inexistentes", async () => { const db=env.authenticatedContext("alice").firestore(); await assertSucceeds(setDoc(doc(db,"users/alice/entries/e"),entry)); for (const patch of [{amount:1.5},{amount:-1},{amount:9000000000001},{accountId:"missing"},{categoryId:"missing"},{kind:"income"},{admin:true},{date:"bad"},{status:"paid"}]) await assertFails(setDoc(doc(db,"users/alice/entries/invalid"),{...entry,...patch})); });
  it("bloqueia alteração de saldo inicial e exclusões de mestres", async () => { const db=env.authenticatedContext("alice").firestore(); await assertFails(updateDoc(doc(db,"users/alice/accounts/a"),{initialBalance:0})); await assertFails(deleteDoc(doc(db,"users/alice/accounts/a"))); await assertFails(deleteDoc(doc(db,"users/alice/categories/c"))); await assertSucceeds(updateDoc(doc(db,"users/alice/categories/c"),{archived:true})); });
  it("rejeita transferência para a mesma conta", async () => { const db=env.authenticatedContext("alice").firestore(); await assertFails(setDoc(doc(db,"users/alice/entries/t"),{...entry,kind:"transfer",categoryId:"",toAccountId:"a"})); await assertSucceeds(setDoc(doc(db,"users/alice/entries/t"),{...entry,kind:"transfer",categoryId:"",toAccountId:"b"})); });
  it("exige atualização atômica do cartão para compras", async () => { const db=env.authenticatedContext("alice").firestore(); const purchase={...entry,kind:"purchase",accountId:"",cardId:"card",status:"pending",invoiceMonth:"2026-11",dueDate:"2026-11-15",groupId:"g",installment:1,installments:1}; const target=doc(db,"users/alice/entries/p"); await assertFails(setDoc(target,purchase)); const batch=writeBatch(db); batch.set(target,purchase); batch.update(doc(db,"users/alice/cards/card"),{revision:2}); await assertSucceeds(batch.commit()); await assertFails(updateDoc(target,{amount:999})); });
  it("bloqueia compras em fatura paga e pagamento duplicado", async () => { const db=env.authenticatedContext("alice").firestore(); const pay={...entry,kind:"invoicePayment",categoryId:"",cardId:"card",invoiceMonth:"2026-11"}; const payment=doc(db,"users/alice/entries/invoice_card_2026-11"); const batch=writeBatch(db); batch.set(payment,pay); batch.update(doc(db,"users/alice/cards/card"),{revision:2}); await assertSucceeds(batch.commit()); await assertFails(setDoc(payment,pay)); const second=writeBatch(db); second.set(doc(db,"users/alice/entries/p"),{...entry,kind:"purchase",accountId:"",cardId:"card",status:"pending",invoiceMonth:"2026-11",dueDate:"2026-11-15",groupId:"g",installment:1,installments:1}); second.update(doc(db,"users/alice/cards/card"),{revision:3}); await assertFails(second.commit()); });
  it("exige saldo coerente ao registrar aporte", async () => { const db=env.authenticatedContext("alice").firestore(); const goal=doc(db,"users/alice/goals/g"); await assertSucceeds(setDoc(goal,{name:"Viagem",target:10000,current:0,lastMovementId:"",deadline:"",archived:false,createdAt})); const movement=doc(db,"users/alice/goalMovements/m"); const data={goalId:"g",amount:500,date:"2026-10-16",notes:"",createdAt}; await assertFails(setDoc(movement,data)); const batch=writeBatch(db); batch.update(goal,{current:500,lastMovementId:"m"}); batch.set(movement,data); await assertSucceeds(batch.commit()); await assertFails(updateDoc(goal,{current:-1})); });
  it("permite importar 200 compras na mesma revisão sem gerar parcelas futuras", async () => {
    const db = env.authenticatedContext("alice").firestore();
    const batch = writeBatch(db);
    for (let index = 0; index < 200; index++) {
      const id = `nu_${index.toString(16).padStart(64, "0")}`;
      batch.set(doc(db, `users/alice/entries/${id}_1`), { ...entry, kind: "purchase", accountId: "", cardId: "card", status: "pending", invoiceMonth: "2026-11", dueDate: "2026-11-15", groupId: id, installment: 1, installments: 1 });
    }
    batch.update(doc(db, "users/alice/cards/card"), { revision: 2 });
    await assertSucceeds(batch.commit());
  }, 30000);
  it("não permite sobrescrever uma compra já importada", async () => {
    const db = env.authenticatedContext("alice").firestore();
    const id = `nu_${"a".repeat(64)}`;
    const target = doc(db, `users/alice/entries/${id}_1`);
    const purchase = { ...entry, kind: "purchase", accountId: "", cardId: "card", status: "pending", invoiceMonth: "2026-11", dueDate: "2026-11-15", groupId: id, installment: 1, installments: 1 };
    const batch = writeBatch(db); batch.set(target, purchase); batch.update(doc(db, "users/alice/cards/card"), { revision: 2 });
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(target, { ...purchase, amount: 1 }));
  });
  it("nega coleções desconhecidas", async () => { const db=env.authenticatedContext("alice").firestore(); await assertFails(setDoc(doc(db,"users/alice/admin/config"),{enabled:true})); });
  it("isola e valida regras de importação por usuário e categoria", async () => {
    const db = env.authenticatedContext("alice").firestore();
    const other = env.authenticatedContext("bob").firestore();
    const target = doc(db, "users/alice/importRules/rule");
    const rule = { pattern: "mercado", match: "contains", categoryId: "c", createdAt };
    await assertSucceeds(setDoc(target, rule));
    await assertFails(getDoc(doc(other, "users/alice/importRules/rule")));
    await assertFails(setDoc(doc(other, "users/alice/importRules/other"), rule));
    for (const patch of [{ pattern: "" }, { match: "regex" }, { categoryId: "missing" }, { extra: true }]) await assertFails(setDoc(doc(db, "users/alice/importRules/invalid"), { ...rule, ...patch }));
    await assertFails(updateDoc(target, { createdAt: "2026-11-01T00:00:00.000Z" }));
    await assertSucceeds(deleteDoc(target));
    await updateDoc(doc(db, "users/alice/categories/c"), { archived: true });
    await assertFails(setDoc(target, rule));
  });
  it("exige login recente e marca explícita antes de excluir o histórico", async () => {
    const db = env.authenticatedContext("alice", { auth_time: Math.floor(Date.now() / 1000) }).firestore();
    const stale = env.authenticatedContext("alice", { auth_time: Math.floor(Date.now() / 1000) - 3600 }).firestore();
    const profile = doc(db, "users/alice");
    await assertSucceeds(setDoc(profile, { createdAt, version: 1 }));
    await assertFails(deleteDoc(profile));
    await assertFails(updateDoc(doc(stale, "users/alice"), { deletionStartedAt: createdAt }));
    await assertSucceeds(updateDoc(profile, { deletionStartedAt: createdAt }));
    await assertFails(deleteDoc(doc(stale, "users/alice/accounts/a")));
    const other = env.authenticatedContext("bob", { auth_time: Math.floor(Date.now() / 1000) }).firestore();
    await assertFails(deleteDoc(doc(other, "users/alice/accounts/a")));
    await assertSucceeds(deleteDoc(doc(db, "users/alice/accounts/a")));
    await assertSucceeds(deleteDoc(profile));
  });
  it("bloqueia novas gravações e a remoção da marca durante a exclusão", async () => {
    const db = env.authenticatedContext("alice", { auth_time: Math.floor(Date.now() / 1000) }).firestore();
    const profile = doc(db, "users/alice");
    await setDoc(profile, { createdAt, version: 1 });
    await updateDoc(profile, { deletionStartedAt: createdAt });
    await assertFails(setDoc(profile, { createdAt, version: 1 }));
    await assertFails(setDoc(doc(db, "users/alice/accounts/new"), account));
    await assertFails(updateDoc(doc(db, "users/alice/categories/c"), { archived: true }));
    await assertFails(setDoc(doc(db, "users/alice/entries/new"), entry));
    await assertFails(setDoc(doc(db, "users/alice/importRules/new"), { pattern: "loja", match: "exact", categoryId: "c", createdAt }));
    await assertSucceeds(getDoc(doc(db, "users/alice/accounts/a")));
    await assertFails(setDoc(doc(db, "users/alice/unknown/new"), { createdAt }));
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), "users/alice/unknown/new"), { createdAt }); });
    await assertFails(deleteDoc(doc(db, "users/alice/unknown/new")));
  });
  it("permite apagar em lote faturas pagas, mestres e históricos na exclusão de conta", async () => {
    const db = env.authenticatedContext("alice", { auth_time: Math.floor(Date.now() / 1000) }).firestore();
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), "users/alice/entries/invoice_card_2026-11"), { ...entry, kind: "invoicePayment", cardId: "card", invoiceMonth: "2026-11" });
      await setDoc(doc(ctx.firestore(), "users/alice/goalMovements/m"), { goalId: "g", amount: 100, date: "2026-10-18", notes: "", createdAt });
      await setDoc(doc(ctx.firestore(), "users/alice/snapshots/s"), { investmentId: "i", invested: 100, current: 100, date: "2026-10-18", createdAt });
    });
    await setDoc(doc(db, "users/alice"), { createdAt, version: 1 });
    await updateDoc(doc(db, "users/alice"), { deletionStartedAt: createdAt });
    const batch = writeBatch(db);
    for (const path of ["accounts/a", "categories/c", "cards/card", "entries/invoice_card_2026-11", "goalMovements/m", "snapshots/s"]) batch.delete(doc(db, `users/alice/${path}`));
    await assertSucceeds(batch.commit());
  });
  it("permite confirmar 200 compras e 200 regras em até dez categorias no mesmo lote", async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      for (let index = 0; index < 10; index++) await setDoc(doc(ctx.firestore(), `users/alice/categories/c${index}`), category);
    });
    const db = env.authenticatedContext("alice").firestore();
    const batch = writeBatch(db);
    for (let index = 0; index < 200; index++) {
      const categoryId = `c${index % 10}`;
      batch.set(doc(db, `users/alice/entries/import_${index}`), { ...entry, kind: "purchase", accountId: "", cardId: "card", categoryId, status: "pending", invoiceMonth: "2026-11", dueDate: "2026-11-15", groupId: `g${index}`, installment: 1, installments: 1 });
      batch.set(doc(db, `users/alice/importRules/rule_${index}`), { pattern: `loja ${index}`, match: "exact", categoryId, createdAt });
    }
    batch.update(doc(db, "users/alice/cards/card"), { revision: 2 });
    await assertSucceeds(batch.commit());
  }, 30000);
});
