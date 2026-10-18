import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
let env: RulesTestEnvironment;
const createdAt = "2026-10-16T12:00:00.000Z";
const account = { name:"Banco",type:"Conta corrente",initialBalance:10000,color:"#167459",archived:false,createdAt };
const category = { name:"Comida",type:"expense",color:"#167459",icon:"tag",archived:false,createdAt };
const entry = { kind:"expense",description:"Almoço",amount:1000,date:"2026-10-16",dueDate:"",status:"settled",accountId:"a",toAccountId:"",categoryId:"c",cardId:"",invoiceMonth:"",groupId:"",installment:0,installments:0,notes:"",recurrenceId:"",createdAt };
beforeAll(async () => { env = await initializeTestEnvironment({projectId:"demo-financeiro",firestore:{host:"127.0.0.1",port:8080,rules:readFileSync("firestore.rules","utf8")}}); }, 30000);
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await env.withSecurityRulesDisabled(async ctx => { const db=ctx.firestore(); await setDoc(doc(db,"users/alice/accounts/a"),account); await setDoc(doc(db,"users/alice/accounts/b"),account); await setDoc(doc(db,"users/alice/categories/c"),category); await setDoc(doc(db,"users/alice/cards/card"),{name:"Cartão",limit:100000,closingDay:5,dueDay:15,color:"#167459",archived:false,revision:1,createdAt}); }); });
describe("isolamento e validação no Firestore", () => {
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
});
