import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import {
  AiBadge,
  AiButton,
  FactCheckBadge,
  EmptyState,
  Field,
  SectionCard,
  WarningBanner,
} from "../shared";
import { useCalculationAgent } from "@/hooks/useCalculationAgent";
import {
  BENEFICIARY,
  BENEFIT_TYPES,
  RANK_OPTIONS,
  benefitSentence,
  emptyBenefit,
  type Benefit,
  type BenefitType,
  type Beneficiary,
  type Rank,
} from "@/lib/nyttokalkyl/types";

interface Suggestion extends Omit<Benefit, "rank"> {
  rationale?: string;
}

export function Step1({
  assumptions,
  onDismissAssumptions,
}: {
  assumptions?: string | null;
  onDismissAssumptions?: () => void;
}) {
  const callAgent = useCalculationAgent();
  const { state, setState, updateProject } = useNyttokalkyl();
  const { project } = state;
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [factCheck, setFactCheck] = useState<{
    factChecked?: boolean | undefined;
    report?: string | undefined;
  }>({});

  const updateBenefit = (index: number, patch: Partial<Benefit>) =>
    setState((s) => ({
      ...s,
      project: {
        ...s.project,
        benefits: s.project.benefits.map((b, i) =>
          i === index ? { ...b, ...patch } : b,
        ),
      },
    }));

  const removeBenefit = (index: number) =>
    setState((s) => ({
      ...s,
      project: {
        ...s.project,
        benefits: s.project.benefits.filter((_, i) => i !== index),
      },
    }));

  const addBenefit = () => {
    if (project.benefits.length >= 5) return;
    updateProject({ benefits: [...project.benefits, emptyBenefit()] });
  };

  const suggestBenefits = async () => {
    setLoading(true);
    const res = await callAgent<{ benefits: Suggestion[] }>("suggest_benefits", {
      projectName: project.name,
      alt1: project.alt1,
      alt2: project.alt2,
      existingBenefits: project.benefits,
      count: 3,
    });
    setLoading(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const list = res.data?.benefits ?? [];
    setFactCheck({ factChecked: res.factChecked, report: res.factCheckReport });
    setSuggestions(list);
    setPicked(Object.fromEntries(list.map((_, i) => [i, true])));
  };

  const applySuggestions = () => {
    const chosen = (suggestions ?? []).filter((_, i) => picked[i]);
    const space = 5 - project.benefits.length;
    const toAdd = chosen.slice(0, Math.max(space, 0)).map((s) => ({
      change: s.change ?? "",
      effect: s.effect ?? "",
      benefit: s.benefit ?? "",
      stakeholder: s.stakeholder ?? "",
      type: (s.type ?? "") as BenefitType | "",
      gynnas: (s.gynnas ?? "") as Beneficiary | "",
      mal: s.mal ?? "",
      rank: "" as Rank,
    }));
    updateProject({ benefits: [...project.benefits, ...toAdd] });
    setSuggestions(null);
    if (chosen.length > toAdd.length)
      toast.info("Max 5 nyttor — några förslag lades inte till.");
  };

  const updateRevision = (index: number, patch: Partial<(typeof project.revisions)[number]>) =>
    updateProject({
      revisions: project.revisions.map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    });

  return (
    <div className="space-y-6">
      {assumptions && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-change/40 bg-change/10 px-4 py-3 text-sm">
          <p>
            <strong>AI-genererat utkast — verifiera siffrorna innan beslut.</strong>{" "}
            {assumptions}
          </p>
          <button
            type="button"
            aria-label="Stäng"
            onClick={onDismissAssumptions}
            className="no-print shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <SectionCard
        title="Projektet"
        description="Beskriv vad som jämförs: nuläget mot det förändrade läget."
      >
        <div className="grid gap-4">
          <Field label="Projektnamn">
            <Input
              value={project.name}
              onChange={(e) => updateProject({ name: e.target.value })}
              placeholder="T.ex. Digital bygglovsansökan"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Alternativ 1 — som idag">
              <Textarea
                rows={4}
                value={project.alt1}
                onChange={(e) => updateProject({ alt1: e.target.value })}
                placeholder="Hur arbetet går till idag…"
              />
            </Field>
            <Field label="Alternativ 2 — vid förändring">
              <Textarea
                rows={4}
                value={project.alt2}
                onChange={(e) => updateProject({ alt2: e.target.value })}
                placeholder="Hur arbetet går till efter förändringen…"
              />
            </Field>
          </div>
          <Field
            label="Startår"
            hint="Styr den sexåriga kalkylperioden i steg 2, 3 och 5."
          >
            <Input
              type="number"
              className="num max-w-40"
              value={project.startYear}
              onChange={(e) =>
                updateProject({ startYear: Number(e.target.value) || 0 })
              }
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Nyttor och intressenter"
        description="Upp till fem nyttor. Formulera varje nytta som en sammanhängande mening."
        action={
          <AiButton onClick={() => void suggestBenefits()} loading={loading}>
            Föreslå nyttor med AI
          </AiButton>
        }
      >
        {suggestions && (
          <div className="mb-5 space-y-3 rounded-xl border border-brand/30 bg-brand-soft p-4">
            <div className="flex flex-wrap items-center gap-2">
              <AiBadge />
              <p className="text-sm font-medium">
                Förslag från AI — välj vilka som ska läggas till.
              </p>
              <FactCheckBadge
                factChecked={factCheck.factChecked}
                report={factCheck.report}
              />
            </div>
            {suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                AI:n hittade inga förslag.
              </p>
            )}
            {suggestions.map((s, i) => (
              <label key={i} className="flex gap-3 rounded-lg bg-card p-3">
                <Checkbox
                  checked={Boolean(picked[i])}
                  onCheckedChange={(v) =>
                    setPicked((p) => ({ ...p, [i]: Boolean(v) }))
                  }
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    {benefitSentence({ ...s, rank: "" } as Benefit)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.type} · {s.gynnas}
                    {s.rationale ? ` — ${s.rationale}` : ""}
                  </span>
                </span>
              </label>
            ))}
            <div className="flex gap-2">
              <Button size="sm" onClick={applySuggestions}>
                Lägg till valda
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSuggestions(null)}
              >
                Avbryt
              </Button>
            </div>
          </div>
        )}

        {project.benefits.length === 0 ? (
          <EmptyState title="Inga nyttor tillagda än">
            Lägg till minst en nytta för att kunna räkna vidare i steg 4 och 5.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {project.benefits.map((b, i) => (
              <div key={i} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-brand-dark">
                    Nytta {i + 1}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="no-print text-negative"
                    aria-label={`Ta bort nytta ${i + 1}`}
                    onClick={() => removeBenefit(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Genom att…">
                    <Input
                      value={b.change}
                      onChange={(e) => updateBenefit(i, { change: e.target.value })}
                      placeholder="digitalisera ansökan"
                    />
                  </Field>
                  <Field label="(händer)…">
                    <Input
                      value={b.effect}
                      onChange={(e) => updateBenefit(i, { effect: e.target.value })}
                      placeholder="minskar manuell registrering"
                    />
                  </Field>
                  <Field label="…vilket leder till">
                    <Input
                      value={b.benefit}
                      onChange={(e) =>
                        updateBenefit(i, { benefit: e.target.value })
                      }
                      placeholder="kortare handläggningstid"
                    />
                  </Field>
                  <Field label="…för">
                    <Input
                      value={b.stakeholder}
                      onChange={(e) =>
                        updateBenefit(i, { stakeholder: e.target.value })
                      }
                      placeholder="invånare och handläggare"
                    />
                  </Field>
                </div>
                {benefitSentence(b) && (
                  <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-dark">
                    {benefitSentence(b)}
                  </p>
                )}
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Typ av nytta">
                    <Select
                      {...(b.type ? { value: b.type } : {})}
                      onValueChange={(v) =>
                        updateBenefit(i, { type: v as BenefitType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj typ" />
                      </SelectTrigger>
                      <SelectContent>
                        {BENEFIT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Gynnas av nyttan">
                    <Select
                      {...(b.gynnas ? { value: b.gynnas } : {})}
                      onValueChange={(v) =>
                        updateBenefit(i, { gynnas: v as Beneficiary })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj" />
                      </SelectTrigger>
                      <SelectContent>
                        {BENEFICIARY.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Mål/fokusområde som uppfylls">
                    <Input
                      value={b.mal}
                      onChange={(e) => updateBenefit(i, { mal: e.target.value })}
                      placeholder="T.ex. Attraktiv arbetsgivare"
                    />
                  </Field>
                </div>
                <div className="mt-3 max-w-xs">
                  <Field label="Rangordning">
                    <Select
                      value={b.rank || "Övriga nyttor"}
                      onValueChange={(v) =>
                        updateBenefit(i, {
                          rank: (v === "Övriga nyttor" ? "" : v) as Rank,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RANK_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                        <SelectItem value="Övriga nyttor">Övriga nyttor</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="no-print gap-2"
            onClick={addBenefit}
            disabled={project.benefits.length >= 5}
          >
            <Plus className="size-4" />
            Lägg till nytta
          </Button>
          <span className="text-xs text-muted-foreground">
            {project.benefits.length}/5 nyttor
          </span>
        </div>

        <div className="mt-6">
          <Field
            label="Intressenter"
            hint="Vilka påverkas av förändringen, och hur?"
          >
            <Textarea
              rows={4}
              value={project.stakeholders}
              onChange={(e) => updateProject({ stakeholders: e.target.value })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Versionslogg"
        description="Håll ordning på vem som ändrat vad i kalkylen."
        action={
          <Button
            variant="outline"
            size="sm"
            className="no-print gap-2"
            onClick={() =>
              updateProject({
                revisions: [
                  ...project.revisions,
                  {
                    by: "",
                    desc: "",
                    version: "",
                    date: new Date().toISOString().slice(0, 10),
                  },
                ],
              })
            }
          >
            <Plus className="size-4" />
            Ny rad
          </Button>
        }
      >
        {project.revisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga revisioner än.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-3">Redigerad av</th>
                  <th className="pb-2 pr-3">Beskrivning</th>
                  <th className="pb-2 pr-3">Version</th>
                  <th className="pb-2 pr-3">Datum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {project.revisions.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 pr-3">
                      <Input
                        value={r.by}
                        onChange={(e) => updateRevision(i, { by: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={r.desc}
                        onChange={(e) => updateRevision(i, { desc: e.target.value })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        value={r.version}
                        onChange={(e) =>
                          updateRevision(i, { version: e.target.value })
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="date"
                        value={r.date}
                        onChange={(e) => updateRevision(i, { date: e.target.value })}
                      />
                    </td>
                    <td className="py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Ta bort rad"
                        className="no-print text-negative"
                        onClick={() =>
                          updateProject({
                            revisions: project.revisions.filter(
                              (_, idx) => idx !== i,
                            ),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {project.benefits.length === 5 && (
          <div className="mt-4">
            <WarningBanner>
              Du har nått max fem nyttor. Prioritera de viktigaste.
            </WarningBanner>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
