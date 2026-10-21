import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { NyttokalkylProvider, useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { AppHeader } from "./AppHeader";
import { STEPS, StepNav } from "./StepNav";
import { Step1 } from "./steps/Step1";
import { Step4 } from "./steps/Step4";
import { Step5 } from "./steps/Step5";
import { Step6 } from "./steps/Step6";
import { CostSheetEditor } from "./CostSheetEditor";
import { StartChat } from "./StartChat";
import { ChatAssistant } from "./ChatAssistant";
import { Toaster } from "@/components/ui/sonner";
import { PrintView, type PrintStep } from "./PrintView";
import { PENDING_CALCULATION_STORAGE_KEY } from "@/lib/nyttokalkyl/saved";
import type { AppState } from "@/lib/nyttokalkyl/types";

interface PendingCalculation {
  id: string;
  title: string;
  state: AppState;
}

const INTROS: Record<number, string> = {
  1: "Beskriv projektet, jämförelsealternativen och de nyttor förändringen ska ge.",
  2: "Kartlägg vad nuläget kostar under kalkylperioden.",
  3: "Kartlägg vad det förändrade arbetssättet kostar under samma period.",
  4: "Bedöm hur stor förflyttning de kvalitativa nyttorna och miljönyttorna ger.",
  5: "Sammanställning av kostnader, nettonytta, break-even och övriga nyttor.",
  6: "Planera hur nyttorna följs upp och realiseras efter införandet.",
};

function Inner() {
  const { state, setState, resetToken } = useNyttokalkyl();
  const [step, setStep] = useState(1);
  const [showStartChat, setShowStartChat] = useState(true);
  const [assumptions, setAssumptions] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [calculationTitle, setCalculationTitle] = useState("");
  const [savedStateSnapshot, setSavedStateSnapshot] = useState<string | null>(null);
  const [printSelection, setPrintSelection] = useState<PrintStep[]>(
    STEPS.map((item) => item.id),
  );

  // Efter "rensa allt" ska användaren tillbaka till startsidan Nytt projekt.
  useEffect(() => {
    if (resetToken === 0) return;
    setStep(1);
    setShowStartChat(true);
    setAssumptions(null);
    setCurrentId(null);
    setCalculationTitle("");
    setSavedStateSnapshot(null);
  }, [resetToken]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(PENDING_CALCULATION_STORAGE_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(PENDING_CALCULATION_STORAGE_KEY);
    try {
      const pending = JSON.parse(raw) as Partial<PendingCalculation>;
      if (!pending.id || !pending.title || !pending.state) return;
      setState(pending.state);
      setCurrentId(pending.id);
      setCalculationTitle(pending.title);
      setSavedStateSnapshot(JSON.stringify(pending.state));
      setStep(1);
      setShowStartChat(false);
      setAssumptions(null);
    } catch {
      // Ignorera en korrupt tillfällig öppning.
    }
  }, [setState]);

  const startChatActive =
    showStartChat && state.project.name.trim() === "" && step === 1;

  const current = STEPS.find((s) => s.id === step)!;

  return (
    <div className="min-h-screen bg-background">
      <div className="screen-app">
        <AppHeader
          printSelection={printSelection}
          onPrintSelectionChange={setPrintSelection}
          currentId={currentId}
          onCurrentIdChange={setCurrentId}
          calculationTitle={calculationTitle}
          onCalculationTitleChange={setCalculationTitle}
          hasUnsavedChanges={
            currentId !== null &&
            savedStateSnapshot !== null &&
            JSON.stringify(state) !== savedStateSnapshot
          }
          onSaved={() => setSavedStateSnapshot(JSON.stringify(state))}
        />
        {startChatActive ? (
          <StartChat
            onDone={(a) => {
              setAssumptions(a);
              setShowStartChat(false);
              setStep(1);
            }}
            onSkip={() => setShowStartChat(false)}
          />
        ) : (
          <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-10 lg:py-10">
            <StepNav current={step} state={state} onSelect={setStep} />
            <div className="print-full min-w-0 flex-1 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand">
                  Steg {step} av 6
                </p>
                <h2 className="mt-1.5 font-display text-2xl font-semibold text-foreground sm:text-3xl">
                  {current.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  {INTROS[step]}
                </p>
              </div>

              {step === 1 && (
                <Step1
                  assumptions={assumptions}
                  onDismissAssumptions={() => setAssumptions(null)}
                />
              )}
              {step === 2 && <CostSheetEditor scenario="today" />}
              {step === 3 && <CostSheetEditor scenario="change" />}
              {step === 4 && <Step4 />}
              {step === 5 && <Step5 />}
              {step === 6 && <Step6 />}

              <div className="no-print flex items-center justify-between gap-3 border-t border-border pt-5">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={step === 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                >
                  <ArrowLeft className="size-4" />
                  Föregående
                </Button>
                <Button
                  className="gap-2"
                  disabled={step === 6}
                  onClick={() => setStep((s) => Math.min(6, s + 1))}
                >
                  Nästa
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </main>
        )}
        {!startChatActive && <ChatAssistant />}
        <Toaster />
      </div>
      <PrintView selected={printSelection} />
    </div>
  );
}

export function NyttokalkylApp() {
  return (
    <NyttokalkylProvider>
      <Inner />
    </NyttokalkylProvider>
  );
}
