"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Leaf, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { firebase, firebaseConfigured } from "@/lib/firebase/client";
import { errorMessage } from "@/lib/firebase/repository";
import { useFinance } from "@/components/providers";
import { SetupScreen } from "@/components/setup-screen";
import { Button } from "@/components/ui/button";

type Mode = "login" | "signup" | "reset";
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [problem, setProblem] = useState("");
  const previousMode = useRef(mode);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const { user, loading } = useFinance();
  const schema = z.object({
    email: z.email("Informe um e-mail válido."),
    password: mode === "reset" ? z.string() : z.string().min(mode === "signup" ? 8 : 1, mode === "signup" ? "Use pelo menos 8 caracteres." : "Informe sua senha."),
  });
  const { register, handleSubmit, clearErrors, resetField, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>({
    resolver: zodResolver(schema), defaultValues: { email: "", password: "" },
  });
  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);
  useEffect(() => {
    if (previousMode.current !== mode) { previousMode.current = mode; titleRef.current?.focus(); }
  }, [mode]);
  function changeMode(next: Mode) { setMode(next); setProblem(""); clearErrors(); resetField("password"); }
  if (!firebaseConfigured) return <SetupScreen />;
  if (loading || user) return <div className="loading-page" role="status"><Loader2 aria-hidden="true" className="animate-spin" />Abrindo sua conta…</div>;
  const title = mode === "signup" ? "Crie sua conta" : mode === "reset" ? "Recupere seu acesso" : "Que bom ter você aqui";
  const action = mode === "signup" ? "Criar minha conta" : mode === "reset" ? "Enviar link" : "Entrar na minha conta";
  return <main className="auth-page">
    <a className="skip-link" href="#auth-form">Pular para o formulário</a>
    <section className="auth-story" aria-label="FINMEI, organizador financeiro">
      <div className="brand text-white"><span className="brand-symbol bg-white/15"><Leaf aria-hidden="true" size={23} /></span>FINMEI.</div>
      <div><span className="text-sm tracking-widest text-emerald-100">UM NOVO OLHAR PARA SUAS FINANÇAS</span>
        <h2 className="mt-6 text-5xl font-medium leading-[1.12] tracking-tight">Seu dinheiro,<br />com direção.</h2>
        <p className="mt-6 max-w-sm">Organize o presente. Planeje o futuro.</p>
        <div className="mt-10 flex items-center gap-2 text-sm text-emerald-100"><ShieldCheck aria-hidden="true" size={18} />Seus dados, na sua conta.</div>
      </div>
      <p className="text-sm">MENOS COMPLICAÇÃO. MAIS CONTROLE.</p>
    </section>
    <section id="auth-form" className="grid place-items-center px-6 py-12" aria-labelledby="auth-title">
      <div className="w-full max-w-sm">
        <div className="brand mb-10 lg:hidden"><Leaf aria-hidden="true" />FINMEI.</div>
        <span className="eyebrow">SEU ESPAÇO FINANCEIRO</span>
        <h1 id="auth-title" ref={titleRef} tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-8 mt-3 text-muted-foreground">{mode === "reset" ? "Enviaremos um link para redefinir sua senha." : "Entre para acompanhar suas finanças."}</p>
        <form className="space-y-5" noValidate aria-busy={isSubmitting} onSubmit={handleSubmit(async values => {
          setProblem("");
          try {
            const { auth } = firebase();
            if (mode === "reset") {
              await sendPasswordResetEmail(auth, values.email);
              toast.success("Se houver uma conta, você receberá o link de recuperação.");
              changeMode("login");
            } else if (mode === "signup") await createUserWithEmailAndPassword(auth, values.email, values.password);
            else await signInWithEmailAndPassword(auth, values.email, values.password);
          } catch (error) { setProblem(errorMessage(error)); }
        })}>
          <div><label htmlFor="auth-email" className="field-label">E-mail</label>
            <input id="auth-email" {...register("email")} type="email" autoComplete="email" placeholder="voce@exemplo.com" className="input mt-2" aria-required="true" aria-invalid={!!errors.email} aria-describedby={errors.email ? "auth-email-error" : undefined} disabled={isSubmitting} />
            {errors.email && <span id="auth-email-error" role="alert" className="field-error">{errors.email.message}</span>}
          </div>
          {mode !== "reset" && <div><label htmlFor="auth-password" className="field-label">Senha</label>
            <input id="auth-password" {...register("password")} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} className="input mt-2" aria-required="true" aria-invalid={!!errors.password} aria-describedby={errors.password ? "auth-password-error" : mode === "signup" ? "auth-password-help" : undefined} disabled={isSubmitting} />
            {mode === "signup" && <span id="auth-password-help" className="field-help">Use pelo menos 8 caracteres.</span>}
            {errors.password && <span id="auth-password-error" role="alert" className="field-error">{errors.password.message}</span>}
          </div>}
          {problem && <div role="alert" className="error-box">{problem}</div>}
          <Button className="w-full" disabled={isSubmitting}>{isSubmitting ? <><Loader2 aria-hidden="true" className="animate-spin" />Aguarde…</> : <>{action}<ArrowRight aria-hidden="true" /></>}</Button>
        </form>
        <div className="auth-actions mt-6 flex flex-wrap justify-center gap-x-4 text-sm">
          {mode !== "reset" && <button type="button" disabled={isSubmitting} className="text-primary underline-offset-4 hover:underline" onClick={() => changeMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Já tenho uma conta" : "Criar conta"}</button>}
          {mode === "login" && <button type="button" disabled={isSubmitting} className="text-muted-foreground underline-offset-4 hover:underline" onClick={() => changeMode("reset")}>Esqueci minha senha</button>}
          {mode === "reset" && <button type="button" disabled={isSubmitting} className="text-primary underline-offset-4 hover:underline" onClick={() => changeMode("login")}>Voltar para o login</button>}
        </div>
      </div>
    </section>
  </main>;
}
