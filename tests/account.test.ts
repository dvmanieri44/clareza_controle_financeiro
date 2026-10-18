import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { collections } from "@/lib/domain/types";

type Ref = { path: string };
type Document = Record<string, unknown>;
const state = vi.hoisted(() => ({ documents: new Map<string, Document>(), events: [] as string[], failBatch: false, failAuthDelete: false, failReauth: false, currentUid: "alice" }));
vi.mock("@/lib/firebase/client", () => ({ firebase: () => ({ db: {}, auth: { currentUser: { uid: state.currentUid } } }) }));
vi.mock("@/lib/firebase/repository", () => ({ userCollection: (uid: string, key: string) => ({ path: `users/${uid}/${key}` }) }));
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: async () => { state.events.push("reauth"); if (state.failReauth) throw new Error("Senha incorreta"); },
  updatePassword: async () => { state.events.push("password"); },
  deleteUser: async () => { state.events.push("auth-delete"); if (state.failAuthDelete) throw new Error("Falha no acesso"); },
}));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
  limit: (count: number) => count,
  query: (ref: Ref, count: number) => ({ ...ref, count }),
  getDocs: async (ref: Ref & { count: number }) => {
    const docs = [...state.documents.keys()].filter(path => path.startsWith(ref.path + "/")).slice(0, ref.count).map(path => ({ ref: { path } }));
    return { empty: !docs.length, docs };
  },
  deleteDoc: async (ref: Ref) => { state.events.push("profile-delete"); state.documents.delete(ref.path); },
  runTransaction: async (_db: unknown, work: (tx: { get: (ref: Ref) => Promise<{ data: () => Document | undefined }>; set: (ref: Ref, data: Document) => void }) => Promise<void>) => work({
    get: async ref => ({ data: () => state.documents.get(ref.path) }),
    set: (ref, data) => { state.events.push("mark"); state.documents.set(ref.path, data); },
  }),
  writeBatch: () => {
    const refs: Ref[] = [];
    return { delete: (ref: Ref) => refs.push(ref), commit: async () => {
      state.events.push(`batch:${refs.length}`);
      if (state.failBatch) throw new Error("Sem conexão");
      refs.forEach(ref => state.documents.delete(ref.path));
    } };
  },
}));
import { changeAccountPassword, deleteAccount, passwordChangeSchema } from "@/lib/firebase/account";

const user = { uid: "alice", email: "alice@example.test", getIdToken: async () => { state.events.push("token"); return "token"; } } as unknown as User;
beforeEach(() => {
  state.documents.clear(); state.events.length = 0; state.failBatch = false; state.failAuthDelete = false; state.failReauth = false; state.currentUid = "alice";
  state.documents.set("users/alice", { createdAt: "2026-10-01T00:00:00.000Z", version: 1 });
});
describe("segurança e exclusão de conta", () => {
  it("valida confirmação, tamanho e diferença da nova senha antes de acessar o Firebase", async () => {
    expect(passwordChangeSchema.safeParse({ currentPassword: "anterior123", newPassword: "nova12345", confirmation: "diferente" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ currentPassword: "anterior123", newPassword: "anterior123", confirmation: "anterior123" }).success).toBe(false);
    await expect(changeAccountPassword(user, { currentPassword: "anterior123", newPassword: "curta", confirmation: "curta" })).rejects.toThrow();
    expect(state.events).toEqual([]);
  });
  it("confirma a identidade e atualiza o token antes de trocar a senha", async () => {
    await changeAccountPassword(user, { currentPassword: "anterior123", newPassword: "nova12345", confirmation: "nova12345" });
    expect(state.events).toEqual(["reauth", "token", "password"]);
  });
  it("exige confirmação e não altera dados se a senha estiver incorreta", async () => {
    await expect(deleteAccount(user, "senha", "excluir")).rejects.toThrow(/EXCLUIR/);
    expect(state.events).toEqual([]);
    state.failReauth = true;
    await expect(deleteAccount(user, "errada", "EXCLUIR")).rejects.toThrow(/Senha/);
    expect(state.events).toEqual(["reauth"]);
    expect(state.documents.get("users/alice")).not.toHaveProperty("deletionStartedAt");
  });
  it("rejeita sessão trocada e senha ausente", async () => {
    state.currentUid = "bob";
    await expect(deleteAccount(user, "senha", "EXCLUIR")).rejects.toThrow(/sessão mudou/);
    state.currentUid = "alice";
    await expect(deleteAccount(user, "", "EXCLUIR")).rejects.toThrow(/senha atual/);
    expect(state.events).toEqual([]);
  });
  it("apaga todas as coleções em lotes, preserva terceiros e só então remove perfil e acesso", async () => {
    for (const collection of collections) state.documents.set(`users/alice/${collection}/one`, { name: "registro" });
    for (let index = 0; index < 401; index++) state.documents.set(`users/alice/entries/${index}`, { amount: 100 });
    state.documents.set("users/bob/entries/one", { amount: 999 });
    const progress = vi.fn();
    await deleteAccount(user, "senha", "EXCLUIR", progress);
    expect([...state.documents.keys()]).toEqual(["users/bob/entries/one"]);
    expect(state.events.slice(0, 3)).toEqual(["reauth", "token", "mark"]);
    expect(state.events.filter(event => event.startsWith("batch:")).every(event => Number(event.split(":")[1]) <= 200)).toBe(true);
    expect(state.events.slice(-2)).toEqual(["profile-delete", "auth-delete"]);
    expect(progress).toHaveBeenCalled();
  });
  it("mantém o acesso e a marca de retomada se um lote falhar", async () => {
    state.documents.set("users/alice/entries/one", { amount: 100 }); state.failBatch = true;
    await expect(deleteAccount(user, "senha", "EXCLUIR")).rejects.toThrow(/conexão/);
    expect(state.documents.get("users/alice")).toHaveProperty("deletionStartedAt");
    expect(state.events).not.toContain("auth-delete");
    const startedAt = state.documents.get("users/alice")?.deletionStartedAt;
    state.failBatch = false;
    await deleteAccount(user, "senha", "EXCLUIR");
    expect(startedAt).toBeTruthy(); expect(state.documents.size).toBe(0);
  });
  it("restaura a marca se a remoção do acesso falhar e permite repetir sem recriar dados", async () => {
    state.documents.set("users/alice/entries/one", { amount: 100 }); state.failAuthDelete = true;
    await expect(deleteAccount(user, "senha", "EXCLUIR")).rejects.toThrow(/acesso/);
    expect(state.documents.get("users/alice")).toHaveProperty("deletionStartedAt");
    expect(state.documents.has("users/alice/entries/one")).toBe(false);
    state.failAuthDelete = false;
    await deleteAccount(user, "senha", "EXCLUIR");
    expect(state.documents.size).toBe(0);
  });
  it("impede duas exclusões simultâneas na mesma sessão", async () => {
    let release: () => void = () => {};
    const blocked = new Promise<string>(resolve => { release = () => resolve("token"); });
    const slowUser = { ...user, getIdToken: () => blocked } as User;
    const first = deleteAccount(slowUser, "senha", "EXCLUIR");
    await expect(deleteAccount(user, "senha", "EXCLUIR")).rejects.toThrow(/já está em andamento/);
    release(); await first;
  });
});
