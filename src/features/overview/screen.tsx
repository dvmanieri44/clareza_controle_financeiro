"use client";
import { ResourceStatus, useResource } from "@/features/finance/use-resource";
import { dashboardData } from "@/lib/firebase/finance-queries";
import { useAccountForm } from "@/features/accounts/use-account-form";
import { useEntryForm } from "@/features/transactions/use-entry-form";
import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthOf } from "@/lib/domain/finance";


import { Dashboard } from "@/features/dashboard";
import { FeatureHeading, useFinanceOptions, useFeatureDialogs } from "@/features/finance/shared";

export function OverviewScreen() {
  const { uid, data, activeAccounts } = useFinanceOptions();
  const { setForm, dialogs } = useFeatureDialogs(uid);
  const [month, setMonth] = useState(monthOf());
  const load = useCallback(() => dashboardData(uid, data.accounts, data.cards, month), [uid, data.accounts, data.cards, month]);
  const resource = useResource(uid + ":dashboard:" + month, load);
  const openEntry = useEntryForm(setForm);
  const openAccount = useAccountForm(setForm);
  const primary: [string, () => void] = activeAccounts.length ? ["Adicionar transação", () => openEntry()] : ["Adicionar conta", () => openAccount()];
  if (!resource.value) return <ResourceStatus error={resource.error} />;
  return <><FeatureHeading section="dashboard" month={month} setMonth={setMonth} action={<Button onClick={primary[1]}><Plus />{primary[0]}</Button>} /><Dashboard snapshot={resource.value} month={month} addEntry={() => openEntry()} addAccount={() => openAccount()} />{dialogs}</>;
}
