import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { AiButton, EmptyState, KpiCard, SectionCard } from "../shared";
import { callAgent } from "@/lib/nyttokalkyl/agent";
import {
  computeCostSheet,
  computeNetBenefit,
  computeQualitative,
  computeReallocation,
  formatKr,
  formatNumber,
  hasAnyData,
} from "@/lib/nyttokalkyl/calc";
import { QUALITATIVE_TYPES } from "@/lib/nyttokalkyl/types";
import { cn } from "@/lib/utils";

interface Review {
  summary?: string;
  risks?: string[];
  missing?: string[];
  recommendations?: string[];
  confidence?: "low" | "medium" | "high";
}

export function Step5() {
  const { state, setState } = useNyttokalkyl();
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review | null>(null);

  const todayCalc = computeCostSheet(state.costToday, state.project.startYear);
  const changeCalc = computeCostSheet(state.costChange, state.project.startYear);
  const realloc = computeReallocation(state.costToday.staff, state.costChange.staff);
  const net = computeNetBenefit(
    state,
    todayCalc,
    changeCalc,
    state.reallocationInGraph,
  );
  const qual = computeQualitative(state);

  const empty = !hasAnyData(state);

  // När omfördelningsnyttan ingår räknas frigjord tid som minskad kostnad vid
  // förändring — visa samma justering i scenariografen.
  const reallocAdjustment = state.reallocationInGraph
    ? changeCalc.npvSum - (todayCalc.npvSum - net.totalNet)
    : 0;
  const changeLabel = state.reallocationInGraph
    ? "Kostnad vid förändring (inkl. omfördelning)"
    : "Kostnad vid förändring";

  const scenarioData = [
    {
      scenario: "Sämsta",
      idag: Math.round(todayCalc.worst),
      forandring: Math.round(changeCalc.worst - reallocAdjustment),
    },
    {
      scenario: "Sannolikt",
      idag: Math.round(todayCalc.npvSum),
      forandring: Math.round(changeCalc.npvSum - reallocAdjustment),
    },
    {
      scenario: "Bästa",
      idag: Math.round(todayCalc.best),
      forandring: Math.round(changeCalc.best - reallocAdjustment),
    },
  ];


  const cumulativeData = net.perYear.map((r) => ({
    year: String(r.year),
    ackumulerat: Math.round(r.cumulative),
    positiv: r.cumulative > 0 ? Math.round(r.cumulative) : 0,
    negativ: r.cumulative < 0 ? Math.round(r.cumulative) : 0,
  }));

  const internal = qual.filter((q) => q.benefit.gynnas === "Intern nytta").length;
  const external = qual.filter((q) => q.benefit.gynnas === "Extern nytta").length;
  const movementByType = QUALITATIVE_TYPES.map((t) => ({
    type: t,
    total: qual
      .filter((q) => q.benefit.type === t)
      .reduce((s, q) => s + q.movement, 0),
    count: qual.filter((q) => q.benefit.type === t).length,
  }));
  const mostImportant =
    state.project.benefits.find((b) => b.rank === "1: Viktigaste nyttan") ?? null;

  const runReview = async () => {
    setLoading(true);
    const res = await callAgent<Review>("review_calculation", {
      fullState: state,
      computedSummary: {
        todayNPV: todayCalc.npvSum,
        changeNPV: changeCalc.npvSum,
        netBenefit: net.totalNet,
        breakEvenYear: net.breakEvenYear,
        reallocationHours: realloc.hoursFreed,
        reallocationValue: realloc.valueFreed,
      },
    });
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setReview(res.data ?? {});
  };

  if (empty) {
    return (
      <SectionCard title="Resultat">
        <EmptyState title="Ingen data att räkna på än">
          Fyll i grundinformation i steg 1 och kostnader i steg 2 och 3 — då
          byggs dashboarden med KPI:er, scenariojämförelse och break-even upp här.
        </EmptyState>
      </SectionCard>
    );
  }

  return (
    <div className="print-full space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Kostnad idag (nuvärde)"
          value={formatKr(todayCalc.npvSum)}
          tone="today"
          hint="6 år, diskonterat"
        />
        <KpiCard
          label="Kostnad vid förändring"
          value={formatKr(changeCalc.npvSum)}
          tone="change"
          hint="6 år, diskonterat"
        />
        <KpiCard
          label="Finansiell nettonytta"
          value={formatKr(net.totalNet)}
          tone={net.totalNet >= 0 ? "positive" : "negative"}
          hint={
            state.reallocationInGraph
              ? "Inkl. omfördelningsnytta"
              : "Exkl. omfördelningsnytta"
          }
        />
        <KpiCard
          label="Break-even år"
          value={String(net.breakEvenYear)}
          tone={net.breakEvenYear === "Aldrig" ? "negative" : "positive"}
        />
      </div>

      <SectionCard
        title="Kostnad idag vs vid förändring"
        description="Summa nuvärde över kalkylperioden i tre scenarier."
        action={
          <AiButton onClick={() => void runReview()} loading={loading}>
            AI-granskning
          </AiButton>
        }
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scenarioData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="scenario" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 1000)} tkr`}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                formatter={(v: number) => formatKr(v)}
                contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)" }}
              />
              <Legend />
              <Bar
                dataKey="idag"
                name="Kostnad idag"
                fill="var(--color-today)"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="forandring"
                name={changeLabel}
                fill="var(--color-change)"
                radius={[6, 6, 0, 0]}
              />

            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3">Scenario</th>
                <th className="pb-2 pr-3">Kostnad idag</th>
                <th className="pb-2 pr-3">Vid förändring</th>
                <th className="pb-2">Skillnad</th>
              </tr>
            </thead>
            <tbody className="num">
              {scenarioData.map((r) => (
                <tr key={r.scenario} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{r.scenario}</td>
                  <td className="py-2 pr-3">{formatKr(r.idag)}</td>
                  <td className="py-2 pr-3">{formatKr(r.forandring)}</td>
                  <td
                    className={cn(
                      "py-2 font-semibold",
                      r.idag - r.forandring >= 0
                        ? "text-positive-strong"
                        : "text-negative",
                    )}
                  >
                    {formatKr(r.idag - r.forandring)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="no-print mt-5 flex items-center gap-3 rounded-xl bg-brand-soft px-4 py-3">
          <Switch
            checked={state.reallocationInGraph}
            onCheckedChange={(v) =>
              setState((s) => ({ ...s, reallocationInGraph: v }))
            }
          />
          <span className="text-sm">
            Inkludera omfördelningsnytta i grafen
            <span className="block text-xs text-muted-foreground">
              Räknar frigjord tid som minskad kostnad vid förändring.
            </span>
            {realloc.valueFreed === 0 && (
              <span className="mt-1 block text-xs text-negative">
                Ingen frigjord tid att räkna med än — lägg till personalrader i
                steg 2 och 3 med nyttotyp ”Omfördelningsnytta ↺” och lägre antal
                timmar vid förändring.
              </span>
            )}
          </span>
        </label>

      </SectionCard>

      <SectionCard
        title="Ackumulerad nettovinst per år"
        description={`Break-even: ${net.breakEvenYear}`}
      >
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v / 1000)} tkr`}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                formatter={(v: number) => formatKr(v)}
                contentStyle={{ borderRadius: 12, borderColor: "var(--color-border)" }}
              />
              <ReferenceLine y={0} stroke="var(--color-muted-foreground)" />
              {net.breakEvenYear !== "Aldrig" && (
                <ReferenceLine
                  x={String(net.breakEvenYear)}
                  stroke="var(--color-positive-strong)"
                  strokeDasharray="4 4"
                  label={{ value: "Break-even", position: "insideTopRight", fontSize: 12 }}
                />
              )}
              <Area
                dataKey="positiv"
                stroke="none"
                fill="var(--color-positive)"
                fillOpacity={0.25}
                isAnimationActive={false}
              />
              <Area
                dataKey="negativ"
                stroke="none"
                fill="var(--color-negative)"
                fillOpacity={0.2}
                isAnimationActive={false}
              />
              <Line
                dataKey="ackumulerat"
                name="Ackumulerad nettovinst"
                stroke="var(--color-brand)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Omfördelningsnytta"
          description="Frigjord tid som används till annat värdeskapande arbete."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              label="Frigjorda timmar/år"
              value={`${formatNumber(realloc.hoursFreed)} h`}
              tone={realloc.hoursFreed >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              label="Värde av frigjord tid/år"
              value={formatKr(realloc.valueFreed)}
              tone={realloc.valueFreed >= 0 ? "positive" : "negative"}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Kvalitativa nyttor och miljönyttor"
          description="Bedömd förflyttning från steg 4."
        >
          {qual.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga kvalitativa nyttor eller miljönyttor bedömda än.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <span className="num font-semibold">{internal}</span> interna och{" "}
                <span className="num font-semibold">{external}</span> externa nyttor.
              </p>
              <ul className="space-y-1">
                {movementByType
                  .filter((m) => m.count > 0)
                  .map((m) => (
                    <li key={m.type} className="flex justify-between gap-3">
                      <span>{m.type}</span>
                      <span
                        className={cn(
                          "num font-semibold",
                          m.total >= 0 ? "text-positive-strong" : "text-negative",
                        )}
                      >
                        {m.total > 0 ? `+${m.total}` : m.total} steg
                      </span>
                    </li>
                  ))}
              </ul>
              <p className="rounded-lg bg-brand-soft px-3 py-2 text-brand-dark">
                <strong>Viktigaste nyttan:</strong>{" "}
                {mostImportant
                  ? [
                      mostImportant.change && `Genom att ${mostImportant.change}`,
                      mostImportant.benefit &&
                        `vilket leder till ${mostImportant.benefit}`,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : "Ingen nytta är rangordnad som nummer 1 än."}
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      {review && (
        <SectionCard title="AI-granskning av kalkylen">
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
                Tillförlitlighet:{" "}
                {review.confidence === "high"
                  ? "hög"
                  : review.confidence === "medium"
                    ? "medel"
                    : "låg"}
              </span>
            </div>
            {review.summary && <p>{review.summary}</p>}
            {[
              { title: "Risker", list: review.risks },
              { title: "Saknade uppgifter", list: review.missing },
              { title: "Rekommendationer", list: review.recommendations },
            ]
              .filter((s) => s.list && s.list.length > 0)
              .map((s) => (
                <div key={s.title}>
                  <p className="font-semibold">{s.title}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {s.list!.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
