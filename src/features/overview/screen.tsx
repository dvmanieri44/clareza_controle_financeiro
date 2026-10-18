"use client";
import { useAccountForm } from "@/features/accounts/use-account-form";
import { useEntryForm } from "@/features/transactions/use-entry-form";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthOf } from "@/lib/domain/finance";


import { Dashboard } from "@/features/dashboard";
import { FeatureHeading, useFinanceOptions, useFeatureDialogs } from "@/features/finance/shared";

export function OverviewScreen() {
  const { uid, activeAccounts } = useFinanceOptions();
  const { setForm, dialogs } = useFeatureDialogs(uid);
  const [month, setMonth] = useState(monthOf());
  const openEntry = useEntryForm(setForm);
  const openAccount = useAccountForm(setForm);
  const primary: [string, () => void] = activeAccounts.length ? ["Adicionar transação", () => openEntry()] : ["Adicionar conta", () => openAccount()];
  return <><FeatureHeading section="dashboard" month={month} setMonth={setMonth} action={<Button onClick={primary[1]}><Plus />{primary[0]}</Button>} /><Dashboard month={month} addEntry={() => openEntry()} addAccount={() => openAccount()} />{dialogs}</>;
}
