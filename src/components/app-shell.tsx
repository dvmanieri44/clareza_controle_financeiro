"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ArrowLeftRight, ChartNoAxesCombined, CreditCard, FolderHeart, LayoutDashboard, Leaf, Loader2, LogOut, Menu, Moon, Repeat2, Settings2, Sun, Tags, Target, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { firebaseConfigured } from "@/lib/firebase/client";
import { useFinance } from "./providers";
import { SetupScreen } from "./setup-screen";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
const nav = [
  ["dashboard", "Visão geral", LayoutDashboard], ["transacoes", "Transações", ArrowLeftRight], ["contas", "Minhas contas", Wallet], ["cartoes", "Cartões de crédito", CreditCard],
  ["orcamentos", "Orçamentos", ChartNoAxesCombined], ["metas", "Metas financeiras", Target], ["investimentos", "Investimentos", FolderHeart], ["categorias", "Categorias", Tags], ["recorrencias", "Contas recorrentes", Repeat2],
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, error, dataLoading, logout } = useFinance();
  const router = useRouter();
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const { resolvedTheme, setTheme } = useTheme();
  const [menu, setMenu] = useState(false);
  const previousPath = useRef(pathname);
  const navigating = useRef(false);
  useEffect(() => { if (firebaseConfigured && !loading && !user) router.replace("/login"); }, [loading, user, router]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenu(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const frame = requestAnimationFrame(() => document.getElementById("main-content")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  if (!firebaseConfigured) return <SetupScreen />;
  if (loading || !user) return <div className="loading-page" role="status"><Loader2 aria-hidden="true" className="animate-spin" />Abrindo seu espaço…</div>;
  const handleMobileNavigate = () => { navigating.current = true; setMenu(false); };
  return <DialogPrimitive.Root open={menu} onOpenChange={setMenu}>
    <div className="app-layout">
      <a href="#main-content" className="skip-link">Pular para o conteúdo principal</a>
      <aside className="sidebar desktop-sidebar"><SidebarContent pathname={pathname} email={user.email || ""} onNavigate={() => {}} logout={logout} /></aside>
      <div className="main-column">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3">
            <DialogPrimitive.Trigger asChild><Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Abrir menu de navegação"><Menu aria-hidden="true" /></Button></DialogPrimitive.Trigger>
            <span className="text-sm text-muted-foreground">Minhas finanças</span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />Seu espaço pessoal</span>
            <Button variant="ghost" size="icon" aria-label={resolvedTheme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}><Sun aria-hidden="true" className="hidden dark:block" /><Moon aria-hidden="true" className="dark:hidden" /></Button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content" aria-busy={dataLoading}>
          {error ? <div className="error-box" role="alert"><h1 className="mb-2 font-semibold">Não foi possível carregar seus dados</h1>{error}<div className="mt-4"><Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button></div></div> : dataLoading ? <div className="loading-page min-h-[50vh]" role="status"><Loader2 aria-hidden="true" className="animate-spin" />Buscando seus dados…</div> : children}
        </main>
      </div>
    </div>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-30 bg-black/50" />
      <DialogPrimitive.Content className="sidebar mobile-sidebar" aria-describedby={undefined} onCloseAutoFocus={event => { if (navigating.current || window.matchMedia("(min-width: 1024px)").matches) { event.preventDefault(); navigating.current = false; document.getElementById("main-content")?.focus(); } }}>
        <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>
        <DialogPrimitive.Close asChild><Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Fechar menu de navegação"><X aria-hidden="true" /></Button></DialogPrimitive.Close>
        <SidebarContent pathname={pathname} email={user.email || ""} onNavigate={handleMobileNavigate} logout={logout} />
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

function SidebarContent({ pathname, email, onNavigate, logout }: { pathname: string; email: string; onNavigate: () => void; logout: () => Promise<void> }) {
  return <>
    <Link href="/dashboard" className="brand" onClick={onNavigate}><span className="brand-symbol"><Leaf aria-hidden="true" size={23} /></span>clareza<span className="text-primary">.</span></Link>
    <p className="nav-label">SEU ESPAÇO FINANCEIRO</p>
    <nav aria-label="Navegação principal" className="space-y-1">{nav.map(([key, label, Icon]) => <Link key={key} href={`/${key}`} onClick={onNavigate} aria-current={pathname === `/${key}` ? "page" : undefined} className={cn("nav-link", pathname === `/${key}` && "active")}><Icon aria-hidden="true" size={18} />{label}{pathname === `/${key}` && <span aria-hidden="true" className="ml-auto size-1.5 rounded-full bg-primary" />}</Link>)}</nav>
    <div className="mt-auto">
      <Link href="/configuracoes" aria-current={pathname === "/configuracoes" ? "page" : undefined} className={cn("nav-link", pathname === "/configuracoes" && "active")} onClick={onNavigate}><Settings2 aria-hidden="true" size={18} />Configurações</Link>
      <button type="button" className="nav-link w-full" onClick={() => logout().catch(() => toast.error("Não foi possível sair. Tente novamente."))}><LogOut aria-hidden="true" size={18} />Sair da conta</button>
      <div className="profile"><span aria-hidden="true" className="avatar">{email.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="text-sm font-medium">Minha conta</p><p className="break-all text-xs text-muted-foreground">{email}</p></div></div>
    </div>
  </>;
}
