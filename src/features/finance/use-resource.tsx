"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useFinance } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/firebase/repository";

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const { revision } = useFinance();
  const requestKey = `${key}:${revision}`;
  const [result, setResult] = useState<{ key: string; value?: T; error?: string }>({ key: "" });
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    load(controller.signal).then(value => { if (!cancelled) setResult({ key, value }); })
      .catch(error => { if (!cancelled) setResult({ key, error: errorMessage(error) }); });
    return () => { cancelled = true; controller.abort(); };
  }, [key, requestKey, load]);
  // Preserva formulários e arquivos escolhidos durante atualização da mesma consulta.
  // Usuário/período/filtros diferentes têm outra chave e nunca recebem dados antigos.
  return result.key === key ? result : { key };
}

export function ResourceStatus({ error }: { error?: string }) {
  const { refresh } = useFinance();
  return error ? <div role="alert" className="error-box"><p>{error}</p><Button className="mt-4" variant="outline" onClick={refresh}>Tentar novamente</Button></div>
    : <div role="status" className="loading-page min-h-40"><Loader2 aria-hidden="true" className="animate-spin" />Consultando seus registros…</div>;
}
