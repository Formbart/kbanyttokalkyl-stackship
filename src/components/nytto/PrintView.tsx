import { CostSheetEditor } from "./CostSheetEditor";
import { STEPS } from "./StepNav";
import { Step1 } from "./steps/Step1";
import { Step4 } from "./steps/Step4";
import { Step5 } from "./steps/Step5";
import { Step6 } from "./steps/Step6";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";

export type PrintStep = (typeof STEPS)[number]["id"];

const PRINT_INTROS: Record<PrintStep, string> = {
  1: "Grundinformation om projektet, jämförelsealternativen och planerade nyttor.",
  2: "Kostnader för nuläget under kalkylperioden.",
  3: "Kostnader för det förändrade arbetssättet under kalkylperioden.",
  4: "Bedömning av kvalitativa nyttor och miljönyttor.",
  5: "Sammanställning av kostnader, nettonytta, break-even och övriga nyttor.",
  6: "Plan för uppföljning och realisering av nyttorna.",
};

function StepContent({ step }: { step: PrintStep }) {
  if (step === 1) return <Step1 />;
  if (step === 2) return <CostSheetEditor scenario="today" />;
  if (step === 3) return <CostSheetEditor scenario="change" />;
  if (step === 4) return <Step4 />;
  if (step === 5) return <Step5 />;
  return <Step6 />;
}

export function PrintView({ selected }: { selected: PrintStep[] }) {
  const { state } = useNyttokalkyl();

  return (
    <div className="print-document" aria-hidden="true">
      <header className="print-cover">
        <p className="print-municipality">Kungsbacka kommun</p>
        <h1>Nyttokalkyl</h1>
        <p>{state.project.name || "Namnlöst projekt"}</p>
        <p className="print-date">
          Utskriven {new Intl.DateTimeFormat("sv-SE").format(new Date())}
        </p>
      </header>

      {selected.map((step) => {
        const definition = STEPS.find((item) => item.id === step);
        if (!definition) return null;
        return (
          <section className="print-step" key={step} data-print-step={step}>
            <header className="print-step-heading">
              <p>Del {step} av 6</p>
              <h2>{definition.title}</h2>
              <span>{PRINT_INTROS[step]}</span>
            </header>
            <StepContent step={step} />
          </section>
        );
      })}
    </div>
  );
}