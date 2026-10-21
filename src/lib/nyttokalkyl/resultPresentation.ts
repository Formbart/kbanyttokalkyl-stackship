import { baseYearOf, calcYears, computeCostSheet, discountRate, matchStaffRows } from "./calc";
import type { AppState, CostItem } from "./types";

/** Presentation only: remove equal contributions without changing scenario totals. */
export function differingCosts(state: AppState) {
  const n = calcYears(state);
  const base = baseYearOf(state);
  const rate = discountRate(state);
  const itemValue = (item: CostItem, growth: number) => computeCostSheet(
    { items: [item], staff: [], growth }, state.project.startYear, n, rate, undefined, base,
  ).npvSum;
  const rows = [
    { category: "Engångskostnader", idag: 0, forandring: 0 },
    { category: "Löpande kostnader", idag: 0, forandring: 0 },
    { category: "Personal (finansiellt påverkad)", idag: 0, forandring: 0 },
  ];
  let identical = 0;
  const usedItems = new Set<number>();
  state.costToday.items.forEach((item) => {
    const value = itemValue(item, state.costToday.growth);
    const match = state.costChange.items.findIndex((other, i) => !usedItems.has(i)
      && item.type === other.type && item.costPerYear === other.costPerYear && item.startYear === other.startYear
      && Math.abs(value - itemValue(other, state.costChange.growth)) < 0.000001);
    if (match >= 0) { usedItems.add(match); identical += value; }
    else { const row = rows[item.type === "Engångskostnad" ? 0 : 1]; if (row) row.idag += value; }
  });
  state.costChange.items.forEach((item, i) => {
    if (usedItems.has(i)) return;
    const row = rows[item.type === "Engångskostnad" ? 0 : 1];
    if (row) row.forandring += itemValue(item, state.costChange.growth);
  });
  const matches = matchStaffRows(state.costToday.staff, state.costChange.staff);
  const usedStaff = new Set<number>();
  const staffValue = (staff: AppState["costToday"]["staff"], growth: number) => computeCostSheet(
    { items: [], staff, growth }, state.project.startYear, n, rate, undefined, base,
  ).npvSum;
  const staffRow = rows[2];
  state.costChange.staff.forEach((c, i) => {
    const match = matches[i];
    const t = match == null ? undefined : state.costToday.staff[match];
    if (match != null) usedStaff.add(match);
    const todayValue = t ? staffValue([t], state.costToday.growth) : 0;
    const retained = t && c.benefitType === "Omfördelningsnytta ↺";
    const changeValue = retained ? todayValue : computeCostSheet(
      { items: [], staff: [c], growth: state.costChange.growth }, state.project.startYear, n, rate, undefined, base,
    ).npvSum;
    if (t && Math.abs(todayValue - changeValue) < 0.000001) identical += todayValue;
    else if (staffRow) { staffRow.idag += todayValue; staffRow.forandring += changeValue; }
  });
  state.costToday.staff.forEach((t, i) => {
    if (!usedStaff.has(i) && staffRow) staffRow.idag += staffValue([t], state.costToday.growth);
  });
  return { rows, identical, hasDifference: rows.some((r) => r.idag !== 0 || r.forandring !== 0) };
}

export function misplacedInvestments(state: AppState) {
  return state.costToday.items.flatMap((item, index) => item.type === "Engångskostnad"
    && item.startYear !== null && item.startYear >= state.project.startYear ? [{ item, index }] : []);
}

export function moveInvestment(state: AppState, index: number): AppState {
  const item = state.costToday.items[index];
  if (!item || !misplacedInvestments(state).some((entry) => entry.index === index)) return state;
  return { ...state, costToday: { ...state.costToday, items: state.costToday.items.filter((_, i) => i !== index) },
    costChange: { ...state.costChange, items: [...state.costChange.items, item] } };
}

export function firstYearBreakEvenWarning(state: AppState, breakEven: number | string) {
  return breakEven === state.project.startYear && [...state.costToday.items, ...state.costChange.items]
    .some((item) => item.type === "Engångskostnad");
}

export function identicalCostWarning(identical: number, totalToday: number) {
  return totalToday > 0 && identical / totalToday > 0.95;
}