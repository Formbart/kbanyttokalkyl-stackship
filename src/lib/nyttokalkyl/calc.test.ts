import { describe, expect, it } from "vitest";
import { HyperFormula } from "hyperformula";
import { buildNyttokalkylWorkbook } from "./exportExcel";
import { computeCostSheet, computeNetBenefit, computeProjectCosts, computeReallocation, staffAnnualCost, NO_BREAK_EVEN } from "./calc";
import { emptyCostItem, emptyStaffChange, emptyStaffToday, initialState } from "./types";

export function klaraFixture() {
  const state = initialState();
  state.project = { ...state.project, name: "Klara", startYear: 2026, calculationYears: 4, discountRate: 3 };
  const teacher = { ...emptyStaffToday(), role: "Lärare senare år", count: 1000, salary: 46825.62 };
  state.costToday.staff = [teacher];
  state.costChange.staff = [{ ...emptyStaffChange(), ...teacher, hours: 1584 }];
  state.costChange.items = [
    { ...emptyCostItem(2026), name: "Programutveckling", type: "Engångskostnad", costPerYear: 1000000 },
    { ...emptyCostItem(2027), name: "Programutveckling", type: "Engångskostnad", costPerYear: 1000000 },
    { ...emptyCostItem(2027), name: "AI-modeller", costPerYear: 200000 },
    { ...emptyCostItem(2027), name: "DC", costPerYear: 20000 },
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
  it("retains teacher salary and yields approximately -2.6 Mkr financial NPV", () => {
    const state = klaraFixture();
    const { todayCalc, changeCalc } = computeProjectCosts(state);
    expect(changeCalc.perYear.map((r) => r.staffCost)).toEqual(todayCalc.perYear.map((r) => r.staffCost));
    const net = computeNetBenefit(state, todayCalc, changeCalc);
    const investmentNPV = 1000000 + 1000000 / 1.03;
    const operatingNPV = 220000 / 1.03 + 224400 / 1.03 ** 2 + 228888 / 1.03 ** 3;
    expect(net.totalNet).toBeCloseTo(-investmentNPV - operatingNPV, 2);
    expect(net.totalNet / 1e6).toBeCloseTo(-2.6, 1);
  });
  it("reports 176000 freed hours and approximately 310.6 Mkr separately", () => {
    const state = klaraFixture();
    expect(computeReallocation(state.costToday.staff, state.costChange.staff).hoursFreed).toBe(176000);
    const costs = computeProjectCosts(state);
    const net = computeNetBenefit(state, costs.todayCalc, costs.changeCalc);
    expect(net.perYear.reduce((sum, r) => sum + r.reallocation, 0) / 1e6).toBeCloseTo(310.6, 1);
  });
  it("does not achieve financial break-even within the four-year period", () => {
    const state = klaraFixture();
    const costs = computeProjectCosts(state);
    expect(computeNetBenefit(state, costs.todayCalc, costs.changeCalc).breakEvenYear).toBe(NO_BREAK_EVEN);
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
    state.project.calculationYears = 4;
    state.costToday.staff = [{ ...emptyStaffToday(), salary: 32000 }];
    state.costChange.staff = [{ ...emptyStaffChange(), salary: 40000, hours: 880 }];
    const work = computeCostSheet(state.costChange, 2026, 4);
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
  it("indexes 220000 from its own 2027 start to 224400 in 2028", () => {
    const sheet = { growth: 2, staff: [], items: [{ ...emptyCostItem(2027), costPerYear: 220000 }] };
    expect(computeCostSheet(sheet, 2026, 4).perYear.map((r) => r.recurring)).toEqual([0, 220000, 224400, 228888]);
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
      "Frigjorda timmar/år": 176000,
      "Break-even år": net.breakEvenYear,
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