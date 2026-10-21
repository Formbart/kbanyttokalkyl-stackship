import ExcelJS, {
  type Cell,
  type Row,
  type Worksheet,
} from "exceljs";
import {
  computeCostSheet,
  computeNetBenefit,
  computeQualitative,
  computeReallocation,
  computeProjectCosts,
  discountRate,
  matchStaffRows,
  NO_BREAK_EVEN,
  staffAnnualCost,
  years,
  calcYears,
} from "./calc";
import {
  DISCOUNT_RATE,
  FULL_TIME_HOURS,
  PO_FACTOR,
  benefitSentence,
  emptyFollowUp,
  type AppState,
  type CostSheet,
  type StaffChange,
  type StaffToday,
} from "./types";

const COLORS = {
  brand: "FF255E57",
  brandDark: "FF173F3B",
  brandSoft: "FFE5F0EE",
  border: "FFD4DFDD",
  input: "FF0000FF",
  formula: "FF000000",
  link: "FF008000",
  white: "FFFFFFFF",
  muted: "FFF3F6F5",
};

const currencyFormat = '#,##0;[Red](#,##0);-';
const numberFormat = '#,##0;[Red](#,##0);-';
const percentFormat = '0.0%;[Red](0.0%);-';

function title(ws: Worksheet, value: string, subtitle: string, lastColumn = 8) {
  ws.mergeCells(1, 1, 1, lastColumn);
  ws.getCell("A1").value = value;
  ws.getCell("A1").font = {
    name: "Arial",
    size: 18,
    bold: true,
    color: { argb: COLORS.white },
  };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandDark } };
  ws.getCell("A1").alignment = { vertical: "middle" };
  ws.getRow(1).height = 30;
  ws.mergeCells(2, 1, 2, lastColumn);
  ws.getCell("A2").value = subtitle;
  ws.getCell("A2").font = { name: "Arial", size: 10, italic: true, color: { argb: COLORS.brandDark } };
  ws.getRow(2).height = 24;
  ws.views = [{ state: "frozen", ySplit: 4 }];
  ws.properties.defaultRowHeight = 18;
}

function section(ws: Worksheet, row: number, value: string, lastColumn: number) {
  ws.mergeCells(row, 1, row, lastColumn);
  const cell = ws.getCell(row, 1);
  cell.value = value;
  cell.font = { name: "Arial", bold: true, color: { argb: COLORS.brandDark } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandSoft } };
  cell.alignment = { vertical: "middle" };
  ws.getRow(row).height = 22;
}

function header(row: Row) {
  row.eachCell((cell) => {
    cell.font = { name: "Arial", bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.brandDark } } };
  });
  row.height = 28;
}

function input(cell: Cell, format?: string) {
  cell.font = { name: "Arial", color: { argb: COLORS.input } };
  if (format) cell.numFmt = format;
}

function formula(cell: Cell, format?: string, linked = false) {
  cell.font = { name: "Arial", color: { argb: linked ? COLORS.link : COLORS.formula } };
  if (format) cell.numFmt = format;
}

function finish(ws: Worksheet, widths: number[]) {
  widths.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = { name: "Arial", ...(cell.font ?? {}) };
      cell.alignment = { vertical: "top", wrapText: true, ...(cell.alignment ?? {}) };
    });
  });
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  ws.headerFooter.oddFooter = "Kungsbacka kommun · Nyttokalkyl     Sida &P av &N";
}

function addCostSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  subtitle: string,
  sheet: CostSheet<StaffToday | StaffChange>,
  startYear: number,
  nYears: number,
  rate: number,
  baseline?: { sheet: CostSheet<StaffToday>; exported: ReturnType<typeof addCostSheet> },
): { worksheet: Worksheet; totalCell: string; yearRows: number[]; staffRows: number[]; marginCell: string } {
  const ws = workbook.addWorksheet(name);
  title(ws, name, subtitle, 10);
  section(ws, 4, "Antaganden", 10);
  ws.addRow(["Årlig kostnadsökning", sheet.growth / 100, "PO-påslag", PO_FACTOR - 1, "Heltidsmått (h/år)", FULL_TIME_HOURS, "Diskonteringsränta", { formula: "'1 Grundinformation'!F5", result: rate }, "Felmarginal personal", staffMarginOf(sheet) / 100]);
  input(ws.getCell("J5"), percentFormat);
  formula(ws.getCell("H5"), percentFormat, true);
  [ws.getCell("B5"), ws.getCell("D5")].forEach((cell) => input(cell, percentFormat));
  input(ws.getCell("F5"), numberFormat);

  section(ws, 7, "Övriga kostnader", 10);
  const itemHeaderRow = ws.addRow(["Kostnadspost", "Typ", "Kostnad/år (kr)", "Startår", "Felmarginal", "Källa"]);
  header(itemHeaderRow);
  const itemStart = ws.rowCount + 1;
  sheet.items.forEach((item) => {
    const row = ws.addRow([item.name, item.type, item.costPerYear, item.startYear ?? "", item.margin / 100, item.source]);
    row.eachCell((cell) => input(cell));
    row.getCell(3).numFmt = currencyFormat;
    row.getCell(5).numFmt = percentFormat;
  });
  if (sheet.items.length === 0) ws.addRow(["Inga kostnadsposter"]);
  const itemEnd = Math.max(itemStart, ws.rowCount);

  const staffSectionRow = ws.rowCount + 2;
  section(ws, staffSectionRow, "Personalkostnader", 10);
  const staffHeaderRow = ws.addRow([
    "Befattning",
    "Antal personer",
    "Tjänstgöringsgrad",
    "Månadslön exkl. PO (kr/person)",
    "Arbetstimmar/år (person)",
    "Typ av nytta",
    "Beskrivning",
    "Beräknad kostnad/år (kr)",
  ]);
  header(staffHeaderRow);
  const staffStart = ws.rowCount + 1;
  const staffRows: number[] = [];
  const matches = matchStaffRows(baseline?.sheet.staff ?? [], sheet.staff);
  sheet.staff.forEach((person, index) => {
    const isChange = "benefitType" in person;
    const match = matches[index];
    const t = match == null ? undefined : baseline?.sheet.staff[match];
    const baselineRow = match == null ? undefined : baseline?.exported.staffRows[match];
    const retained = isChange && (person as StaffChange).benefitType === "Omfördelningsnytta ↺" && t && baselineRow;
    const costPerson = retained ? t : person;
    const annual = staffAnnualCost(costPerson.salary, costPerson.hours, costPerson.count ?? 1);
    const rowNumber = ws.rowCount + 1;
    const staffCostFormula = baseline && baselineRow
      ? `IF(F${rowNumber}="Omfördelningsnytta ↺",'${baseline.exported.worksheet.name}'!H${baselineRow},B${rowNumber}*D${rowNumber}*12*(1+$D$5)*E${rowNumber}/$F$5)`
      : `B${rowNumber}*D${rowNumber}*12*(1+$D$5)*E${rowNumber}/$F$5`;
    staffRows.push(rowNumber);
    const row = ws.addRow([
      person.role,
      person.count ?? 1,
      { formula: `E${rowNumber}/$F$5`, result: person.hours / FULL_TIME_HOURS },
      person.salary,
      person.hours,
      isChange ? (person as StaffChange).benefitType : "",
      person.desc,
      { formula: staffCostFormula, result: annual },
    ]);
    for (let column = 1; column <= 7; column += 1) input(row.getCell(column));
    formula(row.getCell(3), percentFormat);
    row.getCell(4).numFmt = currencyFormat;
    row.getCell(5).numFmt = numberFormat;
    formula(row.getCell(8), currencyFormat);
  });
  if (sheet.staff.length === 0) ws.addRow(["Ingen personal registrerad"]);
  const staffEnd = Math.max(staffStart, ws.rowCount);

  const summarySectionRow = ws.rowCount + 2;
  section(ws, summarySectionRow, "Kostnader per år", 10);
  const summaryHeader = ws.addRow(["År", "Engångskostnader (kr)", "Löpande kostnader (kr)", "Personalkostnader (kr)", "Total kostnad (kr)", "Nuvärde (kr)", "Felmarginal, nuvärde (kr)"]);
  header(summaryHeader);
  const calc = computeCostSheet(sheet, startYear, nYears, rate, baseline?.sheet);
  const yearRows: number[] = [];
  calc.perYear.forEach((calculated, index) => {
    const excelRow = ws.rowCount + 1;
    const year = startYear + index;
    yearRows.push(excelRow);
    const oneTimeTerms: string[] = [];
    const recurringTerms: string[] = [];
    const marginTerms: string[] = [];
    sheet.items.forEach((item, index) => {
      const r = itemStart + index;
      const once = `IF(AND($B$${r}="Engångskostnad",$D$${r}<>"",$D$${r}=A${excelRow}),$C$${r},0)`;
      const recurring = `IF(AND($B$${r}<>"Engångskostnad",$D$${r}<>"",$D$${r}<=A${excelRow}),$C$${r}*(1+$B$5)^(A${excelRow}-$D$${r}),0)`;
      oneTimeTerms.push(once); recurringTerms.push(recurring);
      marginTerms.push(`ABS(${once}+${recurring})*$E$${r}`);
    });
    const oneTimeFormula = oneTimeTerms.join("+") || "0";
    const recurringFormula = recurringTerms.join("+") || "0";
    const staffFormula = staffRows.map((r, j) => {
      const match = matches[j];
      const baselineRow = match == null ? undefined : baseline?.exported.staffRows[match];
      const growth = baseline && baselineRow ? `IF(F${r}="Omfördelningsnytta ↺",'${baseline.exported.worksheet.name}'!$B$5,$B$5)` : "$B$5";
      return `$H$${r}*(1+${growth})^(A${excelRow}-$A$${yearRows[0]})`;
    }).join("+") || "0";
    const row = ws.addRow([
      year,
      { formula: oneTimeFormula, result: calculated.oneTime },
      { formula: recurringFormula, result: calculated.recurring },
      { formula: staffFormula, result: calculated.staffCost },
      { formula: `SUM(B${excelRow}:D${excelRow})`, result: calculated.total },
      { formula: `E${excelRow}/(1+$H$5)^(A${excelRow}-$A$${yearRows[0]})`, result: calculated.npv },
      { formula: `(${[...marginTerms, `ABS(D${excelRow})*$J$5`].join("+")})/(1+$H$5)^(A${excelRow}-$A$${yearRows[0]})` },
    ]);
    input(row.getCell(1));
    for (let column = 2; column <= 7; column += 1) formula(row.getCell(column), currencyFormat);
  });
  const totalRowNumber = ws.rowCount + 1;
  const totalRow = ws.addRow(["Totalt nuvärde", "", "", "", "", { formula: `SUM(F${yearRows[0]}:F${yearRows[yearRows.length - 1]})`, result: calc.npvSum }]);
  totalRow.getCell(7).value = { formula: `SUM(G${yearRows[0]}:G${yearRows[yearRows.length - 1]})`, result: calc.marginSum };
  formula(totalRow.getCell(7), currencyFormat);
  totalRow.font = { name: "Arial", bold: true };
  formula(totalRow.getCell(6), currencyFormat);
  finish(ws, [26, 18, 19, 18, 17, 22, 35, 22, 14, 14]);
  return { worksheet: ws, totalCell: `F${totalRowNumber}`, yearRows, staffRows, marginCell: `G${totalRowNumber}` };
}

function safeFilename(name: string) {
  const cleaned = name.trim().replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "-");
  return `nyttokalkyl-${cleaned || "utkast"}.xlsx`;
}

export function buildNyttokalkylWorkbook(state: AppState) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kungsbacka kommun – Nyttokalkyl";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const basic = workbook.addWorksheet("1 Grundinformation");
  title(basic, "1 Grundinformation", "Projektuppgifter, alternativ och planerade nyttor", 8);
  section(basic, 4, "Projekt", 8);
  basic.addRow(["Projektnamn", state.project.name, "Startår", state.project.startYear, "Diskonteringsränta", discountRate(state)]);
  basic.addRow(["Alternativ 1", state.project.alt1]);
  basic.addRow(["Alternativ 2", state.project.alt2]);
  basic.addRow(["Intressenter", state.project.stakeholders]);
  ["B5", "D5", "B6", "B7", "B8"].forEach((address) => input(basic.getCell(address)));
  input(basic.getCell("F5"), percentFormat);
  section(basic, 10, "Nyttor", 8);
  const benefitHeader = basic.addRow(["Förändring", "Effekt", "Nytta", "Intressent", "Typ", "Gynnas", "Mål", "Prioritering"]);
  header(benefitHeader);
  state.project.benefits.forEach((benefit) => {
    const row = basic.addRow([benefit.change, benefit.effect, benefit.benefit, benefit.stakeholder, benefit.type, benefit.gynnas, benefit.mal, benefit.rank]);
    row.eachCell((cell) => input(cell));
  });
  if (state.project.benefits.length === 0) basic.addRow(["Inga nyttor registrerade"]);
  const revisionRow = basic.rowCount + 2;
  section(basic, revisionRow, "Revisionshistorik", 8);
  header(basic.addRow(["Namn", "Beskrivning", "Version", "Datum"]));
  state.project.revisions.forEach((revision) => {
    const row = basic.addRow([revision.by, revision.desc, revision.version, revision.date]);
    row.eachCell((cell) => input(cell));
  });
  finish(basic, [24, 35, 35, 24, 26, 18, 28, 24]);

  const today = addCostSheet(workbook, "2 Kostnad idag", "Nulägets kostnader under kalkylperioden", state.costToday, state.project.startYear, calcYears(state), discountRate(state));
  const change = addCostSheet(workbook, "3 Kostnad förändring", "Kostnader för det förändrade arbetssättet", state.costChange, state.project.startYear, calcYears(state), discountRate(state), { sheet: state.costToday, exported: today });

  const qualitative = workbook.addWorksheet("4 Kvalitativa nyttor");
  title(qualitative, "4 Kvalitativa nyttor", "Bedömning av kvalitativa nyttor och miljönyttor", 8);
  section(qualitative, 4, "Bedömningar", 8);
  header(qualitative.addRow(["Nytta", "Typ", "Gynnas", "Nuläge (1–5)", "Förväntat läge (1–5)", "Förflyttning", "Bedömning"]));
  const qualRows = computeQualitative(state);
  qualRows.forEach((item) => {
    const rowNumber = qualitative.rowCount + 1;
    const row = qualitative.addRow([
      benefitSentence(item.benefit),
      item.benefit.type,
      item.benefit.gynnas,
      item.current,
      item.expected,
      { formula: `E${rowNumber}-D${rowNumber}`, result: item.movement },
      item.label,
    ]);
    for (let column = 1; column <= 5; column += 1) input(row.getCell(column));
    formula(row.getCell(6), numberFormat);
  });
  if (qualRows.length === 0) qualitative.addRow(["Inga kvalitativa nyttor eller miljönyttor registrerade"]);
  finish(qualitative, [48, 25, 18, 17, 21, 16, 24, 12]);

  const result = workbook.addWorksheet("5 Resultat");
  title(result, "5 Resultat", "Finansiell nettonytta och omfördelningsnytta – separat redovisning", 8);
  section(result, 4, "Nyckeltal", 8);
  const { todayCalc, changeCalc } = computeProjectCosts(state);
  const net = computeNetBenefit(state, todayCalc, changeCalc);
  const realloc = computeReallocation(state.costToday.staff, state.costChange.staff);
  const addMetric = (label: string, value: ExcelJS.CellValue, format = currencyFormat) => {
    const row = result.addRow([label, value]);
    formula(row.getCell(2), format, true);
    return `B${row.number}`;
  };
  addMetric("Kostnad idag, nuvärde (kr)", { formula: `'${today.worksheet.name}'!${today.totalCell}`, result: todayCalc.npvSum });
  addMetric("Kostnad förändring, nuvärde (kr)", { formula: `'${change.worksheet.name}'!${change.totalCell}`, result: changeCalc.npvSum });
  const freedTerms: string[] = [];
  const valueTerms: string[] = [];
  const matches = matchStaffRows(state.costToday.staff, state.costChange.staff);
  state.costChange.staff.forEach((_, i) => {
    const match = matches[i];
    const t = match == null ? undefined : today.staffRows[match];
    const c = change.staffRows[i];
    if (t == null || c == null) return;
    const hours = `('${today.worksheet.name}'!B${t}*'${today.worksheet.name}'!E${t}-'${change.worksheet.name}'!B${c}*'${change.worksheet.name}'!E${c})`;
    freedTerms.push(`IF('${change.worksheet.name}'!F${c}="Omfördelningsnytta ↺",${hours},0)`);
    valueTerms.push(`IF('${change.worksheet.name}'!F${c}="Omfördelningsnytta ↺",${hours}*'${today.worksheet.name}'!D${t}*12*(1+'${today.worksheet.name}'!$D$5)/'${today.worksheet.name}'!$F$5,0)`);
  });
  const hoursCell = addMetric("Frigjorda timmar/år", { formula: freedTerms.join("+") || "0", result: realloc.hoursFreed }, numberFormat);
  const valueCell = addMetric("Värde av frigjord tid/år (kr)", { formula: valueTerms.join("+") || "0", result: realloc.valueFreed });
  const netCell = addMetric("Finansiell nettonytta (nuvärde)", 0);
  const reallocCell = addMetric("Omfördelningsnytta (nuvärde)", 0);
  const breakCell = addMetric("Break-even år", 0, "General");
  addMetric("Finansiell nettonytta – lågt", { formula: `'${today.worksheet.name}'!${today.totalCell}-'${change.worksheet.name}'!${change.totalCell}-'${today.worksheet.name}'!${today.marginCell}-'${change.worksheet.name}'!${change.marginCell}`, result: net.low });
  addMetric("Finansiell nettonytta – högt", { formula: `'${today.worksheet.name}'!${today.totalCell}-'${change.worksheet.name}'!${change.totalCell}+'${today.worksheet.name}'!${today.marginCell}+'${change.worksheet.name}'!${change.marginCell}`, result: net.high });
  result.addRow(["Frigjord tid som används till annat – inte en besparing i budget"]);
  const sectionRow = result.rowCount + 2;
  section(result, sectionRow, "Nettonytta per år", 8);
  header(result.addRow(["År", "Finansiell nettonytta (kr)", "Omfördelningsnytta (kr)", "Ackumulerad finansiell nettonytta (kr)"]));
  const resultRows: number[] = [];
  net.perYear.forEach((item, index) => {
    const r = result.rowCount + 1;
    resultRows.push(r);
    result.addRow([item.year,
      { formula: `'${today.worksheet.name}'!F${today.yearRows[index]}-'${change.worksheet.name}'!F${change.yearRows[index]}`, result: item.net },
      { formula: `$${valueCell[0]}$${valueCell.slice(1)}*(1+'${today.worksheet.name}'!$B$5)^(A${r}-$A$${resultRows[0]})/(1+'${today.worksheet.name}'!$H$5)^(A${r}-$A$${resultRows[0]})`, result: item.reallocation },
      { formula: index === 0 ? `B${r}` : `D${r - 1}+B${r}`, result: item.cumulative }]);
    for (let c = 2; c <= 4; c++) formula(result.getCell(r, c), currencyFormat, c < 4);
  });
  const first = resultRows[0];
  const last = resultRows[resultRows.length - 1];
  result.getCell(netCell).value = { formula: `SUM(B${first}:B${last})`, result: net.totalNet };
  result.getCell(reallocCell).value = { formula: `SUM(C${first}:C${last})`, result: net.perYear.reduce((sum, r) => sum + r.reallocation, 0) };
  result.getCell(breakCell).value = { formula: resultRows.reduceRight((tail, r) => `IF(D${r}>0,A${r},${tail})`, `"${NO_BREAK_EVEN}"`), result: net.breakEvenYear };
  section(result, result.rowCount + 2, "Kvalitativa nyttor", 8);
  header(result.addRow(["Nytta", "Typ", "Gynnas", "Förflyttning", "Bedömning"]));
  qualRows.forEach((item) => result.addRow([benefitSentence(item.benefit), item.benefit.type, item.benefit.gynnas, item.movement, item.label]));
  finish(result, [48, 26, 26, 30, 28, 16, 16, 16]);

  const followUp = workbook.addWorksheet("6 Uppföljning");
  title(followUp, "6 Uppföljning", "Plan för uppföljning och realisering av nyttorna", 10);
  section(followUp, 4, "Uppföljning per nytta", 10);
  header(followUp.addRow(["Nytta", "Typ", "Effektmål", "Syfte", "När", "Hur", "Vad", "Ansvarig", "Resultat", "Åtgärd"]));
  state.project.benefits.forEach((benefit, index) => {
    const item = state.followUp[index] ?? emptyFollowUp();
    const row = followUp.addRow([
      benefitSentence(benefit), benefit.type, item.effektmal, item.syfte, item.nar,
      item.hur, item.vad, item.ansvarig, item.resultat, item.atgard,
    ]);
    row.eachCell((cell) => input(cell));
  });
  if (state.project.benefits.length === 0) followUp.addRow(["Inga nyttor att följa upp"]);
  finish(followUp, [42, 24, 32, 28, 20, 28, 28, 22, 28, 28]);

  return workbook;
}

export async function exportNyttokalkylToExcel(state: AppState) {
  const workbook = buildNyttokalkylWorkbook(state);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(state.project.name);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}