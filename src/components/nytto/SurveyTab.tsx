import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Copy,
  Download,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AiButton, Field } from "./shared";
import { buildFormsText, downloadSurveyDocx } from "@/lib/nyttokalkyl/formsExport";
import { callAgent } from "@/lib/nyttokalkyl/agent";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import {
  QUALITATIVE_TYPES,
  SURVEY_QUESTION_TYPES,
  SURVEY_QUESTION_TYPE_LABELS,
  benefitSentence,
  type Benefit,
  type BenefitType,
  type Survey,
  type SurveyQuestion,
  type SurveyQuestionType,
} from "@/lib/nyttokalkyl/types";

function defaultOptions(type: SurveyQuestionType): string[] | undefined {
  if (type === "skala")
    return [
      "1 – Instämmer inte alls",
      "2",
      "3",
      "4",
      "5 – Instämmer helt",
    ];
  if (type === "flerval") return ["Alternativ 1", "Alternativ 2"];
  return undefined;
}

function SurveyPrintDoc({ survey }: { survey: Survey }) {
  return createPortal(
    <div className="survey-print-doc">
      <h1>{survey.title || "Enkät"}</h1>
      {survey.targetGroup ? (
        <p className="survey-print-target">Målgrupp: {survey.targetGroup}</p>
      ) : null}
      {survey.intro ? <p className="survey-print-intro">{survey.intro}</p> : null}
      <ol className="survey-print-questions">
        {survey.questions.map((q, i) => (
          <li key={q.id || i}>
            <p className="survey-print-question">{q.question}</p>
            {q.questionType === "fritext" ? (
              <div className="survey-print-lines">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <ul className="survey-print-options">
                {(q.options ?? []).map((o, oi) => (
                  <li key={oi}>{o}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>,
    document.body,
  );
}

export function SurveyTab({
  index,
  benefit,
}: {
  index: number;
  benefit: Benefit;
}) {
  const { state, setSurvey } = useNyttokalkyl();
  const survey = state.surveys[index];
  const followUp = state.followUp[index];
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(6);
  const [printing, setPrinting] = useState(false);

  const isQualitative = QUALITATIVE_TYPES.includes(benefit.type as BenefitType);
  const highlighted =
    isQualitative || (followUp?.hur ?? "").toLowerCase().includes("enkät");

  const generate = async () => {
    setLoading(true);
    const res = await callAgent<Survey>("suggest_survey", {
      benefitText: benefitSentence(benefit),
      type: benefit.type,
      gynnas: benefit.gynnas,
      stakeholder: benefit.stakeholder,
      mal: benefit.mal,
      qualRating: isQualitative ? (state.qualRatings[index] ?? null) : null,
      hur: followUp?.hur ?? "",
      questionCount,
    });
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const d = res.data;
    setSurvey(index, {
      title: d?.title ?? "Enkät",
      intro: d?.intro ?? "",
      targetGroup: d?.targetGroup ?? "",
      questions: (d?.questions ?? []).map((q, i) => ({
        id: q.id || `q${i + 1}`,
        question: q.question ?? "",
        questionType: SURVEY_QUESTION_TYPES.includes(q.questionType)
          ? q.questionType
          : "fritext",
        options: q.options ?? defaultOptions(q.questionType),
        ai: true,
      })),
    });
    toast.success("Enkätförslag genererat — redigera fritt.");
  };

  const patchQuestion = (qi: number, patch: Partial<SurveyQuestion>) => {
    if (!survey) return;
    setSurvey(index, {
      ...survey,
      questions: survey.questions.map((q, i) =>
        i === qi ? { ...q, ...patch, ai: false } : q,
      ),
    });
  };

  const onPrint = () => {
    if (!survey) return;
    setPrinting(true);
    document.body.classList.add("is-printing-survey");
    window.setTimeout(() => {
      window.print();
      document.body.classList.remove("is-printing-survey");
      setPrinting(false);
    }, 150);
  };

  if (!survey) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {highlighted
            ? "Den här nyttan följs lämpligen upp med en enkät. Låt AI:n föreslå frågor anpassade till målgruppen."
            : "Generera ett förslag på enkät med frågor anpassade till nyttans målgrupp. Du kan redigera allt efteråt."}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Antal frågor" className="w-32">
            <Input
              type="number"
              min={1}
              max={20}
              value={questionCount || ""}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
            />
          </Field>
          <AiButton onClick={() => void generate()} loading={loading}>
            Generera enkätförslag
          </AiButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={loading}
          onClick={() => void generate()}
        >
          <RefreshCw className="size-4" />
          Generera nytt förslag
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onPrint}
          disabled={printing}
        >
          <Printer className="size-4" />
          Skriv ut enkät
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-negative"
          onClick={() => setSurvey(index, null)}
        >
          <Trash2 className="size-4" />
          Rensa enkät
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Enkätens titel" className="md:col-span-2">
          <Input
            value={survey.title}
            onChange={(e) => setSurvey(index, { ...survey, title: e.target.value })}
          />
        </Field>
        <Field label="Ingress" className="md:col-span-2">
          <Textarea
            rows={2}
            value={survey.intro}
            onChange={(e) => setSurvey(index, { ...survey, intro: e.target.value })}
          />
        </Field>
        <Field label="Målgrupp" className="md:col-span-2">
          <Input
            value={survey.targetGroup}
            onChange={(e) =>
              setSurvey(index, { ...survey, targetGroup: e.target.value })
            }
          />
        </Field>
      </div>

      <ol className="space-y-4">
        {survey.questions.map((q, qi) => (
          <li
            key={q.id || qi}
            className="print-keep rounded-xl border border-border p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fråga {qi + 1}
              </span>
              <div className="flex items-center gap-2">
                {q.ai ? (
                  <Badge variant="secondary" className="text-[10px]">
                    AI
                  </Badge>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="no-print size-8 text-negative"
                  aria-label="Ta bort fråga"
                  onClick={() =>
                    setSurvey(index, {
                      ...survey,
                      questions: survey.questions.filter((_, i) => i !== qi),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Frågetext" className="md:col-span-2">
                <Textarea
                  rows={2}
                  value={q.question}
                  onChange={(e) => patchQuestion(qi, { question: e.target.value })}
                />
              </Field>
              <Field label="Frågetyp">
                <Select
                  value={q.questionType}
                  onValueChange={(v) =>
                    patchQuestion(qi, {
                      questionType: v as SurveyQuestionType,
                      options: defaultOptions(v as SurveyQuestionType),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SURVEY_QUESTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SURVEY_QUESTION_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {q.questionType !== "fritext" ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Svarsalternativ
                </p>
                {(q.options ?? []).map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input
                      value={o}
                      onChange={(e) =>
                        patchQuestion(qi, {
                          options: (q.options ?? []).map((v, i) =>
                            i === oi ? e.target.value : v,
                          ),
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="no-print size-8"
                      aria-label="Ta bort svarsalternativ"
                      onClick={() =>
                        patchQuestion(qi, {
                          options: (q.options ?? []).filter((_, i) => i !== oi),
                        })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="no-print gap-2"
                  onClick={() =>
                    patchQuestion(qi, {
                      options: [...(q.options ?? []), ""],
                    })
                  }
                >
                  <Plus className="size-4" />
                  Lägg till svarsalternativ
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      <Button
        variant="outline"
        size="sm"
        className="no-print gap-2"
        onClick={() =>
          setSurvey(index, {
            ...survey,
            questions: [
              ...survey.questions,
              {
                id: `q${survey.questions.length + 1}`,
                question: "",
                questionType: "fritext",
              },
            ],
          })
        }
      >
        <Plus className="size-4" />
        Lägg till fråga
      </Button>

      {printing ? <SurveyPrintDoc survey={survey} /> : null}
    </div>
  );
}
