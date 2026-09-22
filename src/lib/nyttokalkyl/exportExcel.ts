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
  staffAnnualCost,
  years,
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
) {
  const ws = workbook.addWorksheet(name);
  title(ws, name, subtitle, 10);
  section(ws, 4, "Antaganden", 10);
  ws.addRow(["Årlig kostnadsökning", sheet.growth / 100, "PO-påslag", PO_FACTOR - 1, "Heltidsmått (h/år)", FULL_TIME_HOURS]);
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
  sheet.staff.forEach((person) => {
    const isChange = "benefitType" in person;
    const annual = staffAnnualCost(person.salary, person.hours, person.count ?? 1);
    const row = ws.addRow([
      person.role,
      person.count ?? 1,
      person.hours / FULL_TIME_HOURS,
      person.salary,
      person.hours,
      isChange ? (person as StaffChange).benefitType : "",
      person.desc,
      { formula: `B${ws.rowCount + 1}*D${ws.rowCount + 1}*12*(1+$D$5)*C${ws.rowCount + 1}`, result: annual },
    ]);
    for (let column = 1; column <= 7; column += 1) input(row.getCell(column));
    row.getCell(3).numFmt = percentFormat;
    row.getCell(4).numFmt = currencyFormat;
    row.getCell(5).numFmt = numberFormat;
    formula(row.getCell(8), currencyFormat);
  });
  if (sheet.staff.length === 0) ws.addRow(["Ingen personal registrerad"]);
  const staffEnd = Math.max(staffStart, ws.rowCount);

  const summarySectionRow = ws.rowCount + 2;
  section(ws, summarySectionRow, "Kostnader per år", 10);
  const summaryHeader = ws.addRow(["År", "Engångskostnader (kr)", "Löpande kostnader (kr)", "Personalkostnader (kr)", "Total kostnad (kr)", "Nuvärde (kr)"]);
  header(summaryHeader);
  const calc = computeCostSheet(sheet, startYear);
  calc.perYear.forEach((calculated, index) => {
    const excelRow = ws.rowCount + 1;
    const year = startYear + index;
    const oneTimeFormula = sheet.items.length
      ? `SUMIFS($C$${itemStart}:$C$${itemEnd},$B$${itemStart}:$B$${itemEnd},"Engångskostnad",$D$${itemStart}:$D$${itemEnd},A${excelRow})`
      : "0";
    const recurringFormula = sheet.items.length
      ? `SUMIFS($C$${itemStart}:$C$${itemEnd},$B$${itemStart}:$B$${itemEnd},"Löpande driftkostnader (årligen återkommande)",$D$${itemStart}:$D$${itemEnd},"<="&A${excelRow})*(1+$B$5)^(A${excelRow}-$A$${excelRow - index})`
      : "0";
    const staffFormula = sheet.staff.length
      ? `SUM($H$${staffStart}:$H$${staffEnd})*(1+$B$5)^(A${excelRow}-$A$${excelRow - index})`
      : "0";
    const row = ws.addRow([
      String(year),
      { formula: oneTimeFormula, result: calculated.oneTime },
      { formula: recurringFormula, result: calculated.recurring },
      { formula: staffFormula, result: calculated.staffCost },
      { formula: `SUM(B${excelRow}:D${excelRow})`, result: calculated.total },
      { formula: `E${excelRow}/(1+${DISCOUNT_RATE})^(A${excelRow}-$A$${excelRow - index})`, result: calculated.npv },
    ]);
    input(row.getCell(1));
    for (let column = 2; column <= 6; column += 1) formula(row.getCell(column), currencyFormat);
  });
  const totalRowNumber = ws.rowCount + 1;
  const totalRow = ws.addRow(["Totalt nuvärde", "", "", "", "", { formula: `SUM(F${totalRowNumber - 6}:F${totalRowNumber - 1})`, result: calc.npvSum }]);
  totalRow.font = { name: "Arial", bold: true };
  formula(totalRow.getCell(6), currencyFormat);
  finish(ws, [26, 18, 19, 18, 17, 22, 35, 22, 14, 14]);
  return { worksheet: ws, totalCell: `F${totalRowNumber}` };
}

function safeFilename(name: string) {
  const cleaned = name.trim().replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "-");
  return `nyttokalkyl-${cleaned || "utkast"}.xlsx`;
}

export async function exportNyttokalkylToExcel(state: AppState) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kungsbacka kommun – Nyttokalkyl";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const basic = workbook.addWorksheet("1 Grundinformation");
  title(basic, "1 Grundinformation", "Projektuppgifter, alternativ och planerade nyttor", 8);
  section(basic, 4, "Projekt", 8);
  basic.addRow(["Projektnamn", state.project.name, "Startår", String(state.project.startYear)]);
  basic.addRow(["Alternativ 1", state.project.alt1]);
  basic.addRow(["Alternativ 2", state.project.alt2]);
  basic.addRow(["Intressenter", state.project.stakeholders]);
  ["B5", "D5", "B6", "B7", "B8"].forEach((address) => input(basic.getCell(address)));
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

  const today = addCostSheet(workbook, "2 Kostnad idag", "Nulägets kostnader under kalkylperioden", state.costToday, state.project.startYear);
  const change = addCostSheet(workbook, "3 Kostnad förändring", "Kostnader för det förändrade arbetssättet", state.costChange, state.project.startYear);

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
  title(result, "5 Resultat", "Sammanställning av kostnader, nettonytta och omfördelningsnytta", 8);
  section(result, 4, "Nyckeltal", 8);
  const todayCalc = computeCostSheet(state.costToday, state.project.startYear);
  const changeCalc = computeCostSheet(state.costChange, state.project.startYear);
  const net = computeNetBenefit(state, todayCalc, changeCalc, state.reallocationInGraph);
  const realloc = computeReallocation(state.costToday.staff, state.costChange.staff);
  result.addRow(["Kostnad idag, nuvärde (kr)", { formula: `'${today.worksheet.name}'!${today.totalCell}`, result: todayCalc.npvSum }]);
  result.addRow(["Kostnad vid förändring, nuvärde (kr)", { formula: `'${change.worksheet.name}'!${change.totalCell}`, result: changeCalc.npvSum }]);
  result.addRow(["Omfördelningsnytta inkluderad", state.reallocationInGraph ? "Ja" : "Nej"]);
  result.addRow(["Frigjorda timmar/år", realloc.hoursFreed]);
  result.addRow(["Värde av frigjord tid/år (kr)", realloc.valueFreed]);
  result.addRow(["Finansiell nettonytta (kr)", net.totalNet]);
  result.addRow(["Break-even år", String(net.breakEvenYear)]);
  ["B5", "B6"].forEach((address) => formula(result.getCell(address), currencyFormat, true));
  input(result.getCell("B7"));
  input(result.getCell("B8"), numberFormat);
  input(result.getCell("B9"), currencyFormat);
  input(result.getCell("B10"), currencyFormat);
  input(result.getCell("B11"));
  section(result, 13, "Nettonytta per år", 8);
  header(result.addRow(["År", "Nettonytta (kr)", "Ackumulerad nettonytta (kr)"]));
  net.perYear.forEach((item, index) => {
    const rowNumber = result.rowCount + 1;
    const todaySourceRow = today.worksheet.rowCount - 6 + index;
    const changeSourceRow = change.worksheet.rowCount - 6 + index;
    const linkedFormula = `'${today.worksheet.name}'!F${todaySourceRow}-'${change.worksheet.name}'!F${changeSourceRow}`;
    const row = result.addRow([
      String(item.year),
      { formula: linkedFormula, result: item.net },
      { formula: index === 0 ? `B${rowNumber}` : `C${rowNumber - 1}+B${rowNumber}`, result: item.cumulative },
    ]);
    input(row.getCell(1));
    formula(row.getCell(2), currencyFormat, true);
    formula(row.getCell(3), currencyFormat);
  });
  section(result, result.rowCount + 2, "Kvalitativa nyttor", 8);
  header(result.addRow(["Nytta", "Typ", "Gynnas", "Förflyttning", "Bedömning"]));
  qualRows.forEach((item) => result.addRow([benefitSentence(item.benefit), item.benefit.type, item.benefit.gynnas, item.movement, item.label]));
  finish(result, [38, 24, 24, 18, 28, 16, 16, 16]);

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

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(state.project.name);
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}