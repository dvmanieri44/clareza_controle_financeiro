import { notFound } from "next/navigation";
import { FinanceScreen } from "@/features/finance-screen";
const sections = ["dashboard", "transacoes", "contas", "cartoes", "orcamentos", "metas", "investimentos", "categorias", "recorrencias", "configuracoes"];
export function generateStaticParams() { return sections.map(section => ({ section })); }
export default async function Page({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; if (!sections.includes(section)) notFound(); return <FinanceScreen section={section} />; }
