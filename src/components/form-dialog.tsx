"use client";
import { useEffect, useId, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { errorMessage } from "@/lib/firebase/repository";
import { createFormSchema, type FormField } from "@/lib/domain/form";
import { InfoButton } from "./info-button";
export type { FormField } from "@/lib/domain/form";
export interface FormConfig { title: string; description?: string; fields: FormField[]; defaults?: Record<string, string>; submitLabel?: string; submit: (values: Record<string, string>) => Promise<void>; }
export function FormDialog({ config, close }: { config: FormConfig; close: () => void }) {
  const prefix = useId();
  const [problem, setProblem] = useState("");
  const schema = useMemo(() => createFormSchema(config.fields), [config.fields]);
  const defaults = Object.fromEntries(config.fields.map(f => [f.key, config.defaults?.[f.key] ?? (f.type === "color" ? "#10b981" : "")]));
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<Record<string, string>>({ resolver: zodResolver(schema), defaultValues: defaults });
  const values = useWatch({ control });
  useEffect(() => {
    for (const field of config.fields) {
      const option = field.options?.find(option => option.value === values[field.key]);
      if (option?.when && values[option.when.field] !== option.when.value) setValue(field.key, "");
    }
  }, [config.fields, values, setValue]);
  return <Dialog open busy={isSubmitting} onOpenChange={open => { if (!open && !isSubmitting) close(); }} title={config.title} description={config.description}>
    <form className="grid gap-4" noValidate aria-busy={isSubmitting} onSubmit={handleSubmit(async values => {
      setProblem("");
      try { await config.submit(values); toast.success("Pronto! Alteração salva."); close(); }
      catch (error) { setProblem(errorMessage(error)); }
    })}>
      {config.fields.map(field => {
        const id = `${prefix}-${field.key}`;
        const describedBy = errors[field.key] ? `${id}-error` : undefined;
        const attributes = { id, "aria-invalid": !!errors[field.key], "aria-describedby": describedBy, "aria-required": field.required !== false, disabled: field.disabled || isSubmitting };
        return <div key={field.key}>
          <div className="field-heading"><label className="field-label" htmlFor={id}>{field.label}{field.required === false && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}</label>{field.help && <InfoButton title={field.label} text={field.help} />}</div>
          {field.type === "select" ? <select className="input mt-2" {...register(field.key)} {...attributes}><option value="">Selecione…</option>{field.options?.filter(option => !option.when || values[option.when.field] === option.when.value).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            : field.type === "textarea" ? <textarea className="input mt-2 min-h-24" {...register(field.key)} {...attributes} maxLength={1000} />
              : <input className="input mt-2" {...register(field.key)} {...attributes} type={field.type === "money" || field.type === "signedMoney" ? "text" : field.type || "text"} inputMode={field.type === "money" || field.type === "signedMoney" ? "decimal" : undefined} placeholder={field.type === "money" || field.type === "signedMoney" ? "0,00" : undefined} min={field.min} max={field.max} maxLength={120} />}
          {errors[field.key] && <span id={`${id}-error`} role="alert" className="field-error">{String(errors[field.key]?.message)}</span>}
        </div>;
      })}
      {problem && <p role="alert" className="error-box">{problem}</p>}
      <div className="form-actions"><Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>Cancelar</Button><Button disabled={isSubmitting}>{isSubmitting && <Loader2 aria-hidden="true" className="animate-spin" />}{isSubmitting ? "Salvando…" : config.submitLabel || "Salvar"}</Button></div>
    </form>
  </Dialog>;
}
