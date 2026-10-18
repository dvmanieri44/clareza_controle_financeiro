import { z } from "zod";
import { color, date, month } from "./schemas";
import { parseMoney } from "./finance";

export interface FormField {
  key: string;
  label: string;
  type?: "text" | "date" | "month" | "money" | "signedMoney" | "number" | "color" | "textarea" | "select";
  options?: { value: string; label: string; when?: { field: string; value: string } }[];
  required?: boolean;
  min?: number;
  max?: number;
  disabled?: boolean;
  help?: string;
}

export function createFormSchema(fields: FormField[]) {
  return z.record(z.string(), z.string()).superRefine((values, ctx) => {
    for (const field of fields) {
      const value = values[field.key] || "";
      const add = (message: string) => ctx.addIssue({ code: "custom", path: [field.key], message });
      if (!value.trim()) {
        if (field.required !== false) add("Preencha este campo.");
        continue;
      }
      if (field.type === "money" || field.type === "signedMoney") {
        try {
          if (parseMoney(value) <= 0 && field.type === "money") add("Informe um valor maior que zero.");
        } catch (error) { add((error as Error).message); }
      } else if (field.type === "date" && !date.safeParse(value).success) add("Informe uma data válida (1900 a 2199).");
      else if (field.type === "month" && !month.safeParse(value).success) add("Informe um mês válido.");
      else if (field.type === "number" && (!Number.isInteger(Number(value)) || Number(value) < (field.min ?? 0) || Number(value) > (field.max ?? 1000000))) add(`Informe um inteiro entre ${field.min ?? 0} e ${field.max ?? 1000000}.`);
      else if (field.type === "select" && !field.options?.some(option => option.value === value && (!option.when || values[option.when.field] === option.when.value))) add("Selecione uma opção disponível.");
      else if (field.type === "color" && !color.safeParse(value).success) add("Selecione uma cor válida.");
      if (value.length > (field.type === "textarea" ? 1000 : 120)) add("Texto muito longo.");
    }
  });
}
