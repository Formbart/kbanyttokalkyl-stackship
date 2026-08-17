import {
  DISCOUNT_RATE,
  FULL_TIME_HOURS,
  N_YEARS,
  PO_FACTOR,
  QUALITATIVE_TYPES,
  type AppState,
  type Benefit,
  type CostSheet,
  type StaffChange,
  type StaffToday,
} from "./types";

export function years(startYear: number): number[] {
  return Array.from({ length: N_YEARS }, (_, i) => startYear + i);
}

export function staffAnnualCost(salary: number, hours: number): number {
  const share = (hours || 0) / FULL_TIME_HOURS;
  const annual = (salary || 0) * 12;
  const annualPO = annual * PO_FACTOR;
  return share * annualPO;
}

export interface YearRow {
  year: number;
  oneTime: number;
  recurring: number;
  staffCost: number;
  total: number;
  npv: number;
}

export interface SheetCalc {
  perYear: YearRow[];
  npvSum: number;
  marginSum: number;
  best: number;
  worst: number;
}

export function computeCostSheet(
  sheet: CostSheet<StaffToday | StaffChange>,
  startYear: number,
): SheetCalc {
  const staffBase = sheet.staff.reduce(
    (sum, s) => sum + staffAnnualCost(s.salary, s.hours),
    0,
  );
  const perYear: YearRow[] = years(startYear).map((year, i) => {
    const growthFactor = Math.pow(1 + (sheet.growth || 0) / 100, i);
    const oneTime = sheet.items
      .filter((it) => it.type === "Engångskostnad" && it.startYear === year)
      .reduce((s, it) => s + (it.costPerYear || 0), 0);
    const recurring =
      sheet.items
        .filter(
          (it) =>
            it.type !== "Engångskostnad" &&
            it.startYear !== null &&
            it.startYear <= year,
        )
        .reduce((s, it) => s + (it.costPerYear || 0), 0) * growthFactor;
    const staffCost = staffBase * growthFactor;
    const total = oneTime + recurring + staffCost;
    const discount = Math.pow(1 + DISCOUNT_RATE, -i);
    return { year, oneTime, recurring, staffCost, total, npv: total * discount };
  });

  const npvSum = perYear.reduce((s, r) => s + r.npv, 0);
  const marginSum = sheet.items.reduce((s, it) => {
    const base = ((it.margin || 0) / 100) * (it.costPerYear || 0);
    return s + (it.type === "Engångskostnad" ? base : base * N_YEARS);
  }, 0);

  return {
    perYear,
    npvSum,
    marginSum,
    best: npvSum - marginSum,
    worst: npvSum + marginSum,
  };
}

export interface Reallocation {
  hoursFreed: number;
  valueFreed: number;
}

export function computeReallocation(
  today: StaffToday[],
  change: StaffChange[],
): Reallocation {
  let hoursFreed = 0;
  let valueFreed = 0;
  change.forEach((c, i) => {
    const t = today[i];
    if (!t) return;
    if (c.benefitType !== "Omfördelningsnytta ↺") return;
    hoursFreed += (t.hours || 0) - (c.hours || 0);
    valueFreed +=
      staffAnnualCost(t.salary, t.hours) - staffAnnualCost(c.salary, c.hours);
  });
  return { hoursFreed, valueFreed };
}

export function movementLabel(movement: number): string {
  const grades = [
    "Ingen förflyttning",
    "Liten förflyttning",
    "Medium förflyttning",
    "Stor förflyttning",
    "Mycket stor förflyttning",
  ];
  const abs = Math.min(Math.abs(movement), 4);
  if (movement === 0) return grades[0];
  if (movement > 0) return grades[abs];
  const negatives = [
    "Ingen försämring",
    "Liten försämring",
    "Medium försämring",
    "Stor försämring",
    "Mycket stor försämring",
  ];
  return negatives[abs];
}

export interface QualRow {
  index: number;
  benefit: Benefit;
  current: number;
  expected: number;
  movement: number;
  label: string;
}

export function computeQualitative(state: AppState): QualRow[] {
  return state.project.benefits
    .map((benefit, index) => ({ benefit, index }))
    .filter(({ benefit }) =>
      QUALITATIVE_TYPES.includes(benefit.type as never),
    )
    .map(({ benefit, index }) => {
      const rating = state.qualRatings[index] ?? { current: 3, expected: 3 };
      const movement = rating.expected - rating.current;
      return {
        index,
        benefit,
        current: rating.current,
        expected: rating.expected,
        movement,
        label: movementLabel(movement),
      };
    });
}

export interface NetRow {
  year: number;
  net: number;
  cumulative: number;
}

export interface NetBenefit {
  perYear: NetRow[];
  totalNet: number;
  breakEvenYear: number | "Aldrig";
}

export function computeNetBenefit(
  state: AppState,
  todayCalc: SheetCalc,
  changeCalc: SheetCalc,
  includeRealloc: boolean,
): NetBenefit {
  const { valueFreed } = computeReallocation(
    state.costToday.staff,
    state.costChange.staff,
  );
  let cumulative = 0;
  let breakEvenYear: number | null = null;
  const perYear = years(state.project.startYear).map((year, i) => {
    const discount = Math.pow(1 + DISCOUNT_RATE, -i);
    const reallocNPV = includeRealloc
      ? valueFreed *
        Math.pow(1 + (state.costChange.growth || 0) / 100, i) *
        discount
      : 0;
    const adjustedChange = (changeCalc.perYear[i]?.npv ?? 0) - reallocNPV;
    const net = (todayCalc.perYear[i]?.npv ?? 0) - adjustedChange;
    cumulative += net;
    if (breakEvenYear === null && cumulative >= 0) breakEvenYear = year;
    return { year, net, cumulative };
  });

  return {
    perYear,
    totalNet: cumulative,
    breakEvenYear: breakEvenYear ?? "Aldrig",
  };
}

export function formatKr(value: number): string {
  return (
    new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(
      Math.round(value || 0),
    ) + " kr"
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(
    Math.round(value || 0),
  );
}

export function hasAnyData(state: AppState): boolean {
  return (
    state.project.name.trim().length > 0 ||
    state.project.benefits.length > 0 ||
    state.costToday.items.length > 0 ||
    state.costToday.staff.length > 0 ||
    state.costChange.items.length > 0 ||
    state.costChange.staff.length > 0
  );
}
