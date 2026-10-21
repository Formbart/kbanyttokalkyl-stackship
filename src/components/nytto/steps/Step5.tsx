import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  Cell,
  ComposedChart,
} from "recharts";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { differingCosts, misplacedInvestments, moveInvestment, firstYearBreakEvenWarning, identicalCostWarning } from "@/lib/nyttokalkyl/resultPresentation";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import {
  AiButton,
  EmptyState,
  FactCheckBadge,
  KpiCard,
  SectionCard,
} from "../shared";
import { useCalculationAgent } from "@/hooks/useCalculationAgent";
import {
  baseYearOf,
  calcYears,
  computeProjectCosts,
  discountRate,
  NO_BREAK_EVEN,
  computeNetBenefit,
  computeQualitative,
  computeReallocation,
  computeReallocationOverPeriod,
  formatKr,
  formatKrCompact,
  createKrAxisFormatter,
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
  const callAgent = useCalculationAgent();
  const { state, setState } = useNyttokalkyl();
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [factCheck, setFactCheck] = useState<{
    factChecked?: boolean | undefined;
    report?: string | undefined;
  }>({});

  const { todayCalc, changeCalc } = computeProjectCosts(state);
  const realloc = computeReallocation(state.costToday.staff, state.costChange.staff);
  const net = computeNetBenefit(state, todayCalc, changeCalc);
  const qual = computeQualitative(state);
  const empty = !hasAnyData(state);
  const changeLabel = "Kostnad vid förändring";
  // Scenarios are judged for the project: worst = low today cost and high change cost.
  // Matches net.low / net.high so the chart and the interval tell the same story.
  const scenarioData = [
    {
      scenario: "Sämsta",
      idag: todayCalc.best,
      forandring: changeCalc.worst,
    },
    {
      scenario: "Sannolikt",
      idag: todayCalc.npvSum,
      forandring: changeCalc.npvSum,
    },
    {
      scenario: "Bästa",
      idag: todayCalc.worst,
      forandring: changeCalc.best,
    },
  ];


  const comparison = differingCosts(state);
  const investments = misplacedInvestments(state);
  const costTicks = createKrAxisFormatter(Math.max(...comparison.rows.flatMap((r) => [Math.abs(r.idag), Math.abs(r.forandring)])));
  const scenarioTicks = createKrAxisFormatter(Math.max(Math.abs(net.low), Math.abs(net.totalNet), Math.abs(net.high)));
  const annualTicks = createKrAxisFormatter(Math.max(...net.perYear.flatMap((r) => [Math.abs(r.net), Math.abs(r.cumulative)])));
  const netScenarios = [
    { scenario: "Sämsta", value: net.low },
    { scenario: "Sannolikt", value: net.totalNet },
    { scenario: "Bästa", value: net.high },
  ];

  const cumulativeData = net.perYear.map((r) => ({
    year: String(r.year),
    arlig: r.net,
    ackumulerat: r.cumulative,
    positiv: r.cumulative > 0 ? r.cumulative : 0,
    negativ: r.cumulative < 0 ? r.cumulative : 0,
  }));
  const reallocPeriod = computeReallocationOverPeriod(
    realloc.hoursFreed,
    realloc.valueFreed,
    state.costToday.growth,
    state.project.startYear,
    calcYears(state),
    discountRate(state),
    baseYearOf(state),
  );

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
      discountRate: discountRate(state) * 100,
      fullState: state,
      computedSummary: {
        totalCostToday: todayCalc.npvSum,
        totalCostChange: changeCalc.npvSum,
        financialNetBenefit: net.totalNet,
        netBenefitInclReallocation: net.totalNetIncl,
        baseYear: baseYearOf(state),
        breakEvenYear: net.breakEvenYear,
        freedHoursPerYear: realloc.hoursFreed,
        reallocationBenefit: reallocPeriod.totalValueFreedNPV,
      },
    });
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setFactCheck({ factChecked: res.factChecked, report: res.factCheckReport });
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
      <div className="space-y-3">
        {investments.map(({ item, index }) => (
          <div key={index} role="status" className="grid min-w-0 gap-3 rounded-lg border border-change/40 bg-change/10 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <p className="min-w-0 break-words">Engångskostnaden '{item.name || "Namnlös kostnad"}' ligger i Kostnad idag. Investeringar för förändringen hör normalt till Kostnad vid förändring – kontrollera, annars blir nettonyttan för hög.</p>
            <Button variant="outline" size="sm" className="no-print h-auto min-h-9 whitespace-normal sm:max-w-52" onClick={() => setState((current) => moveInvestment(current, index))}>Flytta till Kostnad vid förändring</Button>
          </div>
        ))}
        {firstYearBreakEvenWarning(state, net.breakEvenYear) && <p role="status" className="rounded-lg border border-change/40 bg-change/10 p-4 text-sm">Break-even redan första året – kontrollera att investeringarna ligger på rätt sida.</p>}
        {identicalCostWarning(comparison.identical, todayCalc.npvSum) && <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Merparten av kostnaderna är lika i båda alternativen och visas därför inte i diagrammet.</p>}
      </div>
      <div data-testid="result-kpis" className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Kostnad idag (nuvärde)"
          value={formatKrCompact(todayCalc.npvSum)}
          exactValue={formatKr(todayCalc.npvSum)}
          tone="today"
          hint={`${calcYears(state)} år, diskonterat till ${baseYearOf(state)}`}
        />
        <KpiCard
          label="Kostnad vid förändring"
          value={formatKrCompact(changeCalc.npvSum)}
          exactValue={formatKr(changeCalc.npvSum)}
          tone="change"
          hint={`${calcYears(state)} år, diskonterat till ${baseYearOf(state)}`}
        />
        <KpiCard
          label="Finansiell nettonytta"
          value={formatKrCompact(net.totalNet)}
          exactValue={formatKr(net.totalNet)}
          tone={net.totalNet >= 0 ? "positive" : "negative"}
          hint={`Intervall: ${formatKrCompact(net.low)} – ${formatKrCompact(net.high)}`}
        />
        <KpiCard
          label="Nettonytta inkl. omfördelning"
          value={formatKrCompact(net.totalNetIncl)}
          exactValue={formatKr(net.totalNetIncl)}
          tone={net.totalNetIncl >= 0 ? "positive" : "negative"}
          hint="Motsvarar mallens 'Ja'-läge – inte budgetpåverkande"
        />
        <KpiCard
          label="Break-even år"
          value={String(net.breakEvenYear)}
          tone={net.breakEvenYear === NO_BREAK_EVEN ? "negative" : "positive"}
          {...(net.breakEvenYearIncl !== net.breakEvenYear
            ? { hint: `Inkl. omfördelning: ${net.breakEvenYearIncl}` }
            : {})}
        />
      </div>

      <SectionCard
        title="Kostnader som skiljer alternativen åt"
        action={<AiButton onClick={() => void runReview()} loading={loading}>AI-granskning</AiButton>}
      >
        {comparison.hasDifference ? (
          <div className="h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison.rows} margin={{ left: 0, right: 8, top: 16, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="category" tickLine={false} axisLine={false} interval={0} height={62} tick={({ x, y, payload }) => {
                  const lines = String(payload.value).startsWith("Personal") ? ["Personal"] : String(payload.value).replace("Engångskostnader", "Engångs kostnader").split(" ");
                  return <text x={x} y={y} textAnchor="middle" fill="var(--color-muted-foreground)" fontSize={11}>{lines.map((line, i) => <tspan key={i} x={x} dy={i === 0 ? 14 : 13}>{line}</tspan>)}</text>;
                }} />
                <YAxis tickFormatter={costTicks} tickLine={false} axisLine={false} width={88} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatKr(v)} contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", background: "var(--color-card)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="idag" name="Kostnad idag" fill="var(--today)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
                <Bar dataKey="forandring" name={changeLabel} fill="var(--change)" isAnimationActive={false} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-8 text-center text-sm text-muted-foreground">Alternativen har samma kostnader – ingen finansiell skillnad</p>}
        <p className="mt-3 text-xs text-muted-foreground">Personal avser endast finansiellt påverkade rader.</p>
        <p className="mt-2 text-sm text-muted-foreground">Ej i diagrammet: <span className="whitespace-nowrap tabular-nums" title={formatKr(comparison.identical)}>{formatKrCompact(comparison.identical)}</span> i kostnader som är lika i båda alternativen (t.ex. personal som behålls vid omfördelning).</p>
      </SectionCard>

      <SectionCard title="Finansiell nettonytta per scenario">
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={netScenarios} margin={{ left: 0, right: 16, top: 32, bottom: 24 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="scenario" tickLine={false} axisLine={false} height={48} tickMargin={20} tick={{ fontSize: 12 }} />
              <YAxis domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]} tickFormatter={scenarioTicks} tickLine={false} axisLine={false} width={88} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatKr(v)} contentStyle={{ borderRadius: 8, borderColor: "var(--color-border)", background: "var(--color-card)" }} />
              <ReferenceLine y={0} stroke="var(--color-foreground)" strokeWidth={1.5} />
              <Bar dataKey="value" name="Finansiell nettonytta" isAnimationActive={false} maxBarSize={80}>
                {netScenarios.map((row) => <Cell key={row.scenario} fill={row.value >= 0 ? "var(--positive)" : "var(--negative)"} />)}
                <LabelList dataKey="value" position="top" formatter={(v: number) => formatKrCompact(v)} fill="var(--color-foreground)" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Sämsta = låg kostnad idag och hög kostnad vid förändring; bästa = tvärtom. Felmarginalen avser bara det som skiljer alternativen åt.</p>

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

      </SectionCard>

      <SectionCard
        title="Nettonytta per år"
        description={`Staplar: årets förändring · Linje: ackumulerat · Break-even: ${net.breakEvenYear}`}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Kalkylperiod: {state.project.startYear}–{state.project.startYear + calcYears(state) - 1}
          {" "}(antal år ändras på steg 2 · Kostnad idag)
        </p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cumulativeData} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={annualTicks}
                tickLine={false}
                axisLine={false}
                width={88}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  const row = payload?.[0]?.payload as
                    | { arlig: number; ackumulerat: number }
                    | undefined;
                  if (!active || !row) return null;
                  const sign = (v: number) => (v > 0 ? "+" : "") + formatKr(v);
                  return (
                    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm">
                      <p className="font-semibold text-foreground">{label}</p>
                      <p>Årets förändring: {sign(row.arlig)}</p>
                      <p>Ackumulerat: {sign(row.ackumulerat)}</p>
                    </div>
                  );
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="var(--color-muted-foreground)" />
              {net.breakEvenYear !== NO_BREAK_EVEN && (
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
                fillOpacity={0.2}
                isAnimationActive={false}
                legendType="none"
              />
              <Area
                dataKey="negativ"
                stroke="none"
                fill="var(--color-negative)"
                fillOpacity={0.15}
                isAnimationActive={false}
                legendType="none"
              />
              <Bar dataKey="arlig" name="Finansiell nettonytta" fill="var(--negative)" barSize={28} isAnimationActive={false}>
                {cumulativeData.map((d) => (
                  <Cell
                    key={d.year}
                    fill={d.arlig >= 0 ? "var(--color-positive)" : "var(--color-negative)"}
                  />
                ))}
              </Bar>
              <Line
                dataKey="ackumulerat"
                name="Ackumulerad finansiell nettonytta"
                stroke="var(--brand)"
                isAnimationActive={false}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="text-left text-muted-foreground"><th>År</th><th>Finansiell nettonytta</th><th>Omfördelningsnytta</th><th>Ackumulerad finansiell nettonytta</th><th>Ackumulerad inkl. omfördelning</th></tr></thead>
            <tbody className="num">{net.perYear.map((r) => <tr key={r.year} className="border-t border-border"><td className="py-2">{r.year}</td><td>{formatKr(r.net)}</td><td>{formatKr(r.reallocation)}</td><td>{formatKr(r.cumulative)}</td><td>{formatKr(r.cumulativeIncl)}</td></tr>)}</tbody>
          </table>
        </div>
        {net.breakEvenYear === NO_BREAK_EVEN && net.perYear.length > 0 && (
          <p className="mt-2 text-sm font-medium text-negative">
            Uppnås ej inom kalkylperioden
          </p>
        )}
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Belopp anges i basårets ({baseYearOf(state)}) priser. Löpande kostnader, personal och omfördelningsnytta räknas upp med årlig kostnadsökning. Engångskostnader räknas inte upp. Nuvärdet avser basåret.</li>
          <li>Felmarginalen avser bara det som skiljer alternativen åt.</li>
          <li>Omfördelningsnyttan räknas upp med löneökningen (skiljer sig från mallen, som håller den konstant).</li>
        </ul>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Omfördelningsnytta"
          description="Frigjord tid som används till annat – inte en besparing i budget"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              label={realloc.hoursFreed < 0 ? "Ökad tidsåtgång/år" : "Frigjorda timmar/år"}
              value={`${formatNumber(Math.abs(realloc.hoursFreed))} h`}
              tone={realloc.hoursFreed >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              label={realloc.valueFreed < 0 ? "Kostnad för ökad tid/år" : "Värde av frigjord tid/år"}
              value={formatKrCompact(Math.abs(realloc.valueFreed))}
          exactValue={formatKr(Math.abs(realloc.valueFreed))}
              tone={realloc.valueFreed >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              label={`Timmar under hela perioden (${calcYears(state)} år)`}
              value={`${formatNumber(reallocPeriod.totalHoursFreed)} h`}
              tone={reallocPeriod.totalHoursFreed >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              label="Omfördelningsnytta (nuvärde)"
              value={formatKrCompact(reallocPeriod.totalValueFreedNPV)}
          exactValue={formatKr(reallocPeriod.totalValueFreedNPV)}
              tone={reallocPeriod.totalValueFreedNPV >= 0 ? "positive" : "negative"}
            />
          </div>
          {realloc.hoursFreed === 0 && realloc.valueFreed === 0 && (
            <p className="mt-4 rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand-dark">
              Inget att räkna på än. Lägg till personalrader i <strong>steg 2
              (idag)</strong> och <strong>steg 3 (vid förändring)</strong> med
              samma yrkesroll, sätt nyttotyp ”Omfördelningsnytta ↺” på raden i
              steg 3 och ange färre timmar där än idag.
            </p>
          )}
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
            <div className="flex flex-wrap items-center gap-2">
              <FactCheckBadge
                factChecked={factCheck.factChecked}
                report={factCheck.report}
              />
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
                Tillförlitlighet:{" "}
                {review.confidence === "high"
                  ? "hög"
                  : review.confidence === "medium"
                    ? "medel"
                    : "låg"}
              </span>
            </div>
            {review.risks?.filter((x) => x.startsWith("KALKYLFEL:")).map((x, i) => (
              <p key={i} role="alert" className="border border-destructive bg-destructive/10 p-3 font-semibold text-negative">⚠ {x.replace(/^KALKYLFEL:\s*/, "")}</p>
            ))}
            {review.summary && <p>{review.summary}</p>}
            {[
              { title: "Risker", list: review.risks?.filter((x) => !x.startsWith("KALKYLFEL:")) },
              { title: "Saknade uppgifter", list: review.missing },
              { title: "Rekommendationer", list: review.recommendations },
            ]
              .filter((s) => s.list && s.list.length > 0)
              .map((s) => (
                <div key={s.title}>
                  <p className="font-semibold">{s.title}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                    {(s.list ?? []).map((x, i) => (
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
