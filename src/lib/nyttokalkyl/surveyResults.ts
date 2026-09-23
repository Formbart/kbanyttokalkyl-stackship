import type { QuestionResult, Survey, SurveyResult } from "./types";
import { surveySignature } from "./types";

/** Kolumner som aldrig får väljas — tekniskt skyddsnät utöver GDPR-samtycket. */
export const PII_HEADER_RE =
  /(respondent|^id$|namn|^name$|e-?post|^email$|mejl|start ?time|completion ?time|starttid|sluttid|ip.?adress|ip.?address)/i;

export interface SheetData {
  headers: string[];
  rows: string[][];
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; richText?: unknown[] };
    if (typeof v.text === "string") return v.text;
    if (Array.isArray(v.richText))
      return v.richText
        .map((r) => String((r as { text?: unknown }).text ?? ""))
        .join("");
    if (v.result !== undefined && v.result !== null) return String(v.result);
    if (value instanceof Date) return value.toISOString();
    return "";
  }
  return String(value);
}

export async function readSheet(file: File): Promise<SheetData> {
  const ExcelJS = await import("exceljs");
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error(
      "Filen kunde inte läsas som Excel-fil (.xlsx). Exportera resultatet från Microsoft Forms via ”Öppna i Excel” och ladda upp den filen.",
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Excel-filen innehåller inget kalkylblad.");

  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    const cells: string[] = [];
    for (let c = 1; c < values.length; c++) cells.push(cellText(values[c]).trim());
    matrix.push(cells);
  });

  const headerRow = matrix.shift();
  if (!headerRow || headerRow.every((h) => !h))
    throw new Error("Excel-filen saknar kolumnrubriker på första raden.");

  return { headers: headerRow, rows: matrix };
}

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeForMatch(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeForMatch(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  return inter / new Set([...ta, ...tb]).size;
}

export function selectableColumns(headers: string[]): number[] {
  return headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.trim() !== "" && !PII_HEADER_RE.test(h.trim()))
    .map(({ i }) => i);
}

/** Föreslår en kolumn per fråga. Returnerar kolumnindex eller null. */
export function autoMatch(survey: Survey, headers: string[]): (number | null)[] {
  const candidates = selectableColumns(headers);
  const used = new Set<number>();
  return survey.questions.map((q) => {
    let best: number | null = null;
    let bestScore = 0;
    for (const ci of candidates) {
      if (used.has(ci)) continue;
      const score = tokenSimilarity(q.question, headers[ci] ?? "");
      if (score > bestScore) {
        bestScore = score;
        best = ci;
      }
    }
    if (best !== null && bestScore >= 0.3) {
      used.add(best);
      return best;
    }
    return null;
  });
}

export function parseScaleValue(raw: unknown): number | null {
  const m = String(raw ?? "")
    .trim()
    .match(/^([1-5])\b/);
  return m ? parseInt(m[1]!, 10) : null;
}

export function aggregate(
  survey: Survey,
  sheet: SheetData,
  mapping: (number | null)[],
  fileName: string,
): SurveyResult {
  const perQuestion: QuestionResult[] = survey.questions.map((q, qi) => {
    const ci = mapping[qi] ?? null;
    const header = ci === null ? null : (sheet.headers[ci] ?? null);
    const values =
      ci === null ? [] : sheet.rows.map((r) => (r[ci] ?? "").trim()).filter(Boolean);

    if (q.questionType === "skala") {
      const distribution: Record<string, number> = {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
        "5": 0,
      };
      let sum = 0;
      let n = 0;
      for (const v of values) {
        const parsed = parseScaleValue(v);
        if (parsed === null) continue;
        distribution[String(parsed)] = (distribution[String(parsed)] ?? 0) + 1;
        sum += parsed;
        n++;
      }
      return {
        kind: "scale",
        qi,
        header,
        distribution,
        average: n > 0 ? sum / n : null,
        responses: n,
      };
    }

    if (q.questionType === "flerval") {
      const options = q.options ?? [];
      const counts = new Map<string, number>();
      options.forEach((o) => counts.set(o.trim(), 0));
      for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
      return {
        kind: "choice",
        qi,
        header,
        counts: [...counts.entries()].map(([option, count]) => ({ option, count })),
        responses: values.length,
      };
    }

    return { kind: "open", qi, header, answers: values, responses: values.length };
  });

  return {
    fileName,
    importedAt: new Date().toISOString(),
    responseCount: sheet.rows.filter((r) => r.some((c) => c.trim() !== "")).length,
    signature: surveySignature(survey),
    perQuestion,
  };
}
