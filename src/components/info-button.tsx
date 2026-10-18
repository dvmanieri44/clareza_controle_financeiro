"use client";
import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

export function InfoButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="info-button" aria-label={`Informações: ${title}`} aria-haspopup="dialog" onClick={() => setOpen(true)}><Info aria-hidden="true" size={19} /></button>
    {open && <Dialog open onOpenChange={setOpen} title={title} description={text}><div className="form-actions"><Button type="button" onClick={() => setOpen(false)}>Entendi</Button></div></Dialog>}
  </>;
}
