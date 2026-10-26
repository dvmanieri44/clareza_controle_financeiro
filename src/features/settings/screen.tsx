"use client";
import { useState } from "react";
import { exportAllData } from "@/lib/firebase/finance-queries";
import { errorMessage } from "@/lib/firebase/repository";
import { useTheme } from "next-themes";
import { InfoButton } from "@/components/info-button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { today } from "@/lib/domain/finance";
import { AccountSettings } from "@/features/account-settings";
import { ImportRuleSettings } from "@/features/import-rule-settings";
import { FeatureHeading, useFinanceOptions, useFeatureDialogs } from "@/features/finance/shared";

export function SettingsScreen() {
  const { uid } = useFinanceOptions();
  const { dialogs } = useFeatureDialogs(uid);
  const { resolvedTheme, setTheme } = useTheme();

  const [exporting, setExporting] = useState(false);
  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportAllData(uid);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `finmei-${today()}.json`; link.click(); URL.revokeObjectURL(url); toast.success("Exportação concluída.");
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setExporting(false); }
  };
  return <><FeatureHeading section="configuracoes" /><div className="grid gap-6 lg:grid-cols-2">
    <Panel title="Aparência"><div className="flex flex-wrap gap-3" role="group" aria-label="Tema do aplicativo"><Button variant={resolvedTheme === "light" ? "default" : "outline"} aria-pressed={resolvedTheme === "light"} onClick={() => setTheme("light")}>Claro</Button><Button variant={resolvedTheme === "dark" ? "default" : "outline"} aria-pressed={resolvedTheme === "dark"} onClick={() => setTheme("dark")}>Escuro</Button></div></Panel>
    <Panel title="Meus dados" action={<InfoButton title="Exportar meus dados" text="O arquivo JSON contém suas contas, categorias, transações, metas, regras de importação e histórico de investimentos. Guarde a cópia em um local seguro. A exportação não altera nem remove seus registros." />}><p className="mb-5 text-muted-foreground">Baixe uma cópia dos seus registros.</p><Button variant="outline" onClick={() => void exportData()} disabled={exporting}><Download aria-hidden="true" />{exporting ? "Exportando…" : "Exportar dados"}</Button></Panel>
  </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><ImportRuleSettings /><AccountSettings /></div>{dialogs}</>;
}
