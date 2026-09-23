import type { Position } from "./types";

export const SALARY_HEADER =
  "Gemensamma mätvärden [Slicermätvärde grafer Switch]";

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const rich = value as { text?: string; result?: unknown };
    if (typeof rich.text === "string") return rich.text;
    if (rich.result !== undefined) return String(rich.result);
  }
  return String(value);
}

function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] ?? []).map((c) => c.trim().toLowerCase());
    if (cells.includes("befattning")) return i;
  }
  throw new Error(
    'Hittade ingen rad med kolumnen "Befattning" i de första 15 raderna.',
  );
}

function parseNumber(raw: string): number {
  const cleaned = raw
    .replace(/\s|\u00a0/g, "")
    .replace(/kr/gi, "")
    .replace(/,/g, ".");
  return Number(cleaned) || 0;
}

/** Läser en Excel-fil (BI-export eller ifylld mall) till befattningar. */
export async function parsePositionsFile(file: File): Promise<Position[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("Filen kunde inte läsas som en Excel-fil (.xlsx).");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Excel-filen innehåller inga blad.");

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1).map(cellText));
  });

  const headerIndex = findHeaderRow(rows);
  const header = (rows[headerIndex] ?? []).map((c) => c.trim().toLowerCase());
  const befattningCol = header.indexOf("befattning");
  const aidCol = header.indexOf("aid");
  let salaryCol = header.findIndex((c) =>
    c.includes("gemensamma mätvärden"),
  );
  if (salaryCol === -1 && header.length === 3) salaryCol = 2;
  if (salaryCol === -1)
    salaryCol = header.findIndex(
      (c, i) => i !== befattningCol && i !== aidCol && c !== "",
    );
  if (salaryCol === -1)
    throw new Error("Hittade ingen kolumn med månadslön i filen.");

  const positions: Position[] = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const befattning = (row[befattningCol] ?? "").trim();
    if (!befattning || befattning.toLowerCase() === "befattning") continue;
    if (/^(totalt|summa|total)\b/i.test(befattning)) continue;
    positions.push({
      befattning,
      aid: aidCol === -1 ? "" : (row[aidCol] ?? "").trim(),
      manadslon:
        Math.round(parseNumber(row[salaryCol] ?? "") * 100) / 100,
    });
  }
  if (positions.length === 0)
    throw new Error(
      "Filen innehöll inga giltiga befattningsrader efter rubrikraden.",
    );
  return positions;
}

/** Laddar ner en tom mall med exempelrader. */
export async function downloadPositionsTemplate(): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Befattningar");
  sheet.columns = [
    { header: "Befattning", key: "befattning", width: 42 },
    { header: "AID", key: "aid", width: 40 },
    { header: SALARY_HEADER, key: "manadslon", width: 46 },
  ];
  sheet.getRow(1).font = { name: "Arial", bold: true };
  const examples = [
    ["Ingenjör, bygg/anläggning", "201050 Ingenjör, bygg/anläggning", 44500],
    ["Handläggare, miljö", "205012 Handläggare, miljö", 39800],
  ];
  for (const row of examples) {
    const added = sheet.addRow(row);
    added.font = { name: "Arial", italic: true, color: { argb: "FF808080" } };
    added.getCell(3).numFmt = "#,##0";
  }
  sheet.addRow([]);
  const note = sheet.addRow([
    "Exempelraderna ovan är bara vägledning — ersätt dem med era egna rader innan import.",
  ]);
  note.font = { name: "Arial", italic: true, color: { argb: "FF808080" } };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "befattningsmall.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}
