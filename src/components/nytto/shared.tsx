import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Check, Info, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card print-keep p-5 sm:p-6", className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-foreground">{title}</h3>
            )}
            {description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  info,
  exactValue,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "today" | "change";
  info?: ReactNode;
  exactValue?: string;
}) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-positive-strong",
    negative: "text-negative",
    today: "text-today",
    change: "text-change",
  }[tone];
  return (
    <div className="surface-card print-keep min-w-0 p-4">
      <p className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {info && (
          <HoverCard openDelay={100} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                aria-label="Hur värdet beräknas"
                className="no-print ml-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full align-baseline text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </HoverCardTrigger>
            <HoverCardContent align="start" className="w-80 text-sm leading-relaxed">
              {info}
            </HoverCardContent>
          </HoverCard>
        )}
      </p>
      <p title={exactValue} className={cn("num mt-2 tabular-nums font-semibold", exactValue ? "whitespace-nowrap text-xl 2xl:text-2xl" : "break-words text-xl", toneClass)}>{value}</p>
      {exactValue && <p className="num mt-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground" title={exactValue}>{exactValue}</p>}
      {hint && <p className="mt-1 break-words text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function AiButton({
  onClick,
  loading,
  children,
  variant = "outline",
}: {
  onClick: () => void;
  loading?: boolean;
  children: ReactNode;
  variant?: "outline" | "default" | "secondary";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={loading}
      className="no-print gap-2"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {loading ? "AI tänker…" : children}
    </Button>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-dark">
      AI
    </span>
  );
}

export function FactCheckBadge({
  factChecked,
  report,
}: {
  factChecked?: boolean | undefined;
  report?: string | undefined;
}) {
  if (!factChecked) return null;
  const badge = (
    <span className="inline-flex items-center gap-1 rounded-full border border-positive/40 bg-positive/10 px-2 py-0.5 text-[11px] font-medium text-positive-strong">
      <Check className="size-3" />
      Faktagranskad
    </span>
  );
  if (!report) return badge;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="no-print gap-2">
          {badge} <span className="text-xs">Visa detaljer</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-64 w-80 overflow-y-auto text-xs leading-relaxed whitespace-pre-line">
        {report}
      </PopoverContent>
    </Popover>
  );
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-change/40 bg-change/10 px-4 py-3 text-sm text-foreground">
      {children}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-brand-soft/50 px-5 py-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {children && (
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  );
}
