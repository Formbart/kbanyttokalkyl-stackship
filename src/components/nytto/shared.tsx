import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
    <section className={cn("surface-card p-5 sm:p-6", className)}>
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
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "today" | "change";
}) {
  const toneClass = {
    neutral: "text-foreground",
    positive: "text-positive-strong",
    negative: "text-negative",
    today: "text-today",
    change: "text-change",
  }[tone];
  return (
    <div className="surface-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("num mt-2 text-2xl font-semibold", toneClass)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
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
  factChecked?: boolean;
  report?: string;
}) {
  if (!factChecked) return null;
  const badge = (
    <span className="inline-flex items-center gap-1 rounded-full border border-positive/40 bg-positive/10 px-2 py-0.5 text-[11px] font-medium text-positive-strong">
      <Check className="size-3" />
      Faktagranskat
    </span>
  );
  if (!report) return badge;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="no-print cursor-pointer">
          {badge}
        </button>
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
