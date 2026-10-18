"use client";
import { OverviewScreen } from "./overview/screen";
import { TransactionsScreen } from "./transactions/screen";
import { AccountsScreen } from "./accounts/screen";
import { CategoriesScreen } from "./categories/screen";
import { CardsScreen } from "./cards/screen";
import { BudgetsScreen } from "./budgets/screen";
import { GoalsScreen } from "./goals/screen";
import { InvestmentsScreen } from "./investments/screen";
import { RecurrencesScreen } from "./recurrences/screen";
import { SettingsScreen } from "./settings/screen";
const screens = { dashboard: OverviewScreen, transacoes: TransactionsScreen, contas: AccountsScreen, categorias: CategoriesScreen, cartoes: CardsScreen, orcamentos: BudgetsScreen, metas: GoalsScreen, investimentos: InvestmentsScreen, recorrencias: RecurrencesScreen, configuracoes: SettingsScreen };
export function FinanceScreen({ section }: { section: string }) {
  const Screen = screens[section as keyof typeof screens];
  return Screen ? <Screen /> : null;
}
