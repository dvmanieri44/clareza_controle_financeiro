import { afterEach, describe, expect, it, vi } from "vitest";
import { deletionRemembered, forgetDeletion, rememberDeletion } from "@/lib/firebase/deletion-state";

afterEach(() => vi.unstubAllGlobals());
describe("retomada local da exclusão", () => {
  it("guarda apenas a marca por usuário e limpa ao concluir", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    expect(deletionRemembered("alice")).toBe(false);
    rememberDeletion("alice");
    expect(deletionRemembered("alice")).toBe(true);
    expect(deletionRemembered("bob")).toBe(false);
    expect([...values.values()]).toEqual(["pending"]);
    forgetDeletion("alice");
    expect(deletionRemembered("alice")).toBe(false);
  });
  it("funciona quando o navegador bloqueia ou não oferece armazenamento", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(deletionRemembered("alice")).toBe(false);
    expect(() => { rememberDeletion("alice"); forgetDeletion("alice"); }).not.toThrow();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Bloqueado"); }, setItem: () => { throw new Error("Bloqueado"); }, removeItem: () => { throw new Error("Bloqueado"); } });
    expect(deletionRemembered("alice")).toBe(false);
    expect(() => { rememberDeletion("alice"); forgetDeletion("alice"); }).not.toThrow();
  });
});
