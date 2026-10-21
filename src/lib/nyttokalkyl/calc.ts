import {
  DISCOUNT_RATE,
  FULL_TIME_HOURS,
  DEFAULT_CALCULATION_YEARS,
  MAX_CALCULATION_YEARS,
  MIN_CALCULATION_YEARS,
  PO_FACTOR,
  QUALITATIVE_TYPES,
  emptyStaffChange,
  newStaffId,
  staffMarginOf,
  type AppState,
  type Benefit,
  type CostSheet,
  type StaffChange,
  type StaffToday,
} from "./types";

export function clampYears(n: number | null | undefined): number {
  const v = Math.round(Number(n) || DEFAULT_CALCULATION_YEARS);
  return Math.min(MAX_CALCULATION_YEARS, Math.max(MIN_CALCULATION_YEARS, v));
}

export function calcYears(state: AppState): number {
  return clampYears(state.project.calculationYears);
}

export function years(startYear: number, n: number = DEFAULT_CALCULATION_YEARS): number[] {
  return Array.from({ length: clampYears(n) }, (_, i) => startYear + i);
}

/** Antal kostnadsposter vars startår ligger efter kalkylperiodens sista år. */
export function itemsOutsidePeriod(
  sheet: CostSheet<StaffToday | StaffChange>,
  startYear: number,
  n: number,
): number {
  const last = startYear + clampYears(n) - 1;
  return sheet.items.filter((it) => it.startYear !== null && it.startYear > last).length;
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

export function discountRate(state: AppState): number {
  const rate = state.project.discountRate;
  return typeof rate === "number" && Number.isFinite(rate) && rate >= 0 ? rate / 100 : DISCOUNT_RATE;
}

/** Prisnivå/basår. Gamla sparade kalkyler utan fält använder startåret, så deras resultat inte ändras. */
export function baseYearOf(state: AppState): number {
  const b = state.project.baseYear;
  return typeof b === "number" && Number.isFinite(b) && b > 0 ? b : state.project.startYear;
}

const normalizeRole = (role: string) => (role || "").trim().toLowerCase();

/** Match every change row once: stable todayId first, then department/role, then row position. */
export function matchStaffRows(today: StaffToday[], change: (StaffToday | StaffChange)[]): (number | null)[] {
  const byId = new Map(today.map((t, i) => [t.id, i] as const));
  const used = new Set<number>();
  const matches: (number | null)[] = change.map((c) => {
    const todayId = "todayId" in c ? c.todayId : null;
    if (todayId != null) {
      const idx = byId.get(todayId);
      if (idx !== undefined && !used.has(idx)) { used.add(idx); return idx; }
    }
    return null;
  });
  change.forEach((c, i) => {
    if (matches[i] !== null) return;
    const idx = today.findIndex((t, j) => !used.has(j) && normalizeRole(t.role) !== "" &&
      normalizeRole(t.role) === normalizeRole(c.role) &&
      (!t.forvaltning || !c.forvaltning || t.forvaltning === c.forvaltning));
    if (idx >= 0) { matches[i] = idx; used.add(idx); }
  });
  change.forEach((_, i) => {
    if (matches[i] === null && today[i] && !used.has(i)) { matches[i] = i; used.add(i); }
  });
  return matches;
}

export function computeCostSheet(
  sheet: CostSheet<StaffToday | StaffChange>,
  startYear: number,
  calculationYears: number = DEFAULT_CALCULATION_YEARS,
  rate: number = DISCOUNT_RATE,
  baseline?: CostSheet<StaffToday>,
  baseYear: number = startYear,
): SheetCalc {
  const matches = matchStaffRows(baseline?.staff ?? [], sheet.staff);
  let marginSum = 0;
  const perYear: YearRow[] = years(startYear, calculationYears).map((year) => {
    let oneTime = 0;
    let recurring = 0;
    let annualMargin = 0;
    sheet.items.forEach((it) => {
      if (it.startYear === null || it.startYear > year) return;
      // Engångskostnader räknas inte upp; löpande kostnader räknas upp från basåret.
      const value = it.type === "Engångskostnad"
        ? (it.startYear === year ? it.costPerYear || 0 : 0)
        : (it.costPerYear || 0) * Math.pow(1 + (sheet.growth || 0) / 100, year - baseYear);
      if (it.type === "Engångskostnad") oneTime += value;
      else recurring += value;
      annualMargin += Math.abs(value) * (it.margin || 0) / 100;
    });
    const staffCost = sheet.staff.reduce((sum, c, j) => {
      const match = matches[j];
      const t = match == null ? undefined : baseline?.staff[match];
      const retained = "benefitType" in c && c.benefitType === "Omfördelningsnytta ↺" && t;
      const person = retained ? t : c;
      const growth = retained ? baseline?.growth ?? 0 : sheet.growth;
      return sum + staffAnnualCost(person.salary, person.hours, person.count ?? 1) * Math.pow(1 + (growth || 0) / 100, year - baseYear);
    }, 0);
    const total = oneTime + recurring + staffCost;
    const discount = Math.pow(1 + rate, -(year - baseYear));
    marginSum += annualMargin * discount;
    return { year, oneTime, recurring, staffCost, total, npv: total * discount };
  });
  const npvSum = perYear.reduce((sum, r) => sum + r.npv, 0);
  return { perYear, npvSum, marginSum, best: npvSum - marginSum, worst: npvSum + marginSum };
}

/**
 * Personalmarginalen slår bara på det som skiljer alternativen åt:
 * |kostnad förändring − kostnad nuläge| per kopplad rad. Omfördelningsrader
 * (lönen behålls) och oförändrade rader bidrar med 0, nya rader med hela sin
 * kostnad och avvecklade rader med hela nulägeskostnaden.
 */
function staffDifferenceMargin(state: AppState, baseYear: number, rate: number): number {
  const margin = staffMarginOf(state.costChange);
  if (margin <= 0) return 0;
  const today = state.costToday.staff;
  const change = state.costChange.staff;
  if (today.length === 0 && change.length === 0) return 0;
  const matches = matchStaffRows(today, change);
  const matchedToday = new Set(matches.filter((m): m is number => m !== null));
  let sum = 0;
  years(state.project.startYear, calcYears(state)).forEach((year) => {
    let diff = 0;
    change.forEach((c, j) => {
      const match = matches[j];
      const t = match == null ? undefined : today[match];
      if (c.benefitType === "Omfördelningsnytta ↺" && t) return; // lönen behålls: ingen skillnad
      const changeCost = staffAnnualCost(c.salary, c.hours, c.count ?? 1) * Math.pow(1 + (state.costChange.growth || 0) / 100, year - baseYear);
      const todayCost = t ? staffAnnualCost(t.salary, t.hours, t.count ?? 1) * Math.pow(1 + (state.costToday.growth || 0) / 100, year - baseYear) : 0;
      diff += Math.abs(changeCost - todayCost);
    });
    today.forEach((t, j) => {
      if (matchedToday.has(j)) return; // avvecklade rader utan motpart
      diff += Math.abs(staffAnnualCost(t.salary, t.hours, t.count ?? 1) * Math.pow(1 + (state.costToday.growth || 0) / 100, year - baseYear));
    });
    sum += diff * margin / 100 * Math.pow(1 + rate, -(year - baseYear));
  });
  return sum;
}

/** The single scenario calculation entry point, including retained salaries. */
export function computeProjectCosts(state: AppState) {
  const rate = discountRate(state);
  const n = calcYears(state);
  const baseYear = baseYearOf(state);
  const todayCalc = computeCostSheet(state.costToday, state.project.startYear, n, rate, undefined, baseYear);
  const changeCalc = computeCostSheet(state.costChange, state.project.startYear, n, rate, state.costToday, baseYear);
  const staffMargin = staffDifferenceMargin(state, baseYear, rate);
  if (staffMargin > 0) {
    changeCalc.marginSum += staffMargin;
    changeCalc.best -= staffMargin;
    changeCalc.worst += staffMargin;
  }
  return { todayCalc, changeCalc };
}

export interface Reallocation { hoursFreed: number; valueFreed: number; }

export function computeReallocation(today: StaffToday[], change: StaffChange[]): Reallocation {
  const matches = matchStaffRows(today, change);
  let hoursFreed = 0;
  let valueFreed = 0;
  change.forEach((c, i) => {
    if (c.benefitType !== "Omfördelningsnytta ↺") return;
    const match = matches[i];
    const t = match == null ? undefined : today[match];
    if (!t) return;
    const freed = (t.hours || 0) * (t.count ?? 1) - (c.hours || 0) * (c.count ?? 1);
    hoursFreed += freed;
    valueFreed += staffAnnualCost(t.salary, freed, 1);
  });
  return { hoursFreed, valueFreed };
}

export function computeReallocationOverPeriod(
  hoursFreed: number, valueFreed: number, growth: number, startYear: number,
  calculationYears: number, rate: number = DISCOUNT_RATE, baseYear: number = startYear,
): { totalHoursFreed: number; totalValueFreedNPV: number } {
  const n = clampYears(calculationYears);
  const totalValueFreedNPV = years(startYear, n).reduce((sum, year) =>
    sum + valueFreed * Math.pow(1 + (growth || 0) / 100, year - baseYear) / Math.pow(1 + rate, year - baseYear), 0);
  return { totalHoursFreed: hoursFreed * n, totalValueFreedNPV };
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
  if (movement === 0) return grades[0] ?? "Ingen förflyttning";
  if (movement > 0) return grades[abs] ?? "";
  const negatives = [
    "Ingen försämring",
    "Liten försämring",
    "Medium försämring",
    "Stor försämring",
    "Mycket stor försämring",
  ];
  return negatives[abs] ?? "";
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
  reallocation: number;
  cumulative: number;
  cumulativeIncl: number;
}

export const NO_BREAK_EVEN = "Uppnås ej inom kalkylperioden";
export interface NetBenefit {
  perYear: NetRow[];
  totalNet: number;
  /** Finansiell nettonytta + omfördelningsnytta (nuvärde). Motsvarar mallens "Ja"-läge. */
  totalNetIncl: number;
  low: number;
  high: number;
  breakEvenYear: number | typeof NO_BREAK_EVEN;
  breakEvenYearIncl: number | typeof NO_BREAK_EVEN;
}

export function computeNetBenefit(state: AppState, todayCalc: SheetCalc, changeCalc: SheetCalc): NetBenefit {
  const { valueFreed } = computeReallocation(state.costToday.staff, state.costChange.staff);
  const baseYear = baseYearOf(state);
  const rate = discountRate(state);
  let cumulative = 0;
  let cumulativeIncl = 0;
  let breakEvenYear: number | null = null;
  let breakEvenYearIncl: number | null = null;
  const perYear = years(state.project.startYear, calcYears(state)).map((year, i) => {
    const reallocation = valueFreed * Math.pow(1 + (state.costToday.growth || 0) / 100, year - baseYear) / Math.pow(1 + rate, year - baseYear);
    const net = (todayCalc.perYear[i]?.npv ?? 0) - (changeCalc.perYear[i]?.npv ?? 0);
    cumulative += net;
    cumulativeIncl += net + reallocation;
    if (breakEvenYear === null && cumulative >= 0) breakEvenYear = year;
    if (breakEvenYearIncl === null && cumulativeIncl >= 0) breakEvenYearIncl = year;
    return { year, net, reallocation, cumulative, cumulativeIncl };
  });
  return { perYear, totalNet: cumulative, totalNetIncl: cumulativeIncl,
    low: todayCalc.best - changeCalc.worst,
    high: todayCalc.worst - changeCalc.best,
    breakEvenYear: breakEvenYear ?? NO_BREAK_EVEN,
    breakEvenYearIncl: breakEvenYearIncl ?? NO_BREAK_EVEN };
}

/**
 * Migrerar gamla sparade kalkyler: basår = startår, stabila id:n på nulägesrader,
 * todayId-koppling via befattningsmatchning och speglade rader för nulägesrader
 * som saknar motpart — så att det finansiella resultatet inte påverkas.
 */
export function migrateState(state: AppState): AppState {
  const baseYear = state.project.baseYear ?? state.project.startYear;
  const todayStaff = state.costToday.staff.map((t) => (t.id ? t : { ...t, id: newStaffId() }));
  const matches = matchStaffRows(todayStaff, state.costChange.staff);
  const usedToday = new Set<number>();
  const changeStaff = state.costChange.staff.map((c, i) => {
    if (c.todayId != null) {
      const idx = todayStaff.findIndex((t) => t.id === c.todayId);
      if (idx >= 0) { usedToday.add(idx); return c; }
      return { ...c, todayId: null };
    }
    const match = matches[i];
    if (match != null && !usedToday.has(match)) {
      usedToday.add(match);
      return { ...c, todayId: todayStaff[match]?.id ?? null };
    }
    return { ...c, todayId: null };
  });
  const mirrors: StaffChange[] = todayStaff.flatMap((t, j) =>
    usedToday.has(j)
      ? []
      : [{
          ...emptyStaffChange(t.id),
          forvaltning: t.forvaltning,
          positionIndex: t.positionIndex,
          role: t.role,
          salary: t.salary,
          hours: t.hours,
          count: t.count,
          benefitType: "Omfördelningsnytta ↺" as const,
          desc: t.desc,
        }],
  );
  return {
    ...state,
    project: { ...state.project, baseYear },
    costToday: { ...state.costToday, staff: todayStaff },
    costChange: { ...state.costChange, staff: [...changeStaff, ...mirrors] },
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
