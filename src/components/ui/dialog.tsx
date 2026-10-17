"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (value: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" /><DialogPrimitive.Content className="dialog-content"><div className="mb-6 pr-8"><DialogPrimitive.Title className="text-xl font-semibold tracking-tight">{title}</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description || "Preencha os campos abaixo. Os valores são em reais."}</DialogPrimitive.Description></div>{children}<DialogPrimitive.Close aria-label="Fechar" className="absolute right-4 top-4 rounded-md p-2 hover:bg-accent"><X size={18} /></DialogPrimitive.Close></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}
