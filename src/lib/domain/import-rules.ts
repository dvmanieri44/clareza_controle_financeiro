import type { Category, Entry, ImportRule } from "./types";

export function normalizeDescription(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function validateRule(pattern: string, match: string, categoryId: string) {
  const normalized = normalizeDescription(pattern);
  if (normalized.length < 2 || normalized.length > 120) throw new Error("Use uma descrição com 2 a 120 caracteres.");
  if (match !== "exact" && match !== "contains") throw new Error("Escolha como comparar a descrição.");
  if (!categoryId || categoryId.length > 120 || categoryId.includes("/")) throw new Error("Escolha uma categoria de despesa.");
  return { pattern: normalized, match, categoryId } as const;
}

export async function importRuleId(pattern: string, match: "exact" | "contains") {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([match, normalizeDescription(pattern)])));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function suggestCategory(description: string, rules: ImportRule[], categories: Category[]): string {
  const value = normalizeDescription(description);
  const available = new Set(categories.filter(category => !category.archived && category.type === "expense").map(category => category.id));
  const matching = rules.filter(rule => available.has(rule.categoryId) && (rule.match === "exact" ? value === rule.pattern : ` ${value} `.includes(` ${rule.pattern} `)))
    .sort((a, b) => Number(b.match === "exact") - Number(a.match === "exact") || b.pattern.length - a.pattern.length);
  if (!matching.length) return "";
  const best = matching[0];
  const tied = matching.filter(rule => rule.match === best.match && rule.pattern.length === best.pattern.length);
  return new Set(tied.map(rule => rule.categoryId)).size === 1 ? best.categoryId : "";
}

/** Descrições com escolhas conflitantes não viram regras silenciosamente. */
export function rememberedRules(items: { description: string; categoryId: string }[]) {
  const groups = new Map<string, Set<string>>();
  for (const item of items) {
    const pattern = normalizeDescription(item.description);
    if (pattern.length < 2 || pattern.length > 120) continue;
    const categories = groups.get(pattern) || new Set<string>();
    categories.add(item.categoryId); groups.set(pattern, categories);
  }
  return [...groups].flatMap(([pattern, categories]) => categories.size === 1 ? [{ pattern, match: "exact" as const, categoryId: [...categories][0] }] : []);
}

export function similarPurchase(entries: Entry[], cardId: string, month: string, row: { date: string; description: string; amount: number | null }) {
  return entries.some(entry => entry.kind === "purchase" && entry.cardId === cardId && entry.invoiceMonth === month && entry.date === row.date && entry.amount === row.amount && normalizeDescription(entry.description) === normalizeDescription(row.description));
}
