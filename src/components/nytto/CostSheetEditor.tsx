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
import { Info, Plus, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { usePositions } from "@/hooks/usePositions";
import { positionLabel } from "@/lib/nyttokalkyl/positionLabel";
import {
  COST_TYPES,
  FORVALTNINGAR,
  FORVALTNING_OVRIGT,
  FULL_TIME_HOURS,
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
import { calcYears, computeCostSheet, formatKr, itemsOutsidePeriod, staffAnnualCost, years } from "@/lib/nyttokalkyl/calc";
import { CalcYearsInput } from "./CalcYearsInput";

function CostLabel() {
  return (
    <span className="inline-flex items-center gap-1.5">
      Beräknad kostnad/år
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Hur kostnaden beräknas"
            className="no-print inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <Info className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 text-sm leading-relaxed">
          <p className="font-semibold">Så beräknas kostnaden</p>
          <p className="mt-1.5">
            Månadslön × 12 × 1,4024 (PO-pålägg) × tjänstgöringsgrad × antal
            personer.
          </p>
          <p className="mt-1.5">
            Exempel: 32 000 kr/mån, 100 %, 1 person = 538 521 kr/år.
          </p>
          <p className="mt-1.5">
            Deltid räknas som andel av 1 760 timmar, så 50 % ger halva
            beloppet.
          </p>
        </PopoverContent>
      </Popover>
    </span>
  );
}

type Scenario = "today" | "change";

export function CostSheetEditor({ scenario }: { scenario: Scenario }) {
  const { state, setState } = useNyttokalkyl();
  const { personalData } = usePositions();
  const key = scenario === "today" ? "costToday" : "costChange";
  const sheet = state[key];
  const startYear = state.project.startYear;
  const nYears = calcYears(state);
  const calc = computeCostSheet(sheet, startYear, nYears);
  const outside = itemsOutsidePeriod(sheet, startYear, nYears);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    items?: CostItem[];
    staff?: (StaffToday & StaffChange)[];
    assumptions?: string;
  } | null>(null);
  const [factCheck, setFactCheck] = useState<{
    factChecked?: boolean | undefined;
    report?: string | undefined;
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
            hours: Number(r.hours) || FULL_TIME_HOURS,
            count: Number(r.count) || 1,
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
            hours: Number(r.hours) || FULL_TIME_HOURS,
            count: Number(r.count) || 1,
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
                      value={it.costPerYear || ""}
                      placeholder="Ange belopp"
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
                      value={it.margin || ""}
                      placeholder="0"
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
            const count = row.count ?? 1;
            const annual = staffAnnualCost(row.salary, row.hours, count);
            const employmentRate = row.hours / FULL_TIME_HOURS;
            const monthlySalaryAtRate = row.salary * employmentRate;
            const forvaltning = row.forvaltning ?? FORVALTNING_OVRIGT;
            const isOvrigt = forvaltning === FORVALTNING_OVRIGT;
            const positionList = personalData[forvaltning] ?? [];
            const salaryLocked =
              !isOvrigt &&
              row.positionIndex !== null &&
              row.positionIndex !== undefined &&
              positionList.length > 0;
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
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Förvaltning">
                    <Select
                      value={row.forvaltning ?? FORVALTNING_OVRIGT}
                      onValueChange={(v) =>
                        updateStaff(i, {
                          forvaltning: v,
                          positionIndex: null,
                          role: "Övrig personalresurs",
                          salary: 0,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj förvaltning" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={FORVALTNING_OVRIGT}>
                          {FORVALTNING_OVRIGT}
                        </SelectItem>
                        {FORVALTNINGAR.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Befattning">
                    {isOvrigt ? (
                      <Select
                        value={row.role}
                        onValueChange={(v) => {
                          const salary = ROLE_SALARIES[v];
                          updateStaff(i, {
                            role: v,
                            positionIndex: null,
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
                    ) : positionList.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                        Inga befattningar importerade för denna förvaltning ännu
                        — se Administration.
                      </p>
                    ) : (
                      <Select
                        value={
                          row.positionIndex === null ||
                          row.positionIndex === undefined
                            ? ""
                            : String(row.positionIndex)
                        }
                        onValueChange={(v) => {
                          const idx = Number(v);
                          const position = positionList[idx];
                          if (!position) return;
                          updateStaff(i, {
                            positionIndex: idx,
                            role: position.befattning,
                            salary: position.manadslon,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Välj befattning" />
                        </SelectTrigger>
                        <SelectContent>
                          {positionList.map((p, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {positionLabel(p)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field label="Antal personer" hint="Hur många som har rollen">
                    <Input
                      type="number"
                      className="num"
                      min={0}
                      value={count}
                      onChange={(e) =>
                        updateStaff(i, {
                          count: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Månadslön exkl. PO"
                    hint={
                      salaryLocked
                        ? `Hämtad från befattningslistan: ${formatKr(row.salary || 0)}/mån per person`
                        : `Heltidslön: ${formatKr(row.salary || 0)}/mån per person`
                    }
                  >
                    <Input
                      type="number"
                      className="num"
                      readOnly={salaryLocked}
                      value={
                        monthlySalaryAtRate
                          ? Math.round(monthlySalaryAtRate)
                          : ""
                      }
                      placeholder="Ange månadslön"
                      onChange={(e) => {
                        const monthlySalary = Number(e.target.value) || 0;
                        updateStaff(i, {
                          salary:
                            employmentRate > 0
                              ? monthlySalary / employmentRate
                              : monthlySalary,
                        });
                      }}
                    />
                  </Field>
                  <Field
                    label="Tjänstgöringsgrad %"
                    hint={`100 % = ${FULL_TIME_HOURS} h/år`}
                  >
                    <Input
                      type="number"
                      className="num"
                      min={0}
                      max={100}
                      value={
                        row.hours
                          ? Math.round((row.hours / FULL_TIME_HOURS) * 1000) / 10
                          : ""
                      }
                      placeholder="100"
                      onChange={(e) => {
                        const pct = Math.max(
                          0,
                          Math.min(100, Number(e.target.value) || 0),
                        );
                        updateStaff(i, {
                          hours: Math.round(FULL_TIME_HOURS * (pct / 100)),
                        });
                      }}
                    />
                  </Field>
                  <Field
                    label="Arbetstimmar/år"
                    hint={`Max ${FULL_TIME_HOURS} h = heltid`}
                  >
                    <Input
                      type="number"
                      className="num"
                      value={row.hours || ""}
                      onChange={(e) =>
                        updateStaff(i, {
                          hours: Math.max(
                            0,
                            Math.min(FULL_TIME_HOURS, Number(e.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </Field>

                  {scenario === "today" ? (
                    <Field
                      label={<CostLabel />}
                      hint={count > 1 ? `Totalt för ${count} personer` : ""}
                    >
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
                    <Field label={<CostLabel />}>
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
              value={sheet.growth || ""}
              placeholder="0"
              onChange={(e) => setGrowth(Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={`Beräknad kostnad ${startYear}–${startYear + nYears - 1}`}
        description="Nuvärde beräknas med 3 % diskonteringsränta från kalkylperiodens första år."
      >
        <div className="no-print mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor={`calc-years-${scenario}`} className="text-sm font-medium text-foreground">
            Antal år
          </label>
          <CalcYearsInput
            id={`calc-years-${scenario}`}
            value={nYears}
            onCommit={(n) =>
              setState((s) => ({ ...s, project: { ...s.project, calculationYears: n } }))
            }
          />
          <span className="text-xs text-muted-foreground">
            Gäller hela kalkylen (steg 2, 3 och 5)
          </span>
        </div>
...
        <p className="mt-2 text-xs text-muted-foreground">
          Kalkylperiod: {years(startYear, nYears).join(", ")}
        </p>
        {outside > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {outside} kostnadspost(er) ligger utanför den valda kalkylperioden och räknas inte med.
          </p>
        )}
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
