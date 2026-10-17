export interface Base { id: string; createdAt: string; }
export interface Account extends Base { name: string; type: string; initialBalance: number; color: string; archived: boolean; }
export interface Category extends Base { name: string; type: "income" | "expense"; color: string; icon: string; archived: boolean; }
export type EntryKind = "income" | "expense" | "transfer" | "purchase" | "invoicePayment";
export interface Entry extends Base {
  kind: EntryKind; description: string; amount: number; date: string; dueDate: string;
  status: "pending" | "settled"; accountId: string; toAccountId: string; categoryId: string;
  cardId: string; invoiceMonth: string; groupId: string; installment: number; installments: number;
  notes: string; recurrenceId: string;
}
export interface Card extends Base { name: string; limit: number; closingDay: number; dueDay: number; color: string; archived: boolean; revision: number; }
export interface Budget extends Base { categoryId: string; month: string; amount: number; }
export interface Goal extends Base { name: string; target: number; current: number; deadline: string; archived: boolean; lastMovementId: string; }
export interface GoalMovement extends Base { goalId: string; amount: number; date: string; notes: string; }
export interface Investment extends Base { name: string; type: string; institution: string; invested: number; current: number; date: string; archived: boolean; }
export interface Snapshot extends Base { investmentId: string; invested: number; current: number; date: string; }
export interface Recurrence extends Base { description: string; amount: number; kind: "income" | "expense"; accountId: string; categoryId: string; startDate: string; endDate: string; notes: string; archived: boolean; }
export interface CollectionMap { accounts: Account; categories: Category; entries: Entry; cards: Card; budgets: Budget; goals: Goal; goalMovements: GoalMovement; investments: Investment; snapshots: Snapshot; recurrences: Recurrence; }
export type CollectionName = keyof CollectionMap;
export type FinanceData = { [K in CollectionName]: CollectionMap[K][] };
export const collections: CollectionName[] = ["accounts", "categories", "entries", "cards", "budgets", "goals", "goalMovements", "investments", "snapshots", "recurrences"];
export const emptyData: FinanceData = { accounts: [], categories: [], entries: [], cards: [], budgets: [], goals: [], goalMovements: [], investments: [], snapshots: [], recurrences: [] };
export const accountTypes = ["Conta corrente", "Poupança", "Dinheiro", "Carteira digital", "Investimentos"] as const;
export const investmentTypes = ["CDB", "Tesouro Direto", "LCI", "LCA", "Ações", "Fundos", "Outros"];
