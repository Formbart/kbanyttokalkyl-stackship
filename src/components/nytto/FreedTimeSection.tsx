import { Button } from "@/components/ui/button";
import { computeFreedTime, formatKr, formatKrCompact, formatNumber } from "@/lib/nyttokalkyl/calc";
import { KpiCard, SectionCard } from "./shared";

export function FreedTimeSection({ freedTime, onOpenChange }: {
  freedTime: ReturnType<typeof computeFreedTime>;
  onOpenChange: () => void;
}) {
  const groups = [
    { label: "Frigjord tid totalt", hours: freedTime.totalFreedHours, value: freedTime.totalFreedValue,
      npv: freedTime.totals.totalFreedValue, hint: "All personaltid som frigörs av förändringen" },
    { label: "varav omfördelad", hours: freedTime.reallocatedHours, value: freedTime.reallocatedValue,
      npv: freedTime.totals.reallocatedValue, hint: "Tiden används till annat – inte en besparing i budget. Ingår i 'Nettonytta inkl. omfördelning'." },
    { label: "varav avvecklad", hours: freedTime.removedHours, value: freedTime.removedValue,
      npv: freedTime.totals.removedValue, hint: "Kostnaden försvinner – ingår redan i den finansiella nettonyttan och räknas inte igen." },
  ];
  return (
    <SectionCard title="Omfördelningsnytta" description="Frigjord tid som används till annat – inte en besparing i budget" className="print-full">
      <div data-testid="freed-time-section" className="space-y-4">
        <div className="grid min-w-0 gap-4 md:grid-cols-3">
          {groups.map((group) => <div key={group.label} className="min-w-0">
            <KpiCard label={group.label} value={`${formatNumber(group.hours)} h/år`} tone="positive" hint={group.hint} />
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="text-muted-foreground">Värde/år i basårets priser</dt><dd className="num" title={formatKr(group.value)}>{formatKrCompact(group.value)} <span className="block text-xs text-muted-foreground">{formatKr(group.value)}</span></dd></div>
              <div><dt className="text-muted-foreground">Nuvärde över perioden</dt><dd className="num font-semibold" title={formatKr(group.npv)}>{formatKrCompact(group.npv)} <span className="block text-xs font-normal text-muted-foreground">{formatKr(group.npv)}</span></dd></div>
            </dl>
          </div>)}
        </div>
        {freedTime.totalFreedHours === 0 && <p className="text-sm text-muted-foreground">Förändringen frigör ingen personaltid.</p>}
        {freedTime.totalFreedHours > 0 && freedTime.reallocatedHours === 0 && (
          <div role="status" className="rounded-lg border border-today/40 bg-today/10 p-4 text-sm">
            <p>All frigjord tid är markerad som Finansiell nytta och ingår därför i den finansiella nettonyttan. Om personalen finns kvar och tiden används till annat – ändra typ till Omfördelningsnytta ↺ i Kostnad vid förändring.</p>
            <Button variant="link" size="sm" className="no-print mt-2 h-auto whitespace-normal p-0 text-today" onClick={onOpenChange}>Kostnad vid förändring →</Button>
          </div>
        )}
        {freedTime.increasedHours > 0 && <p className="text-sm font-medium text-change">Ökad tidsåtgång: {formatNumber(freedTime.increasedHours)} h/år ({formatKr(freedTime.increasedValue)}/år)</p>}
        {freedTime.rows.length > 0 && <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 pr-3">Befattning</th><th className="pb-2 pr-3">Typ av nytta</th><th className="pb-2 pr-3">Frigjorda timmar/år</th><th className="pb-2 pr-3">Värde/år (kr)</th><th className="pb-2">Vad gör medarbetarna med tiden</th></tr></thead>
            <tbody>{freedTime.rows.map((row) => <tr key={row.changeIndex} className="border-t border-border"><td className="py-3 pr-3">{row.role}</td><td className="py-3 pr-3">{row.benefitType}</td><td className="num py-3 pr-3">{formatNumber(row.freedHours)}</td><td className="num py-3 pr-3">{formatKr(row.freedValue)}</td><td className="max-w-72 whitespace-pre-wrap break-words py-3">{row.desc || "–"}</td></tr>)}</tbody>
          </table>
        </div>}
      </div>
    </SectionCard>
  );
}