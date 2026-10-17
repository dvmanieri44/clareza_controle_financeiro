"use client";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { errorMessage } from "@/lib/firebase/repository";
import { date as dateSchema, month as monthSchema } from "@/lib/domain/schemas";
import { parseMoney } from "@/lib/domain/finance";
export interface FormField { key: string; label: string; type?: "text" | "date" | "month" | "money" | "signedMoney" | "number" | "color" | "textarea" | "select"; options?: { value: string; label: string }[]; required?: boolean; min?: number; max?: number; disabled?: boolean; help?: string; }
export interface FormConfig { title: string; description?: string; fields: FormField[]; defaults?: Record<string, string>; submitLabel?: string; submit: (values: Record<string, string>) => Promise<void>; }
export function FormDialog({ config, close }: { config: FormConfig; close: () => void }) {
  const schema = useMemo(() => z.record(z.string(), z.string()).superRefine((values, ctx) => {
    for (const field of config.fields) {
      const value = values[field.key] || ""; const add = (message: string) => ctx.addIssue({ code: "custom", path: [field.key], message });
      if (!value.trim()) { if (field.required !== false) add("Preencha este campo."); continue; }
      if (field.type === "money" || field.type === "signedMoney") { try { const cents = parseMoney(value); if (field.type === "money" && cents <= 0) add("Informe um valor maior que zero."); } catch (err) { add((err as Error).message); } }
      else if (field.type === "date" && !dateSchema.safeParse(value).success) add("Informe uma data válida (1900 a 2199).");
      else if (field.type === "month" && !monthSchema.safeParse(value).success) add("Informe um mês válido.");
      else if (field.type === "number" && (!Number.isInteger(Number(value)) || Number(value) < (field.min ?? 0) || Number(value) > (field.max ?? 1000000))) add(`Informe um inteiro entre ${field.min ?? 0} e ${field.max ?? 1000000}.`);
      else if (field.type === "select" && !field.options?.some(o => o.value === value)) add("Selecione uma opção disponível.");
      if (value.length > (field.type === "textarea" ? 1000 : 120)) add("Texto muito longo.");
    }
  }), [config.fields]);
  const defaults = Object.fromEntries(config.fields.map(f => [f.key, config.defaults?.[f.key] ?? (f.type === "color" ? "#10b981" : "")]));
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Record<string, string>>({ resolver: zodResolver(schema), defaultValues: defaults });
  return <Dialog open onOpenChange={open => { if (!open && !isSubmitting) close(); }} title={config.title} description={config.description}><form className="grid gap-4" noValidate onSubmit={handleSubmit(async values => { try { await config.submit(values); toast.success("Pronto! Alteração salva."); close(); } catch (error) { toast.error(errorMessage(error)); } })}>{config.fields.map(field => <label key={field.key} className="field-label" htmlFor={`field-${field.key}`}>{field.label}{field.required === false && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}{field.type === "select" ? <select className="input" id={`field-${field.key}`} {...register(field.key)} disabled={field.disabled}><option value="">Selecione…</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "textarea" ? <textarea className="input min-h-20" id={`field-${field.key}`} {...register(field.key)} maxLength={1000} /> : <input className="input" id={`field-${field.key}`} {...register(field.key)} type={field.type === "money" || field.type === "signedMoney" ? "text" : field.type || "text"} inputMode={field.type === "money" || field.type === "signedMoney" ? "decimal" : undefined} placeholder={field.type === "money" || field.type === "signedMoney" ? "0,00" : undefined} min={field.min} max={field.max} disabled={field.disabled} maxLength={120} />}{field.help && <span className="text-xs font-normal text-muted-foreground">{field.help}</span>}{errors[field.key] && <span role="alert" className="field-error">{String(errors[field.key]?.message)}</span>}</label>)}<div className="mt-3 flex justify-end gap-2"><Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>Cancelar</Button><Button disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}{config.submitLabel || "Salvar"}</Button></div></form></Dialog>;
}
