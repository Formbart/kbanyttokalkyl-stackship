import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { AiButton, EmptyState, Field, SectionCard } from "../shared";
import { SurveyTab } from "../SurveyTab";
import { callAgent } from "@/lib/nyttokalkyl/agent";
import {
  QUALITATIVE_TYPES,
  benefitSentence,
  emptyFollowUp,
  type BenefitType,
  type FollowUp,
} from "@/lib/nyttokalkyl/types";


export function Step6() {
  const { state, setFollowUp } = useNyttokalkyl();
  const benefits = state.project.benefits;
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const suggestFollowUp = async (index: number) => {
    const b = benefits[index]!;
    setLoadingIndex(index);
    const isQualitative = QUALITATIVE_TYPES.includes(b.type as BenefitType);
    const res = await callAgent<Partial<Omit<FollowUp, "resultat">>>(
      "suggest_followup",
      {
        benefitText: benefitSentence(b),
        type: b.type,
        gynnas: b.gynnas,
        mal: b.mal,
        qualRating: isQualitative ? (state.qualRatings[index] ?? null) : null,
      },
    );
    setLoadingIndex(null);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const d = res.data ?? {};
    setFollowUp(index, {
      ...(d.effektmal ? { effektmal: d.effektmal } : {}),
      ...(d.syfte ? { syfte: d.syfte } : {}),
      ...(d.nar ? { nar: d.nar } : {}),
      ...(d.hur ? { hur: d.hur } : {}),
      ...(d.vad ? { vad: d.vad } : {}),
      ...(d.ansvarig ? { ansvarig: d.ansvarig } : {}),
      ...(d.atgard ? { atgard: d.atgard } : {}),
    });
    toast.success("AI-förslag ifyllt — justera texterna vid behov.");
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Tips för nyttorealisering">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Utse en ansvarig person per nytta — nyttor utan ägare uteblir.</li>
          <li>Formulera effektmål så att de går att mäta med befintlig data.</li>
          <li>Bestäm när uppföljning sker redan innan förändringen införs.</li>
          <li>
            Följ upp även omfördelningsnyttor: har den frigjorda tiden faktiskt
            gått till det som var tänkt?
          </li>
          <li>Dokumentera avvikelser och besluta om åtgärd — inte bara resultat.</li>
        </ul>
      </SectionCard>

      {benefits.length === 0 ? (
        <SectionCard title="Uppföljning per nytta">
          <EmptyState title="Inga nyttor att följa upp än">
            Lägg till nyttor i steg 1 — varje nytta får då en egen
            uppföljningssektion här.
          </EmptyState>
        </SectionCard>
      ) : (
        benefits.map((b, i) => {
          const f = state.followUp[i] ?? emptyFollowUp();
          return (
            <SectionCard
              key={i}
              title={`Nytta ${i + 1}${b.type ? ` · ${b.type}` : ""}`}
              description={benefitSentence(b) || "(Nyttan saknar text)"}
              action={
                <AiButton
                  onClick={() => void suggestFollowUp(i)}
                  loading={loadingIndex === i}
                >
                  AI-förslag
                </AiButton>
              }
            >
              <Tabs defaultValue="plan">
                <TabsList className="no-print mb-4">
                  <TabsTrigger value="plan">Uppföljningsplan</TabsTrigger>
                  <TabsTrigger value="survey" className="gap-1.5">
                    Enkätförslag
                    {state.surveys[i] ? (
                      <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {state.surveys[i]!.questions.length}
                      </span>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="plan">
              <div className="grid gap-4 md:grid-cols-2">

                <Field label="Effektmål" className="md:col-span-2">
                  <Textarea
                    rows={2}
                    value={f.effektmal}
                    onChange={(e) => setFollowUp(i, { effektmal: e.target.value })}
                  />
                </Field>
                <Field label="Syfte">
                  <Textarea
                    rows={2}
                    value={f.syfte}
                    onChange={(e) => setFollowUp(i, { syfte: e.target.value })}
                  />
                </Field>
                <Field label="När">
                  <Input
                    value={f.nar}
                    onChange={(e) => setFollowUp(i, { nar: e.target.value })}
                    placeholder="T.ex. halvårsvis från 2027"
                  />
                </Field>
                <Field label="Hur">
                  <Textarea
                    rows={2}
                    value={f.hur}
                    onChange={(e) => setFollowUp(i, { hur: e.target.value })}
                  />
                </Field>
                <Field label="Vad">
                  <Textarea
                    rows={2}
                    value={f.vad}
                    onChange={(e) => setFollowUp(i, { vad: e.target.value })}
                  />
                </Field>
                <Field label="Ansvarig">
                  <Input
                    value={f.ansvarig}
                    onChange={(e) => setFollowUp(i, { ansvarig: e.target.value })}
                  />
                </Field>
                <Field label="Resultat">
                  <Textarea
                    rows={2}
                    value={f.resultat}
                    onChange={(e) => setFollowUp(i, { resultat: e.target.value })}
                  />
                </Field>
                <Field label="Åtgärd" className="md:col-span-2">
                  <Textarea
                    rows={2}
                    value={f.atgard}
                    onChange={(e) => setFollowUp(i, { atgard: e.target.value })}
                  />
                </Field>
              </div>
                </TabsContent>
                <TabsContent value="survey">
                  <SurveyTab index={i} benefit={b} />
                </TabsContent>
              </Tabs>
            </SectionCard>

          );
        })
      )}
    </div>
  );
}
