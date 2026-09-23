import type { Survey } from "./types";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

/**
 * Bygger text i Microsoft Forms "Snabbimport"-format:
 * numrerad fråga + svarsalternativ märkta A., B. ... på egna rader.
 * Frågor utan alternativ tolkas som fritextfrågor.
 */
export function buildFormsText(survey: Survey): string {
  const lines: string[] = [];
  if (survey.title.trim()) lines.push(survey.title.trim());
  if (survey.intro.trim()) lines.push(survey.intro.trim());
  lines.push("");

  survey.questions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.question.trim()}`);
    if (q.questionType !== "fritext") {
      (q.options ?? []).forEach((option, oi) => {
        const letter = LETTERS[oi] ?? String(oi + 1);
        lines.push(`${letter}. ${option.trim()}`);
      });
    }
    lines.push("");
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function fileBase(survey: Survey): string {
  const base = (survey.title || "enkat")
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "enkat";
}

export async function downloadSurveyDocx(survey: Survey): Promise<void> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [];
  if (survey.title.trim())
    children.push(
      new Paragraph({
        children: [new TextRun({ text: survey.title.trim(), bold: true })],
      }),
    );
  if (survey.intro.trim())
    children.push(new Paragraph({ children: [new TextRun(survey.intro.trim())] }));
  children.push(new Paragraph({ children: [] }));

  survey.questions.forEach((q, i) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. ${q.question.trim()}`, bold: true }),
        ],
      }),
    );
    if (q.questionType !== "fritext") {
      (q.options ?? []).forEach((option, oi) => {
        const letter = LETTERS[oi] ?? String(oi + 1);
        children.push(
          new Paragraph({
            children: [new TextRun(`${letter}. ${option.trim()}`)],
          }),
        );
      });
    }
    children.push(new Paragraph({ children: [] }));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(survey)}-forms.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
