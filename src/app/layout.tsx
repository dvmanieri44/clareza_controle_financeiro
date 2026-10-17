import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Clareza · Seu dinheiro, com direção", template: "%s · Clareza" }, description: "Organizador financeiro pessoal com contas, cartões, metas e investimentos." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>; }
