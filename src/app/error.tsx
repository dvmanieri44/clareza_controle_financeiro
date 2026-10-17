"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="grid min-h-screen place-content-center gap-4 p-6 text-center"><h1 className="text-2xl font-semibold">Não foi possível abrir esta página</h1><p className="text-muted-foreground">Tente novamente. Seus dados permanecem salvos no Firebase.</p><Button onClick={reset}>Tentar novamente</Button></div>; }
