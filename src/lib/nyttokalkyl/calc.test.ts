import { describe, expect, it } from "vitest";
import { HyperFormula } from "hyperformula";
import { buildNyttokalkylWorkbook } from "./exportExcel";
import { baseYearOf, computeCostSheet, computeNetBenefit, computeProjectCosts, computeReallocation, migrateState, staffAnnualCost, NO_BREAK_EVEN } from "./calc";
import { emptyCostItem, emptyStaffChange, emptyStaffToday, initialState, type AppState } from "./types";

export function klaraFixture() {
  const state = initialState();
  state.project = { ...state.project, name: "Klara", startYear: 2026, baseYear: 2026, calculationYears: 4, discountRate: 3 };
  const teacher = { ...emptyStaffToday(), role: "Lärare senare år", count: 1000, salary: 46825.62 };
  state.costToday.staff = [teacher];
  state.costChange.staff = [{
    ...emptyStaffChange(teacher.id),
    forvaltning: teacher.forvaltning,
    positionIndex: teacher.positionIndex,
    role: teacher.role,
    salary: teacher.salary,
    count: teacher.count,
    hours: 1584,
  }];
  state.costChange.items = [
    { ...emptyCostItem(2026), name: "Programutveckling", type: "Engångskostnad", costPerYear: 1000000, margin: 10 },
    { ...emptyCostItem(2027), name: "Programutveckling", type: "Engångskostnad", costPerYear: 1000000, margin: 10 },
    { ...emptyCostItem(2027), name: "AI-drift", costPerYear: 220000, margin: 10 },
  ];
  return state;
}

describe("Klara and financial separation", () => {
  it("calculates the staff row from its own hours even when the budget retains the baseline", () => {
    const state = initialState();
    state.costToday.staff = [{ ...emptyStaffToday(), salary: 32000 }];
    const row = { ...emptyStaffChange(), salary: 32000, hours: 880 };
    state.costChange.staff = [row];
    expect(staffAnnualCost(row.salary, row.hours, row.count)).toBeCloseTo(269260.8, 2);
    expect(computeProjectCosts(state).changeCalc.perYear[0]?.staffCost).toBeCloseTo(538521.6, 2);
  });
  it("recalculates the staff row when its monthly salary changes", () => {
    expect(staffAnnualCost(40000, 880, 1)).toBeCloseTo(336576, 2);
    expect(staffAnnualCost(32000, 880, 1)).toBeCloseTo(269260.8, 2);
  });
  it("retains teacher salary and yields approximately -2.62 Mkr financial NPV", () => {
    const state = klaraFixture();
    const { todayCalc, changeCalc } = computeProjectCosts(state);
    expect(changeCalc.perYear.map((r) => r.staffCost)).toEqual(todayCalc.perYear.map((r) => r.staffCost));
    const net = computeNetBenefit(state, todayCalc, changeCalc);
    const investmentNPV = 1000000 + 1000000 / 1.03;
    const operatingNPV = 224400 / 1.03 + 228888 / 1.03 ** 2 + 233465.76 / 1.03 ** 3;
    expect(net.totalNet).toBeCloseTo(-investmentNPV - operatingNPV, 2);
    expect(Math.abs(net.totalNet - -2618141)).toBeLessThanOrEqual(1);
  });
  it("indexes AI-driften 220000 from the 2026 base year to 224400 in 2027", () => {
    const state = klaraFixture();
    const { changeCalc } = computeProjectCosts(state);
    changeCalc.perYear.forEach((r, i) => expect(r.recurring).toBeCloseTo([0, 224400, 228888, 233465.76][i] ?? 0, 8));
  });
  it("reports 176000 freed hours, 78801899 kr the first year and approximately 310.6 Mkr over the period", () => {
    const state = klaraFixture();
    expect(computeReallocation(state.costToday.staff, state.costChange.staff).hoursFreed).toBe(176000);
    const costs = computeProjectCosts(state);
    const net = computeNetBenefit(state, costs.todayCalc, costs.changeCalc);
    expect(Math.abs(net.perYear[0]!.reallocation - 78801899)).toBeLessThanOrEqual(1);
    expect(net.perYear.reduce((sum, r) => sum + r.reallocation, 0) / 1e6).toBeCloseTo(310.6, 1);
  });
  it("keeps the uncertainty interval narrow: margins only hit what differs", () => {
    const state = klaraFixture();
    const costs = computeProjectCosts(state);
    const net = computeNetBenefit(state, costs.todayCalc, costs.changeCalc);
    expect(Math.abs(net.low - -2879955)).toBeLessThanOrEqual(1);
    expect(Math.abs(net.high - -2356327)).toBeLessThanOrEqual(1);
  });
  it("does not achieve financial break-even within the four-year period", () => {
    const state = klaraFixture();
    const costs = computeProjectCosts(state);
    const net = computeNetBenefit(state, costs.todayCalc, costs.changeCalc);
    expect(net.breakEvenYear).toBe(NO_BREAK_EVEN);
    expect(net.breakEvenYearIncl).toBe(2026); // omfördelningsnyttan ger break-even direkt
    state.reallocationInGraph = true; // legacy saved switch must no longer affect money
    expect(computeNetBenefit(state, costs.todayCalc, costs.changeCalc).totalNet).toBeLessThan(0);
  });
  it("allows real reduced staffing only for financial benefit rows", () => {
    const state = klaraFixture();
    const row = state.costChange.staff[0];
    if (!row) throw new Error("Missing fixture");
    row.benefitType = "Finansiell nytta 💰";
    const costs = computeProjectCosts(state);
    expect(costs.changeCalc.perYear[0]?.staffCost).toBeCloseTo((costs.todayCalc.perYear[0]?.staffCost ?? 0) * 0.9, 5);
    expect(computeReallocation(state.costToday.staff, state.costChange.staff).hoursFreed).toBe(0);
  });
  it("keeps retained salaries identical even when change growth differs", () => {
    const state = klaraFixture();
    state.costChange.growth = 8;
    const costs = computeProjectCosts(state);
    expect(costs.changeCalc.perYear[3]?.staffCost).toBe(costs.todayCalc.perYear[3]?.staffCost);
  });
});

describe("assumptions and uncertainty", () => {
  it("updates work costs for all four years while preserving reallocation budget costs", () => {
    const state = initialState();
    state.project.startYear = 2026;
    state.project.baseYear = 2026;
    state.project.calculationYears = 4;
    state.costToday.staff = [{ ...emptyStaffToday(), salary: 32000 }];
    state.costChange.staff = [{ ...emptyStaffChange(), salary: 40000, hours: 880 }];
    const work = computeCostSheet(state.costChange, 2026, 4, 0.03, undefined, 2026);
    expect(work.perYear.map((r) => r.year)).toEqual([2026, 2027, 2028, 2029]);
    work.perYear.forEach((r, i) => expect(r.staffCost).toBeCloseTo(336576 * 1.02 ** i, 5));
    computeProjectCosts(state).changeCalc.perYear.forEach((r, i) => expect(r.staffCost).toBeCloseTo(538521.6 * 1.02 ** i, 5));
  });
  it("updates budget costs for financial rows for all four years", () => {
    const state = initialState();
    state.project.calculationYears = 4;
    state.costToday.staff = [{ ...emptyStaffToday(), salary: 32000 }];
    state.costChange.staff = [{ ...emptyStaffChange(), salary: 40000, hours: 880, benefitType: "Finansiell nytta 💰" }];
    computeProjectCosts(state).changeCalc.perYear.forEach((r, i) => expect(r.staffCost).toBeCloseTo(336576 * 1.02 ** i, 5));
  });
  it("indexes 220000 from the 2026 base year, not from the item's own start year", () => {
    const sheet = { growth: 2, staff: [], items: [{ ...emptyCostItem(2027), costPerYear: 220000 }] };
    computeCostSheet(sheet, 2026, 4, 0.03, undefined, 2026).perYear.forEach((r, i) => expect(r.recurring).toBeCloseTo([0, 224400, 228888, 233465.76][i] ?? 0, 8));
  });
  it("applies editable 5 percent discounting", () => {
    const state = initialState();
    state.project.discountRate = 5;
    state.project.calculationYears = 2;
    state.costChange.items = [{ ...emptyCostItem(state.project.startYear + 1), type: "Engångskostnad", costPerYear: 1000 }];
    expect(computeProjectCosts(state).changeCalc.npvSum).toBeCloseTo(1000 / 1.05, 8);
  });
  it("uses only in-period discounted margins for the financial interval", () => {
    const state = initialState();
    state.project.calculationYears = 1;
    state.costToday.items = [{ ...emptyCostItem(state.project.startYear), costPerYear: 1000, margin: 10 }];
    state.costChange.items = [{ ...emptyCostItem(state.project.startYear), costPerYear: 400, margin: 20 }, { ...emptyCostItem(state.project.startYear + 5), costPerYear: 999999, margin: 100 }];
    const costs = computeProjectCosts(state);
    const net = computeNetBenefit(state, costs.todayCalc, costs.changeCalc);
    expect(net.low).toBe(420);
    expect(net.high).toBe(780);
  });
});

describe("basår (prisnivå)", () => {
  it("counts up and discounts from the base year when the start year is later", () => {
    const state = initialState();
    state.project.startYear = 2028;
    state.project.baseYear = 2026;
    state.project.calculationYears = 1;
    state.costChange.items = [{ ...emptyCostItem(2028), costPerYear: 100000, margin: 0 }];
    const { changeCalc } = computeProjectCosts(state);
    expect(changeCalc.perYear[0]?.recurring).toBeCloseTo(100000 * 1.02 ** 2, 5);
    expect(changeCalc.perYear[0]?.npv).toBeCloseTo((100000 * 1.02 ** 2) / 1.03 ** 2, 5);
  });
  it("falls back to the start year for old calculations without a base year", () => {
    const state = initialState();
    delete state.project.baseYear;
    expect(baseYearOf(state)).toBe(state.project.startYear);
  });
});

describe("migration of old saved calculations", () => {
  it("keeps the financial net benefit unchanged when baseYear and todayId are missing", () => {
    const state = initialState();
    state.project.startYear = 2026;
    state.project.calculationYears = 2;
    state.costToday.staff = [{ ...emptyStaffToday(), salary: 32000 }];
    state.costChange.staff = [{ ...emptyStaffChange(), salary: 40000, hours: 880, benefitType: "Finansiell nytta 💰" }];
    state.costChange.items = [{ ...emptyCostItem(2026), costPerYear: 100000, margin: 0 }];
    const legacy = JSON.parse(JSON.stringify(state)) as AppState;
    delete legacy.project.baseYear;
    legacy.costToday.staff.forEach((r) => delete (r as Partial<typeof r>).id);
    legacy.costChange.staff.forEach((r) => delete (r as Partial<typeof r>).todayId);
    const legacyCosts = computeProjectCosts(legacy);
    const before = computeNetBenefit(legacy, legacyCosts.todayCalc, legacyCosts.changeCalc);
    const migrated = migrateState(legacy);
    const costs = computeProjectCosts(migrated);
    const after = computeNetBenefit(migrated, costs.todayCalc, costs.changeCalc);
    expect(after.totalNet).toBeCloseTo(before.totalNet, 8);
    expect(migrated.project.baseYear).toBe(2026);
    expect(migrated.costChange.staff[0]?.todayId).toBe(migrated.costToday.staff[0]?.id);
  });
  it("mirrors an unmatched today row so it does not look like a saving", () => {
    const state = initialState();
    state.project.calculationYears = 2;
    state.costToday.staff = [{ ...emptyStaffToday(), salary: 32000 }];
    state.costChange.staff = [];
    const legacy = JSON.parse(JSON.stringify(state)) as AppState;
    legacy.costToday.staff.forEach((r) => delete (r as Partial<typeof r>).id);
    const migrated = migrateState(legacy);
    expect(migrated.costChange.staff).toHaveLength(1);
    expect(migrated.costChange.staff[0]?.todayId).toBe(migrated.costToday.staff[0]?.id);
    const costs = computeProjectCosts(migrated);
    const net = computeNetBenefit(migrated, costs.todayCalc, costs.changeCalc);
    expect(net.totalNet).toBe(0);
  });
});

describe("staff margin", () => {
  it("defaults to 0 percent so identical alternatives get no spread", () => {
    const state = initialState();
    state.project.calculationYears = 1;
    state.costToday.staff = [{ ...emptyStaffToday(), salary: 32000 }];
    const { todayCalc, changeCalc } = computeProjectCosts(state);
    expect(todayCalc.marginSum).toBe(0);
    expect(changeCalc.marginSum).toBe(0);
  });
  it("applies the margin only to the difference between the alternatives", () => {
    const state = initialState();
    state.project.startYear = 2026;
    state.project.baseYear = 2026;
    state.project.calculationYears = 1;
    const teacher = { ...emptyStaffToday(), salary: 32000 };
    state.costToday.staff = [teacher];
    state.costChange.staffMargin = 10;
    // Oförändrad speglad rad: ingen skillnad, ingen marginal.
    state.costChange.staff = [{ ...emptyStaffChange(teacher.id), role: teacher.role, salary: 32000, benefitType: "Finansiell nytta 💰" }];
    let costs = computeProjectCosts(state);
    expect(costs.changeCalc.marginSum).toBe(0);
    // Halverad arbetstid: marginal på halva kostnaden.
    state.costChange.staff = [{ ...emptyStaffChange(teacher.id), role: teacher.role, salary: 32000, hours: 880, benefitType: "Finansiell nytta 💰" }];
    costs = computeProjectCosts(state);
    expect(costs.changeCalc.marginSum).toBeCloseTo(538521.6 * 0.5 * 0.1, 2);
    // Ny resurs utan motpart: marginal på hela kostnaden.
    state.costChange.staff = [{ ...emptyStaffChange(null), salary: 32000, benefitType: "Finansiell nytta 💰" }];
    state.costToday.staff = [];
    costs = computeProjectCosts(state);
    expect(costs.changeCalc.marginSum).toBeCloseTo(538521.6 * 0.1, 2);
  });
});

describe("Excel formula recalculation", () => {
  it.each([1, 4, 6, 15])("recalculates matching financial, time and interval values for %i years", async (n) => {
    const state = klaraFixture();
    state.project.calculationYears = n;
    const workbook = buildNyttokalkylWorkbook(state);
    const sheets: Record<string, (string | number | boolean | null)[][]> = {};
    for (const ws of workbook.worksheets) {
      const rows: (string | number | boolean | null)[][] = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        const values: (string | number | boolean | null)[] = [];
        for (let c = 1; c <= Math.max(10, ws.columnCount); c++) {
          const value = row.getCell(c).value;
          values.push(value && typeof value === "object" && "formula" in value ? `=${value.formula}` : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null);
        }
        rows.push(values);
      });
      sheets[ws.name] = rows;
    }
    const engine = HyperFormula.buildFromSheets(sheets, { licenseKey: "gpl-v3", precisionRounding: 15 });
    const result = workbook.getWorksheet("5 Resultat");
    const sheetId = engine.getSheetId("5 Resultat");
    if (!result || sheetId === undefined) throw new Error("Missing result sheet");
    const costs = computeProjectCosts(state);
    const net = computeNetBenefit(state, costs.todayCalc, costs.changeCalc);
    const expected: Record<string, number | string> = {
      "Finansiell nettonytta (nuvärde)": net.totalNet,
      "Omfördelningsnytta (nuvärde)": net.perYear.reduce((sum, r) => sum + r.reallocation, 0),
      "Nettonytta inklusive omfördelning": net.totalNetIncl,
      "Frigjorda timmar/år": 176000,
      "Break-even år": net.breakEvenYear,
      "Break-even inkl. omfördelning": net.breakEvenYearIncl,
      "Finansiell nettonytta – lågt": net.low,
      "Finansiell nettonytta – högt": net.high,
    };
    result.eachRow((row) => {
      const expectedValue = expected[String(row.getCell(1).value)];
      if (expectedValue === undefined) return;
      const actual = engine.getCellValue({ sheet: sheetId, row: row.number - 1, col: 1 });
      if (typeof expectedValue === "number") expect(actual).toBeCloseTo(expectedValue, 4);
      else expect(actual).toBe(expectedValue);
    });
    for (const ws of workbook.worksheets) {
      const id = engine.getSheetId(ws.name);
      if (id === undefined) throw new Error("Missing sheet");
      ws.eachRow((row) => row.eachCell((cell) => {
        if (cell.type === 6) expect(engine.getCellValue({ sheet: id, row: row.number - 1, col: Number(cell.col) - 1 })).not.toBeInstanceOf(Object);
      }));
    }
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);
    engine.destroy();
  });
});
