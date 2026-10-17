import Link from "next/link";
export default function NotFound() { return <main className="grid min-h-screen place-content-center gap-4 text-center"><h1 className="text-3xl font-semibold">Página não encontrada</h1><Link href="/dashboard" className="text-primary underline">Voltar para a visão geral</Link></main>; }
