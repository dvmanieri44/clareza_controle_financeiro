import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User } from "firebase/auth";
import { deleteDoc, doc, getDocs, limit, query, runTransaction, writeBatch } from "firebase/firestore";
import { z } from "zod";
import { collections } from "../domain/types";
import { firebase } from "./client";
import { userCollection } from "./repository";
import { forgetDeletion, rememberDeletion } from "./deletion-state";

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual."),
  newPassword: z.string().min(8, "Use pelo menos 8 caracteres."),
  confirmation: z.string(),
}).refine(value => value.newPassword === value.confirmation, { path: ["confirmation"], message: "As senhas não coincidem." })
  .refine(value => value.newPassword !== value.currentPassword, { path: ["newPassword"], message: "Escolha uma senha diferente da atual." });

async function reauthenticate(user: User, password: string) {
  if (!user.email || !password) throw new Error("Informe sua senha atual.");
  if (firebase().auth.currentUser?.uid !== user.uid) throw new Error("Sua sessão mudou. Entre novamente.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  // Atualiza auth_time nas regras do Firestore após confirmar a senha.
  await user.getIdToken(true);
}

export async function changeAccountPassword(user: User, values: z.infer<typeof passwordChangeSchema>) {
  const valid = passwordChangeSchema.parse(values);
  await reauthenticate(user, valid.currentPassword);
  await updatePassword(user, valid.newPassword);
}

const activeDeletions = new Set<string>();
export async function deleteAccount(user: User, password: string, confirmation: string, onProgress: (message: string) => void = () => {}) {
  if (activeDeletions.has(user.uid)) throw new Error("A exclusão já está em andamento nesta página. Aguarde a conclusão.");
  activeDeletions.add(user.uid);
  try { await performDeletion(user, password, confirmation, onProgress); }
  finally { activeDeletions.delete(user.uid); }
}

async function performDeletion(user: User, password: string, confirmation: string, onProgress: (message: string) => void) {
  if (confirmation !== "EXCLUIR") throw new Error("Digite EXCLUIR para confirmar.");
  await reauthenticate(user, password);
  const db = firebase().db;
  const profile = doc(db, "users", user.uid);
  const markDeletion = () => runTransaction(db, async tx => {
    const previous = await tx.get(profile);
    const data = previous.data();
    tx.set(profile, { createdAt: data?.createdAt || new Date().toISOString(), version: 1, deletionStartedAt: data?.deletionStartedAt || new Date().toISOString() });
  });
  await markDeletion();
  rememberDeletion(user.uid);
  // A marca bloqueia novas gravações em todas as sessões. Os lotes podem ser retomados.
  for (const key of collections) {
    onProgress("Excluindo seus registros… Mantenha esta página aberta.");
    while (true) {
      const snapshot = await getDocs(query(userCollection(user.uid, key), limit(200)));
      if (snapshot.empty) break;
      const batch = writeBatch(db);
      snapshot.docs.forEach(item => batch.delete(item.ref));
      await batch.commit();
    }
  }
  onProgress("Finalizando a exclusão do acesso…");
  await deleteDoc(profile);
  try {
    // O acesso só é removido após confirmar a exclusão dos dados no Firestore.
    await deleteUser(user);
    forgetDeletion(user.uid);
  } catch (error) {
    // Mantém a conta em exclusão caso a última etapa falhe; uma nova tentativa é segura.
    try { await markDeletion(); } catch { /* A interface mantém a opção de tentar novamente. */ }
    throw error;
  }
}
