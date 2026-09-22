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

export function staffAnnualCost(
  salary: number,
  hours: number,
  count = 1,
): number {
  const share = (hours || 0) / FULL_TIME_HOURS;
  const annual = (salary || 0) * 12;
  const annualPO = annual * PO_FACTOR;
  return share * annualPO * (count || 0);
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
    (sum, s) => sum + staffAnnualCost(s.salary, s.hours, s.count ?? 1),
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

const normalizeRole = (role: string) => (role || "").trim().toLowerCase();

export function computeReallocation(
  today: StaffToday[],
  change: StaffChange[],
): Reallocation {
  let hoursFreed = 0;
  let valueFreed = 0;
  const usedToday = new Set<number>();

  // Matcha i första hand på roll (samma yrkesroll idag och vid förändring),
  // annars på radposition — annars jämförs raden mot noll.
  change.forEach((c, i) => {
    if (c.benefitType !== "Omfördelningsnytta ↺") return;

    let matchIndex = today.findIndex(
      (t, idx) =>
        !usedToday.has(idx) &&
        normalizeRole(t.role).length > 0 &&
        normalizeRole(t.role) === normalizeRole(c.role),
    );
    if (matchIndex === -1 && today[i] && !usedToday.has(i)) matchIndex = i;
    if (matchIndex !== -1) usedToday.add(matchIndex);

    const t = matchIndex === -1 ? null : today[matchIndex]!;
    hoursFreed +=
      (t?.hours || 0) * (t?.count ?? 1) - (c.hours || 0) * (c.count ?? 1);
    valueFreed +=
      (t ? staffAnnualCost(t.salary, t.hours, t.count ?? 1) : 0) -
      staffAnnualCost(c.salary, c.hours, c.count ?? 1);
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
  if (movement === 0) return grades[0]!;
  if (movement > 0) return grades[abs]!;
  const negatives = [
    "Ingen försämring",
    "Liten försämring",
    "Medium försämring",
    "Stor försämring",
    "Mycket stor försämring",
  ];
  return negatives[abs]!;
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
