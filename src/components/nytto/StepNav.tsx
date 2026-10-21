import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUALITATIVE_TYPES, type AppState } from "@/lib/nyttokalkyl/types";

export const STEPS = [
  { id: 1, title: "Grundinformation", short: "Grundinfo" },
  { id: 2, title: "Kostnad idag", short: "Kostnad idag" },
  { id: 3, title: "Kostnad vid förändring", short: "Vid förändring" },
  { id: 4, title: "Kvalitativa nyttor", short: "Kvalitativa" },
  { id: 5, title: "Resultat", short: "Resultat" },
  { id: 6, title: "Uppföljning", short: "Uppföljning" },
] as const;

export function isStepComplete(step: number, state: AppState): boolean {
  switch (step) {
    case 1:
      return (
        state.project.name.trim() !== "" &&
        state.project.alt1.trim() !== "" &&
        state.project.alt2.trim() !== "" &&
        state.project.benefits.length > 0
      );
    case 2:
      return state.costToday.items.length > 0 || state.costToday.staff.length > 0;
    case 3:
      return (
        state.costChange.items.length > 0 || state.costChange.staff.length > 0
      );
    case 4: {
      const rows = state.project.benefits
        .map((b, i) => ({ b, i }))
        .filter(({ b }) => QUALITATIVE_TYPES.includes(b.type as never));
      return rows.length > 0 && rows.every(({ i }) => state.qualRatings[i]);
    }
    case 5:
      return (
        (state.costToday.items.length > 0 || state.costToday.staff.length > 0) &&
        (state.costChange.items.length > 0 || state.costChange.staff.length > 0)
      );
    case 6:
      return (
        state.project.benefits.length > 0 &&
        state.project.benefits.every(
          (_, i) => (state.followUp[i]?.effektmal ?? "").trim() !== "",
        )
      );
    default:
      return false;
  }
}

export function StepNav({
  current,
  state,
  onSelect,
}: {
  current: number;
  state: AppState;
  onSelect: (step: number) => void;
}) {
  return (
    <nav className="no-print lg:w-64 lg:shrink-0" aria-label="Stegnavigering">
      <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {STEPS.map((s) => {
          const done = isStepComplete(s.id, state);
          const active = current === s.id;
          return (
            <li key={s.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                data-step={s.id}
                onClick={() => onSelect(s.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm transition-colors lg:rounded-xl lg:px-3.5 lg:py-2.5",
                  active
                    ? "border-brand bg-brand text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-brand-soft",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    done
                      ? "bg-positive-strong text-primary-foreground"
                      : active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-brand-soft text-brand-dark",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : s.id}
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal lg:text-left">
                  <span className="lg:hidden">{s.short}</span>
                  <span className="hidden lg:inline">{s.title}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
