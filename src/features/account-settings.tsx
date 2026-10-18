"use client";
import { useId, useState } from "react";
import { KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/components/providers";
import { Panel } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { changeAccountPassword, deleteAccount, passwordChangeSchema } from "@/lib/firebase/account";
import { errorMessage } from "@/lib/firebase/repository";

export function AccountSettings() {
  const { user, deletionPending } = useFinance();
  const id = useId();
  const [mode, setMode] = useState<"password" | "delete" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [progress, setProgress] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  function open(next: typeof mode) {
    setCurrentPassword(""); setNewPassword(""); setConfirmation(""); setProblem(""); setProgress(""); setFields({}); setMode(next);
  }
  async function submit() {
    if (!user || busy) return;
    setProblem(""); setFields({});
    if (mode === "password") {
      const result = passwordChangeSchema.safeParse({ currentPassword, newPassword, confirmation });
      if (!result.success) { setFields(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; }
    } else {
      const errors: Record<string, string> = {};
      if (!currentPassword) errors.currentPassword = "Informe sua senha atual.";
      if (confirmation !== "EXCLUIR") errors.confirmation = "Digite EXCLUIR para confirmar.";
      if (Object.keys(errors).length) { setFields(errors); return; }
    }
    setBusy(true);
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (mode === "delete") window.addEventListener("beforeunload", preventUnload);
    try {
      if (mode === "password") {
        await changeAccountPassword(user, { currentPassword, newPassword, confirmation });
        toast.success("Senha alterada."); open(null);
      } else {
        await deleteAccount(user, currentPassword, confirmation, setProgress);
        toast.success("Sua conta e seus registros foram excluídos.");
      }
    } catch (error) { setCurrentPassword(""); setProgress(""); setProblem(errorMessage(error)); }
    finally { window.removeEventListener("beforeunload", preventUnload); setBusy(false); }
  }
  return <>
    <Panel title="Segurança da conta" action={<KeyRound aria-hidden="true" size={20} />}>
      <p className="mb-2 break-all text-sm font-medium">{user?.email}</p>
      <p className="mb-5 text-sm text-muted-foreground">Confirme sua senha atual para definir uma nova senha.</p>
      <Button variant="outline" disabled={deletionPending} onClick={() => open("password")}>Alterar senha</Button>
    </Panel>
    <Panel title="Sua privacidade" action={<ShieldCheck aria-hidden="true" size={20} />}>
      <ul className="list-disc space-y-3 pl-5 text-sm text-muted-foreground">
        <li>Seu e-mail e acesso são gerenciados pelo Firebase Authentication. A senha não é salva junto aos registros financeiros.</li>
        <li>Contas, transações, cartões, metas e regras de importação ficam no Firestore, vinculados ao seu usuário. O acesso é controlado pelas regras de segurança.</li>
        <li>O CSV é lido no navegador. Somente as compras e regras que você confirmar são enviadas ao banco; o arquivo original não é armazenado.</li>
        <li>Você pode exportar seus registros em JSON. A exclusão da conta não apaga cópias que você já baixou.</li>
        <li>O navegador guarda a preferência de tema e uma marca de retomada se a exclusão for interrompida. Senhas não são guardadas nessa marca.</li>
      </ul>
    </Panel>
    <Panel title={deletionPending ? "Concluir exclusão da conta" : "Excluir conta"} className="border-destructive/40 lg:col-span-2">
      {deletionPending && <p role="status" className="mb-4 rounded-lg bg-accent p-4 text-sm">A exclusão já foi iniciada. Novas gravações estão bloqueadas. Confirme sua senha para retomar e concluir; os registros já removidos não podem ser recuperados.</p>}
      <p className="mb-3 text-sm text-muted-foreground">Remove permanentemente seu acesso, perfil e todos os registros financeiros e regras de importação desta conta.</p>
      <p className="mb-5 text-sm text-muted-foreground">Baixe uma cópia em “Exportar dados” antes de começar. Mantenha a página aberta até terminar. Se houver uma interrupção, entre novamente para concluir a exclusão.</p>
      <Button variant="destructive" onClick={() => open("delete")}><Trash2 aria-hidden="true" />{deletionPending ? "Retomar exclusão" : "Excluir minha conta"}</Button>
    </Panel>
    {mode && <Dialog open busy={busy} onOpenChange={value => { if (!value) open(null); }} title={mode === "password" ? "Alterar senha" : "Excluir conta e todos os dados?"} description={mode === "password" ? "Sua senha atual confirma que é você." : "Esta ação é permanente. Mesmo que a conexão caia, os dados já excluídos não poderão ser recuperados."}>
      <form className="grid gap-5" noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); void submit(); }}>
        <input type="text" autoComplete="username" value={user?.email || ""} readOnly hidden />
        <div><label className="field-label" htmlFor={`${id}-current`}>Senha atual</label><input id={`${id}-current`} className="input mt-2" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} required aria-invalid={!!fields.currentPassword} aria-describedby={fields.currentPassword ? `${id}-current-error` : undefined} />{fields.currentPassword && <p id={`${id}-current-error`} className="field-error" role="alert">{fields.currentPassword}</p>}</div>
        {mode === "password" && <div><label className="field-label" htmlFor={`${id}-new`}>Nova senha</label><input id={`${id}-new`} className="input mt-2" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={busy} required minLength={8} aria-invalid={!!fields.newPassword} aria-describedby={`${id}-new-help${fields.newPassword ? ` ${id}-new-error` : ""}`} /><p id={`${id}-new-help`} className="field-help">Use pelo menos 8 caracteres e uma senha diferente da atual.</p>{fields.newPassword && <p id={`${id}-new-error`} className="field-error" role="alert">{fields.newPassword}</p>}</div>}
        <div><label className="field-label" htmlFor={`${id}-confirm`}>{mode === "password" ? "Repita a nova senha" : "Digite EXCLUIR para confirmar"}</label><input id={`${id}-confirm`} className="input mt-2" type={mode === "password" ? "password" : "text"} autoComplete={mode === "password" ? "new-password" : "off"} spellCheck={false} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} required aria-invalid={!!fields.confirmation} aria-describedby={fields.confirmation ? `${id}-confirm-error` : undefined} />{fields.confirmation && <p id={`${id}-confirm-error`} className="field-error" role="alert">{fields.confirmation}</p>}</div>
        {problem && <p role="alert" className="error-box">{problem}</p>}
        {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}
        <div className="form-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => open(null)}>Cancelar</Button><Button variant={mode === "delete" ? "destructive" : "default"} disabled={busy}>{busy ? <><Loader2 aria-hidden="true" className="animate-spin" />Aguarde…</> : mode === "password" ? "Salvar nova senha" : "Excluir permanentemente"}</Button></div>
      </form>
    </Dialog>}
  </>;
}
