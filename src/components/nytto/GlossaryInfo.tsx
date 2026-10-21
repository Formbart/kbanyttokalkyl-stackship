import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, type GlossaryTerm } from "@/lib/nyttokalkyl/glossary";

export function GlossaryInfo({ term }: { term: GlossaryTerm }) {
  const [touch, setTouch] = useState(false);
  const [open, setOpen] = useState(false);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const media = window.matchMedia("(hover: none)");
    const update = () => { setTouch(media.matches); setOpen(false); };
    update();
    media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); clearTimeout(focusTimer.current); };
  }, []);
  const entry = GLOSSARY[term];
  const content = <div className="space-y-2 normal-case tracking-normal"><p className="font-semibold">{term}</p><p className="font-normal">{entry.description}</p>{"example" in entry && <p className="font-normal italic">{entry.example}</p>}</div>;
  const trigger = <Button type="button" variant="ghost" aria-label={`Förklaring: ${term}`} className="no-print ml-1 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm p-0 align-middle text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-2 [&_svg]:size-3.5"><Info size={14} /></Button>;
  const contentClass = "no-print w-80 max-w-[min(320px,calc(100vw-32px))] rounded-lg border border-border bg-popover p-3 text-[13px] leading-[1.5] text-popover-foreground shadow-md";
  if (touch) return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild>{trigger}</PopoverTrigger><PopoverContent align="start" className={contentClass}>{content}</PopoverContent></Popover>;
  return <TooltipProvider delayDuration={150} skipDelayDuration={0}><Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger asChild onFocus={(event) => {
    event.preventDefault();
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setOpen(true), 150);
  }} onBlur={() => { clearTimeout(focusTimer.current); setOpen(false); }}>{trigger}</TooltipTrigger><TooltipContent align="start" className={contentClass}>{content}</TooltipContent></Tooltip></TooltipProvider>;
}

export function GlossaryLabel({ term, children }: { term: GlossaryTerm; children?: ReactNode }) {
  return <>{children ?? term}<GlossaryInfo term={term} /></>;
}