import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import {
  AiBadge,
  AiButton,
  FactCheckBadge,
  Field,
  KpiCard,
  SectionCard,
  WarningBanner,
} from "./shared";
import { callAgent } from "@/lib/nyttokalkyl/agent";
import {
  COST_TYPES,
  ROLE_NAMES,
  ROLE_SALARIES,
  STAFF_BENEFIT_TYPES,
  emptyCostItem,
  emptyStaffChange,
  emptyStaffToday,
  type CostItem,
  type CostType,
  type StaffBenefitType,
  type StaffChange,
  type StaffToday,
} from "@/lib/nyttokalkyl/types";
import { computeCostSheet, formatKr, staffAnnualCost, years } from "@/lib/nyttokalkyl/calc";

type Scenario = "today" | "change";

export function CostSheetEditor({ scenario }: { scenario: Scenario }) {
  const { state, setState } = useNyttokalkyl();
  const key = scenario === "today" ? "costToday" : "costChange";
  const sheet = state[key];
  const startYear = state.project.startYear;
  const calc = computeCostSheet(sheet, startYear);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    items?: CostItem[];
    staff?: (StaffToday & StaffChange)[];
    assumptions?: string;
  } | null>(null);
  const [factCheck, setFactCheck] = useState<{
    factChecked?: boolean;
    report?: string;
  }>({});

  const setItems = (items: CostItem[]) =>
    setState((s) => ({ ...s, [key]: { ...s[key], items } }) as typeof s);
  const setGrowth = (growth: number) =>
    setState((s) => ({ ...s, [key]: { ...s[key], growth } }) as typeof s);

  const updateItem = (i: number, patch: Partial<CostItem>) =>
    setItems(sheet.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const staffToday = state.costToday.staff;
  const staffChange = state.costChange.staff;
  const staff: (StaffToday | StaffChange)[] =
    scenario === "today" ? staffToday : staffChange;

  const setStaffToday = (rows: StaffToday[]) =>
    setState((s) => ({ ...s, costToday: { ...s.costToday, staff: rows } }));
  const setStaffChange = (rows: StaffChange[]) =>
    setState((s) => ({ ...s, costChange: { ...s.costChange, staff: rows } }));

  const updateStaff = (i: number, patch: Record<string, unknown>) => {
    if (scenario === "today") {
      setStaffToday(
        staffToday.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
      );
    } else {
      setStaffChange(
        staffChange.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
      );
    }
  };

  const addStaff = () =>
    scenario === "today"
      ? setStaffToday([...staffToday, emptyStaffToday()])
      : setStaffChange([...staffChange, emptyStaffChange()]);

  const removeStaff = (i: number) =>
    scenario === "today"
      ? setStaffToday(staffToday.filter((_, idx) => idx !== i))
      : setStaffChange(staffChange.filter((_, idx) => idx !== i));

  const suggestCosts = async () => {
    setLoading(true);
    const res = await callAgent<{
      items?: CostItem[];
      staff?: (StaffToday & StaffChange)[];
      assumptions?: string;
    }>("suggest_costs", {
      scenario,
      projectName: state.project.name,
      alt1: state.project.alt1,
      alt2: state.project.alt2,
      currentItems: sheet.items,
      currentStaff: staff,
    });
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setFactCheck({ factChecked: res.factChecked, report: res.factCheckReport });
    setSuggestion(res.data ?? {});
  };

  const applySuggestion = () => {
    const s = suggestion;
    if (!s) return;
    if (s.items?.length) {
      setItems([
        ...sheet.items,
        ...s.items.map((it) => ({
          ...emptyCostItem(startYear),
          ...it,
          costPerYear: Number(it.costPerYear) || 0,
        })),
      ]);
    }
    if (s.staff?.length) {
      if (scenario === "today") {
        setStaffToday([
          ...staffToday,
          ...s.staff.map((r) => ({
            ...emptyStaffToday(),
            role: r.role ?? "Övrig personalresurs",
            salary: Number(r.salary) || 0,
            hours: Number(r.hours) || 0,
            desc: r.desc ?? "",
          })),
        ]);
      } else {
        setStaffChange([
          ...staffChange,
          ...s.staff.map((r) => ({
            ...emptyStaffChange(),
            role: r.role ?? "Övrig personalresurs",
            salary: Number(r.salary) || 0,
            hours: Number(r.hours) || 0,
            benefitType: (r.benefitType ??
              "Omfördelningsnytta ↺") as StaffBenefitType,
            desc: r.desc ?? "",
          })),
        ]);
      }
    }
    setSuggestion(null);
    toast.success("AI-förslaget lades till. Kontrollera siffrorna.");
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Kostnadsposter"
        description="Licenser, inköp, konsulter, utbildning och annat som inte är personalkostnad."
        action={
          <AiButton onClick={() => void suggestCosts()} loading={loading}>
            Föreslå kostnader med AI
          </AiButton>
        }
      >
        {suggestion && (
          <div className="mb-5 space-y-3 rounded-xl border border-brand/30 bg-brand-soft p-4">
            <div className="flex flex-wrap items-center gap-2">
              <AiBadge />
              <p className="text-sm font-medium">Förslag från AI</p>
              <FactCheckBadge
                factChecked={factCheck.factChecked}
                report={factCheck.report}
              />
            </div>
            {suggestion.assumptions && (
              <WarningBanner>
                <strong>AI-uppskattning — verifiera innan beslut.</strong>{" "}
                {suggestion.assumptions}
              </WarningBanner>
            )}
            <ul className="space-y-1 text-sm">
              {(suggestion.items ?? []).map((it, i) => (
                <li key={`i${i}`}>
                  {it.name} — {formatKr(Number(it.costPerYear) || 0)} ({it.type})
                </li>
              ))}
              {(suggestion.staff ?? []).map((r, i) => (
                <li key={`s${i}`}>
                  {r.role} — {r.hours} h/år, {formatKr(Number(r.salary) || 0)}/mån
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" onClick={applySuggestion}>
                Lägg till förslaget
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>
                Avbryt
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3">Namn</th>
                <th className="pb-2 pr-3">Typ</th>
                <th className="pb-2 pr-3">Kostnad/år</th>
                <th className="pb-2 pr-3">Startår</th>
                <th className="pb-2 pr-3">Felmarginal %</th>
                <th className="pb-2 pr-3">Källa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sheet.items.map((it, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="py-2 pr-3">
                    <Input
                      value={it.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      placeholder="T.ex. systemlicens"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Select
                      value={it.type}
                      onValueChange={(v) => updateItem(i, { type: v as CostType })}
                    >
                      <SelectTrigger className="min-w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COST_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      className="num w-32"
                      value={it.costPerYear}
                      onChange={(e) =>
                        updateItem(i, { costPerYear: Number(e.target.value) || 0 })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      className="num w-24"
                      value={it.startYear ?? ""}
                      onChange={(e) =>
                        updateItem(i, {
                          startYear:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="num w-20"
                      value={it.margin}
                      onChange={(e) =>
                        updateItem(i, {
                          margin: Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      value={it.source}
                      onChange={(e) => updateItem(i, { source: e.target.value })}
                      placeholder="Underlag/källa"
                    />
                  </td>
                  <td className="py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Ta bort kostnadspost"
                      className="no-print text-negative"
                      onClick={() =>
                        setItems(sheet.items.filter((_, idx) => idx !== i))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sheet.items.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            Inga kostnadsposter än.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="no-print mt-3 gap-2"
          onClick={() => setItems([...sheet.items, emptyCostItem(startYear)])}
        >
          <Plus className="size-4" />
          Lägg till kostnadspost
        </Button>
      </SectionCard>

      <SectionCard
        title="Personalkostnader"
        description={
          scenario === "today"
            ? "Ange de roller och den arbetstid som går åt idag. Månadslön exkl. PO fylls i automatiskt för kända befattningar."
            : "Rader taggade Omfördelningsnytta ↺ jämförs radvis (samma radnummer) med personaltabellen i steg 2."
        }
      >
        <div className="space-y-4">
          {staff.map((row, i) => {
            const annual = staffAnnualCost(row.salary, row.hours);
            return (
              <div key={i} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-brand-dark">
                    Rad {i + 1}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Ta bort personalrad"
                    className="no-print text-negative"
                    onClick={() => removeStaff(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Befattning">
                    <Select
                      value={row.role}
                      onValueChange={(v) => {
                        const salary = ROLE_SALARIES[v];
                        updateStaff(i, {
                          role: v,
                          ...(salary !== null && salary !== undefined
                            ? { salary }
                            : {}),
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj befattning" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_NAMES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Månadslön exkl. PO">
                    <Input
                      type="number"
                      className="num"
                      value={row.salary}
                      onChange={(e) =>
                        updateStaff(i, { salary: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                  <Field label="Arbetstimmar/år" hint="Max 1760 h = heltid">
                    <Input
                      type="number"
                      className="num"
                      value={row.hours}
                      onChange={(e) =>
                        updateStaff(i, {
                          hours: Math.max(
                            0,
                            Math.min(1760, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </Field>
                  {scenario === "today" ? (
                    <Field label="Beräknad kostnad/år">
                      <div className="num flex h-9 items-center rounded-md bg-brand-soft px-3 text-sm font-semibold text-brand-dark">
                        {formatKr(annual)}
                      </div>
                    </Field>
                  ) : (
                    <Field label="Typ av nytta">
                      <Select
                        value={(row as StaffChange).benefitType}
                        onValueChange={(v) =>
                          updateStaff(i, { benefitType: v as StaffBenefitType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_BENEFIT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field
                    label={
                      scenario === "today"
                        ? "Arbetsbeskrivning"
                        : "Vad görs med frigjord tid?"
                    }
                  >
                    <Textarea
                      rows={2}
                      value={row.desc}
                      onChange={(e) => updateStaff(i, { desc: e.target.value })}
                    />
                  </Field>
                  {scenario === "change" && (
                    <Field label="Beräknad kostnad/år">
                      <div className="num flex h-9 items-center rounded-md bg-brand-soft px-3 text-sm font-semibold text-brand-dark">
                        {formatKr(annual)}
                      </div>
                    </Field>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground">Inga personalrader än.</p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="no-print mt-4 gap-2"
          onClick={addStaff}
        >
          <Plus className="size-4" />
          Lägg till personalrad
        </Button>

        <div className="mt-6 max-w-56">
          <Field label="Årlig kostnadsökning (%)" hint="Räknas från kalkylperiodens första år.">
            <Input
              type="number"
              className="num"
              value={sheet.growth}
              onChange={(e) => setGrowth(Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={`Beräknad kostnad ${startYear}–${startYear + 5}`}
        description="Nuvärde beräknas med 3 % diskonteringsränta från kalkylperiodens första år."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3">År</th>
                <th className="pb-2 pr-3">Engångskostnad</th>
                <th className="pb-2 pr-3">Löpande + personal</th>
                <th className="pb-2 pr-3">Total</th>
                <th className="pb-2">Nuvärde</th>
              </tr>
            </thead>
            <tbody className="num">
              {calc.perYear.map((r) => (
                <tr key={r.year} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{r.year}</td>
                  <td className="py-2 pr-3">{formatKr(r.oneTime)}</td>
                  <td className="py-2 pr-3">
                    {formatKr(r.recurring + r.staffCost)}
                  </td>
                  <td className="py-2 pr-3">{formatKr(r.total)}</td>
                  <td className="py-2 font-semibold">{formatKr(r.npv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Kalkylperiod: {years(startYear).join(", ")}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Summa nuvärde (sannolikt)"
            value={formatKr(calc.npvSum)}
            tone={scenario === "today" ? "today" : "change"}
          />
          <KpiCard
            label="Bästa scenario"
            value={formatKr(calc.best)}
            hint={`Felmarginal ${formatKr(calc.marginSum)}`}
            tone="positive"
          />
          <KpiCard
            label="Sämsta scenario"
            value={formatKr(calc.worst)}
            hint={`Felmarginal ${formatKr(calc.marginSum)}`}
            tone="negative"
          />
        </div>
      </SectionCard>
    </div>
  );
}
