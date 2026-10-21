import { describe, expect, it } from "vitest";
import { computeNetBenefit, computeProjectCosts, createKrAxisFormatter, formatKrCompact, NO_BREAK_EVEN } from "./calc";
import { differingCosts, firstYearBreakEvenWarning, identicalCostWarning, misplacedInvestments, moveInvestment } from "./resultPresentation";
import { emptyCostItem, emptyStaffChange, emptyStaffToday, initialState } from "./types";

function klara() {
  const s = initialState();
  s.project = { ...s.project, name: "Klara", startYear: 2026, baseYear: 2026, calculationYears: 4 };
  const t = { ...emptyStaffToday(), salary: 46825.62, count: 1000 };
  s.costToday.staff = [t];
  s.costChange.staff = [{ ...emptyStaffChange(t.id), salary: t.salary, count: 1000, hours: 1584 }];
  s.costToday.items = [2026, 2027].map((year) => ({ ...emptyCostItem(year), name: "Programutveckling", type: "Engångskostnad" as const, costPerYear: 1000000 }));
  s.costChange.items = [{ ...emptyCostItem(2027), costPerYear: 220000 }];
  return s;
}

describe("result presentation", () => {
  it.each([[8450, "8\u00a0450 kr"], [245000, "245 tkr"], [1320000, "1,32 Mkr"], [12345678901, "12,35 mdkr"], [-987654321, "−987,7 Mkr"], [0, "0 kr"], [-2618141, "−2,62 Mkr"]])("formats %s compactly", (value, expected) => {
    expect(formatKrCompact(Number(value))).toBe(expected);
  });
  it("uses one Mkr unit for all axis ticks", () => {
    const tick = createKrAxisFormatter(1500000);
    expect([0, 500000, 1000000, 1500000].map(tick)).toEqual(["0 Mkr", "0,5 Mkr", "1 Mkr", "1,5 Mkr"]);
  });
  it("shows Klara investment and operating costs but excludes retained staff", () => {
    const c = differingCosts(klara());
    expect(c.rows[0]?.idag).toBeCloseTo(1970873.7864, 2);
    expect(c.rows[1]?.forandring).toBeCloseTo(224400 / 1.03 + 228888 / 1.03 ** 2 + 233465.76 / 1.03 ** 3, 2);
    expect(c.rows[2]).toEqual({ category: "Personal (financiellt påverkad)", idag: 0, forandring: 0 });
    expect(c.identical / 1e9).toBeCloseTo(3.10643, 3);
  });
  it("matches duplicate identical cost items once regardless of name", () => {
    const s = initialState();
    s.project.calculationYears = 1;
    const item = { ...emptyCostItem(s.project.startYear), costPerYear: 1000 };
    s.costToday.items = [item, item]; s.costChange.items = [{ ...item, name: "Annat namn" }];
    const c = differingCosts(s);
    expect(c.identical).toBe(1000);
    expect(c.rows[1]?.idag).toBe(1000);
    expect(c.rows[1]?.forandring).toBe(0);
  });
  it("shows no financial difference for equal alternatives", () => {
    const s = initialState();
    s.costToday.items = [{ ...emptyCostItem(s.project.startYear), costPerYear: 1000 }];
    s.costChange.items = [...s.costToday.items];
    expect(differingCosts(s).hasDifference).toBe(false);
  });
  it("warns only for current or future one-time items in today", () => {
    const s = klara();
    s.costToday.items.push({ ...emptyCostItem(2025), type: "Engångskostnad" });
    expect(misplacedInvestments(s).map((r) => r.index)).toEqual([0, 1]);
  });
  it("moves investments unchanged and updates Klara to negative financial net", () => {
    const before = klara();
    const after = moveInvestment(moveInvestment(before, 0), 0);
    expect(before.costToday.items).toHaveLength(2);
    expect(after.costToday.items).toHaveLength(0);
    expect(after.costChange.items.slice(1)).toEqual(before.costToday.items);
    const c = computeProjectCosts(after);
    const n = computeNetBenefit(after, c.todayCalc, c.changeCalc);
    expect(Math.abs(n.totalNet + 2618141)).toBeLessThanOrEqual(1);
    expect(n.breakEvenYear).toBe(NO_BREAK_EVEN);
    expect(n.low).toBeLessThan(0); expect(n.high).toBeLessThan(0);
  });
  it("warns about first-year break-even only when investments exist", () => {
    const s = klara();
    expect(firstYearBreakEvenWarning(s, 2026)).toBe(true);
    expect(firstYearBreakEvenWarning(s, 2027)).toBe(false);
    s.costToday.items = []; s.costChange.items = [];
    expect(firstYearBreakEvenWarning(s, 2026)).toBe(false);
  });
  it("shows identical-cost information only above 95 percent", () => {
    expect(identicalCostWarning(95, 100)).toBe(false);
    expect(identicalCostWarning(96, 100)).toBe(true);
    expect(identicalCostWarning(0, 0)).toBe(false);
  });
});