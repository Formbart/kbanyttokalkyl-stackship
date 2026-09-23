import { useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, SectionCard } from "./shared";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import {
  aggregate,
  autoMatch,
  readSheet,
  selectableColumns,
  type SheetData,
} from "@/lib/nyttokalkyl/surveyResults";
import {
  SURVEY_QUESTION_TYPE_LABELS,
  type Survey,
  type SurveyResult,
} from "@/lib/nyttokalkyl/types";

const NONE = "__none__";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("sv-SE");
}

function ScaleChart({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const data = ["1", "2", "3", "4", "5"].map((k) => ({
    value: k,
    antal: distribution[k] ?? 0,
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="value" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            formatter={(v: number) => [`${v} svar`, "Antal"]}
            labelFormatter={(l: string) => `Svar: ${l}`}
          />
          <Bar dataKey="antal" fill="var(--color-brand)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="antal" position="top" className="text-xs" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChoiceChart({
  counts,
}: {
  counts: { option: string; count: number }[];
}) {
  const data = counts.map((c) => ({ option: c.option || "(tomt)", antal: c.count }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" />
          <XAxis
            dataKey="option"
            tickLine={false}
            axisLine={false}
            interval={0}
            height={48}
            className="text-[10px]"
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <Tooltip formatter={(v: number) => [`${v} svar`, "Antal"]} />
          <Bar dataKey="antal" fill="var(--color-brand)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="antal" position="top" className="text-xs" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultView({
  survey,
  result,
  qualRating,
  onRemove,
}: {
  survey: Survey;
  result: SurveyResult;
  qualRating: { current: number; expected: number } | undefined;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="print-keep flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-brand-soft/50 px-4 py-3">
        <div className="text-sm">
          <p className="font-medium text-foreground">
            {result.responseCount} svar importerade
          </p>
          <p className="text-xs text-muted-foreground">
            {result.fileName} · importerad {formatDate(result.importedAt)}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="no-print gap-2 text-negative">
              <Trash2 className="size-4" />
              Ta bort resultat
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ta bort importerat resultat?</AlertDialogTitle>
              <AlertDialogDescription>
                Det importerade enkätresultatet tas bort från kalkylen. Du kan importera
                en ny resultatfil efteråt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove}>Ta bort</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {result.perQuestion.map((q) => {
        const question = survey.questions[q.qi];
        return (
          <div
            key={q.qi}
            className="print-keep space-y-3 rounded-xl border border-border p-4"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {q.qi + 1}. {question?.question || "(Frågan saknar text)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {q.header
                  ? `Kolumn: ${q.header} · ${q.responses} svar`
                  : "Ingen matchad kolumn · 0 svar"}
              </p>
            </div>

            {q.kind === "scale" ? (
              <>
                <ScaleChart distribution={q.distribution} />
                <p className="text-sm text-foreground">
                  Snitt:{" "}
                  {q.average === null ? "–" : `${q.average.toFixed(1)}/5`} ·{" "}
                  {q.responses} svar
                </p>
                {qualRating && q.average !== null ? (
                  <p className="text-sm text-muted-foreground">
                    Steg 4 uppskattade en förflyttning från {qualRating.current} till{" "}
                    {qualRating.expected}. Enkätsnittet efter genomförd förändring är{" "}
                    {q.average.toFixed(1)}.
                  </p>
                ) : null}
              </>
            ) : q.kind === "choice" ? (
              <ChoiceChart counts={q.counts} />
            ) : q.answers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga svar.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
                {q.answers.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SurveyResultsTab({ index }: { index: number }) {
  const { state, setSurveyResult } = useNyttokalkyl();
  const survey = state.surveys[index];
  const result = state.surveyResults[index];
  const qualRating = state.qualRatings[index];

  const [consent, setConsent] = useState(false);
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<(number | null)[]>([]);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!survey) {
    return (
      <EmptyState title="Skapa ett enkätförslag först">
        Resultatimporten matchar kolumnerna i Excel-filen mot enkätens frågor, så
        enkäten behöver finnas under fliken Enkätförslag innan du importerar svar.
      </EmptyState>
    );
  }

  if (result) {
    return (
      <ResultView
        survey={survey}
        result={result}
        qualRating={qualRating}
        onRemove={() => setSurveyResult(index, null)}
      />
    );
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const data = await readSheet(file);
      setSheet(data);
      setFileName(file.name);
      setMapping(autoMatch(survey, data.headers));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Filen kunde inte läsas.");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmImport = () => {
    if (!sheet) return;
    setSurveyResult(index, aggregate(survey, sheet, mapping, fileName));
    setSheet(null);
    setFileName("");
    toast.success("Enkätresultatet är importerat.");
  };

  const columns = sheet ? selectableColumns(sheet.headers) : [];

  return (
    <div className="space-y-5">
      {!sheet ? (
        <SectionCard
          title="Importera enkätresultat"
          description="Öppna resultatet i Microsoft Forms, välj ”… → Öppna i Excel” och ladda upp filen här."
        >
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm text-foreground">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <span>
                Jag intygar att filen jag laddar upp inte innehåller personuppgifter
                (namn, e-postadress, personnummer eller liknande).
              </span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!consent || reading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-4" />
              {reading ? "Läser filen…" : "Välj Excel-fil"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Kolumner med namn, e-post, ID eller tidsstämplar utesluts alltid
              automatiskt och kan inte väljas.
            </p>
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="Granska matchningen"
          description={`${fileName} · ${sheet.rows.length} rader. Kontrollera att varje fråga är kopplad till rätt kolumn innan du bekräftar.`}
        >
          <div className="space-y-3">
            {survey.questions.map((q, qi) => (
              <div
                key={q.id || qi}
                className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-2 md:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {qi + 1}. {q.question || "(Frågan saknar text)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {SURVEY_QUESTION_TYPE_LABELS[q.questionType]}
                  </p>
                </div>
                <Select
                  value={mapping[qi] === null || mapping[qi] === undefined
                    ? NONE
                    : String(mapping[qi])}
                  onValueChange={(v) =>
                    setMapping((m) =>
                      m.map((cur, i) =>
                        i === qi ? (v === NONE ? null : Number(v)) : cur,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ingen matchning" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ingen matchning</SelectItem>
                    {columns.map((ci) => (
                      <SelectItem key={ci} value={String(ci)}>
                        {sheet.headers[ci]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSheet(null);
                  setFileName("");
                }}
              >
                Avbryt
              </Button>
              <Button size="sm" onClick={confirmImport}>
                Bekräfta import
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
