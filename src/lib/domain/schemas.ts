import { z } from "zod";
import { MAX_MONEY, parseMoney } from "./finance";
export const name = z.string().trim().min(2, "Informe pelo menos 2 caracteres.").max(120, "Máximo de 120 caracteres.");
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").refine(v => { const d = new Date(`${v}T12:00:00`); return !Number.isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2199 && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` === v; }, "Data inválida.");
export const month = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/, "Mês inválido.");
export const cents = z.number().int().min(0).max(MAX_MONEY);
export const positiveCents = cents.positive("Informe um valor maior que zero.");
export const currency = z.string().transform((v, ctx) => { try { return parseMoney(v); } catch (err) { ctx.addIssue({ code: "custom", message: (err as Error).message }); return z.NEVER; } });
export const positiveCurrency = currency.pipe(positiveCents);
export const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const entrySchema = z.object({
  description: name, amount: positiveCents, kind: z.enum(["income", "expense"]),
  accountId: z.string().min(1, "Selecione uma conta."), categoryId: z.string().min(1, "Selecione uma categoria."),
  date, dueDate: z.union([date, z.literal("")]), status: z.enum(["pending", "settled"]), notes: z.string().max(1000),
});
export const accountSchema = z.object({ name, type: z.enum(["Conta corrente", "Poupança", "Dinheiro", "Carteira digital", "Investimentos"]), initialBalance: z.number().int().min(-MAX_MONEY).max(MAX_MONEY), color });
export const cardSchema = z.object({ name, limit: positiveCents, closingDay: z.number().int().min(1).max(31), dueDay: z.number().int().min(1).max(31), color });
