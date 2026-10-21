import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { AiButton, EmptyState, FactCheckBadge, SectionCard } from "../shared";
import { useCalculationAgent } from "@/hooks/useCalculationAgent";
import { computeQualitative, movementLabel } from "@/lib/nyttokalkyl/calc";
import {
  RANK_OPTIONS,
  benefitSentence,
  type Rank,
} from "@/lib/nyttokalkyl/types";
import { cn } from "@/lib/utils";

export function Step4() {
  const callAgent = useCalculationAgent();
  const { state, setState, setQualRating } = useNyttokalkyl();
  const rows = computeQualitative(state);
  const [factChecks, setFactChecks] = useState<Record<number, { factChecked?: boolean | undefined; report?: string | undefined }>>({});
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const setRank = (index: number, rank: Rank) =>
    setState((s) => ({
      ...s,
      project: {
        ...s.project,
        benefits: s.project.benefits.map((b, i) =>
          i === index ? { ...b, rank } : b,
        ),
      },
    }));

  const assess = async (index: number) => {
    const row = rows.find((r) => r.index === index);
    if (!row) return;
    setLoadingIndex(index);
    const res = await callAgent<{
      current: number;
      expected: number;
      rationale?: string;
      rank_suggestion?: Rank | null;
    }>("assess_qualitative", {
      benefitText: benefitSentence(row.benefit),
      type: row.benefit.type,
      gynnas: row.benefit.gynnas,
    });
    setLoadingIndex(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setFactChecks((s) => ({ ...s, [index]: { factChecked: res.factChecked, report: res.factCheckReport } }));
    const d = res.data;
    if (!d) return;
    const current = Math.min(5, Math.max(1, Number(d.current) || 3));
    const expected = Math.min(5, Math.max(1, Number(d.expected) || 3));
    const rationale = typeof d.rationale === "string" ? d.rationale.trim() : "";
    // New AI assessment replaces the previous rationale (or clears it).
    setState((s) => ({
      ...s,
      qualRatings: {
        ...s.qualRatings,
        [index]: rationale ? { current, expected, rationale } : { current, expected },
      },
    }));
    if (d.rank_suggestion) setRank(index, d.rank_suggestion);
    toast.success("AI-bedömning ifylld — justera gärna.");
  };

  if (rows.length === 0) {
    return (
      <SectionCard title="Kvalitativa nyttor och miljönyttor">
        <EmptyState title="Inga kvalitativa nyttor eller miljönyttor än">
          Gå tillbaka till steg 1 och sätt typen Kvalitativ nytta 🖤 eller
          Miljönytta ♻️ på minst en nytta. Raderna skapas då automatiskt här.
        </EmptyState>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {rows.map((row) => {
        const rating = state.qualRatings[row.index] ?? {
          current: 3,
          expected: 3,
        };
        return (
          <SectionCard key={row.index}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-dark">
                    {row.benefit.type}
                  </span>
                  {row.benefit.gynnas && (
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {row.benefit.gynnas}
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-2xl text-sm font-medium text-foreground">
                  {benefitSentence(row.benefit) || "(Nyttan saknar text)"}
                </p>
              </div>
              <AiButton
                onClick={() => void assess(row.index)}
                loading={loadingIndex === row.index}
              >
                AI-bedömning
              </AiButton>
            </div>

            <FactCheckBadge {...factChecks[row.index]} />
            <div className="mt-5 grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Nuläge</span>
                  <span className="num text-brand-dark">{rating.current}</span>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[rating.current]}
                  onValueChange={([v]) =>
                    setQualRating(row.index, v ?? 3, rating.expected)
                  }
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    Förväntat läge
                    {rating.rationale && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Visa AI:ns motivering"
                            className="text-muted-foreground hover:text-brand-dark print:hidden"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 text-sm">
                          <p className="mb-1 font-semibold">AI:ns motivering</p>
                          <p className="text-muted-foreground">{rating.rationale}</p>
                        </PopoverContent>
                      </Popover>
                    )}
                  </span>
                  <span className="num text-brand-dark">{rating.expected}</span>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[rating.expected]}
                  onValueChange={([v]) =>
                    setQualRating(row.index, rating.current, v ?? 3)
                  }
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "num rounded-full px-3 py-1 text-sm font-semibold",
                  row.movement > 0
                    ? "bg-positive/15 text-positive-strong"
                    : row.movement < 0
                      ? "bg-negative/15 text-negative"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {row.movement > 0 ? `+${row.movement}` : row.movement}{" "}
                {movementLabel(row.movement)}
              </span>
              <div className="w-full max-w-xs">
                <Select
                  value={row.benefit.rank || "Övriga nyttor"}
                  onValueChange={(v) =>
                    setRank(row.index, (v === "Övriga nyttor" ? "" : v) as Rank)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RANK_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                    <SelectItem value="Övriga nyttor">Övriga nyttor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </SectionCard>
        );
      })}
    </div>
  );
}
