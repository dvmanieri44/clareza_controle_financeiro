// Guarda apenas a retomada por UID, nunca senha ou registros financeiros.
const key = (uid: string) => `clareza:account-deletion:${uid}`;
export function deletionRemembered(uid: string): boolean {
  try { return globalThis.localStorage?.getItem(key(uid)) === "pending"; } catch { return false; }
}
export function rememberDeletion(uid: string) {
  try { globalThis.localStorage?.setItem(key(uid), "pending"); } catch { /* O perfil no servidor continua sendo a fonte principal. */ }
}
export function forgetDeletion(uid: string) {
  try { globalThis.localStorage?.removeItem(key(uid)); } catch { /* Navegadores podem restringir armazenamento. */ }
}
