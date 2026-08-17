import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { ErrorBanner, FactCheckBadge, SectionCard } from "./shared";
import { callAgent, type ChatMessage } from "@/lib/nyttokalkyl/agent";
import {
  emptyCostItem,
  emptyStaffChange,
  emptyStaffToday,
  initialState,
  type AppState,
  type Benefit,
  type CostItem,
  type StaffChange,
  type StaffToday,
} from "@/lib/nyttokalkyl/types";
import { formatKr } from "@/lib/nyttokalkyl/calc";

interface DraftPayload {
  chatReply?: string;
  draftReady?: boolean;
  project?: Partial<AppState["project"]>;
  costToday?: {
    growth?: number;
    items?: CostItem[];
    staff?: StaffToday[];
  };
  costChange?: {
    growth?: number;
    items?: CostItem[];
    staff?: StaffChange[];
  };
  qualitative?: { benefitIndex: number; current: number; expected: number }[];
  assumptions?: string;
}

export function StartChat({
  onDone,
  onSkip,
}: {
  onDone: (assumptions: string | null) => void;
  onSkip: () => void;
}) {
  const { setState } = useNyttokalkyl();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<DraftPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factCheck, setFactCheck] = useState<{
    factChecked?: boolean;
    report?: string;
  }>({});

  const send = async () => {
    const description = input.trim();
    if (!description) return;
    const prior = history;
    setHistory([...prior, { role: "user", content: description }]);
    setInput("");
    setLoading(true);
    setError(null);
    const res = await callAgent<DraftPayload>("generate_full_draft", {
      description,
      history: prior,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    const data = res.data ?? {};
    setFactCheck({ factChecked: res.factChecked, report: res.factCheckReport });
    setDraft(data);
    if (data.chatReply) {
      setHistory((h) => [...h, { role: "assistant", content: data.chatReply! }]);
    }
  };

  const apply = () => {
    if (!draft) return;
    const base = initialState();
    const benefits: Benefit[] = (draft.project?.benefits ?? []).map((b) => ({
      change: b.change ?? "",
      effect: b.effect ?? "",
      benefit: b.benefit ?? "",
      stakeholder: b.stakeholder ?? "",
      type: b.type ?? "",
      gynnas: b.gynnas ?? "",
      mal: b.mal ?? "",
      rank: "",
    }));
    const startYear = Number(draft.project?.startYear) || base.project.startYear;
    const qualRatings: AppState["qualRatings"] = {};
    (draft.qualitative ?? []).forEach((q) => {
      qualRatings[q.benefitIndex] = {
        current: Math.min(5, Math.max(1, Number(q.current) || 3)),
        expected: Math.min(5, Math.max(1, Number(q.expected) || 3)),
      };
    });

    setState({
      project: {
        ...base.project,
        name: draft.project?.name ?? "",
        alt1: draft.project?.alt1 ?? "",
        alt2: draft.project?.alt2 ?? "",
        startYear,
        benefits: benefits.slice(0, 5),
        stakeholders: draft.project?.stakeholders ?? "",
      },
      costToday: {
        growth: Number(draft.costToday?.growth) || 0,
        items: (draft.costToday?.items ?? []).map((it) => ({
          ...emptyCostItem(startYear),
          ...it,
          costPerYear: Number(it.costPerYear) || 0,
        })),
        staff: (draft.costToday?.staff ?? []).map((r) => ({
          ...emptyStaffToday(),
          ...r,
          salary: Number(r.salary) || 0,
          hours: Number(r.hours) || 0,
        })),
      },
      costChange: {
        growth: Number(draft.costChange?.growth) || 0,
        items: (draft.costChange?.items ?? []).map((it) => ({
          ...emptyCostItem(startYear),
          ...it,
          costPerYear: Number(it.costPerYear) || 0,
        })),
        staff: (draft.costChange?.staff ?? []).map((r) => ({
          ...emptyStaffChange(),
          ...r,
          salary: Number(r.salary) || 0,
          hours: Number(r.hours) || 0,
        })),
      },
      qualRatings,
      reallocationInGraph: false,
      followUp: {},
    });
    toast.success("Utkastet är ifyllt i steg 1.");
    onDone(draft.assumptions ?? null);
  };

  const previewCostLine = () => {
    const t = (draft?.costToday?.items ?? []).reduce(
      (s, i) => s + (Number(i.costPerYear) || 0),
      0,
    );
    const c = (draft?.costChange?.items ?? []).reduce(
      (s, i) => s + (Number(i.costPerYear) || 0),
      0,
    );
    if (!t && !c) return "Inga kostnadsposter föreslagna än.";
    return `Kostnadsposter: idag ${formatKr(t)}/år, vid förändring ${formatKr(c)}/år`;
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Nytt projekt
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-foreground">
            Beskriv ditt projekt så sätter AI:n upp ett första förslag åt dig
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Skriv fritt om förändringen — nuläge, vad ni vill göra och vilka som
            påverkas. Du får ett förifyllt utkast som du sedan justerar i de sex
            stegen.
          </p>
        </div>

        {history.length > 0 && (
          <div className="space-y-3">
            {history.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-brand px-4 py-3 text-sm text-primary-foreground"
                    : "max-w-[85%] rounded-2xl border border-border bg-card px-4 py-3 text-sm"
                }
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> AI tänker…
              </div>
            )}
          </div>
        )}

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <div className="surface-card p-4">
          <Textarea
            rows={5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Vi vill digitalisera bygglovsansökan så invånare kan söka bygglov online istället för på papper…"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Skicka
            </Button>
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Hoppa över, jag fyller i själv
            </button>
          </div>
        </div>

        {draft && (
          <div className="flex flex-wrap gap-3">
            {draft.draftReady ? (
              <Button onClick={apply} className="gap-2">
                <Sparkles className="size-4" />
                Använd det här förslaget →
              </Button>
            ) : (
              <Button variant="outline" onClick={apply}>
                Fyll i ändå med bästa gissning
              </Button>
            )}
          </div>
        )}
      </div>

      <SectionCard
        title="Förhandsgranskning"
        action={
          <FactCheckBadge
            factChecked={factCheck.factChecked}
            report={factCheck.report}
          />
        }
        className="h-fit lg:sticky lg:top-24"
      >
        {!draft ? (
          <p className="text-sm text-muted-foreground">
            Här sammanfattas AI:ns förslag löpande medan ni chattar.
          </p>
        ) : (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Projektnamn
              </dt>
              <dd className="font-medium">
                {draft.project?.name || "Inte namngivet än"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Nyttor
              </dt>
              <dd className="num font-medium">
                {draft.project?.benefits?.length ?? 0} föreslagna
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Kostnader
              </dt>
              <dd>{previewCostLine()}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Status
              </dt>
              <dd>
                {draft.draftReady
                  ? "Utkastet är klart att användas."
                  : "AI:n behöver mer information."}
              </dd>
            </div>
          </dl>
        )}
      </SectionCard>
    </div>
  );
}
