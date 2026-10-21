import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { NyttokalkylProvider } from "@/lib/nyttokalkyl/store";
import { loadSharedCalculation } from "@/lib/nyttokalkyl/saved";
import type { AppState } from "@/lib/nyttokalkyl/types";
import { STEPS } from "@/components/nytto/StepNav";
import { Step1 } from "@/components/nytto/steps/Step1";
import { Step4 } from "@/components/nytto/steps/Step4";
import { Step5 } from "@/components/nytto/steps/Step5";
import { Step6 } from "@/components/nytto/steps/Step6";
import { CostSheetEditor } from "@/components/nytto/CostSheetEditor";
import kungsbackaVapen from "@/assets/kungsbacka-kommunvapen.png.asset.json";

export const Route = createFileRoute("/delad/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Delad nyttokalkyl – Kungsbacka kommun" },
      { name: "description", content: "En nyttokalkyl som delats med dig för läsning." },
      { property: "og:title", content: "Delad nyttokalkyl – Kungsbacka kommun" },
      { property: "og:description", content: "Se en delad nyttokalkyl från Kungsbacka kommun." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedPage,
});

function StepContent({ id }: { id: number }) {
  if (id === 1) return <Step1 />;
  if (id === 2) return <CostSheetEditor scenario="today" />;
  if (id === 3) return <CostSheetEditor scenario="change" />;
  if (id === 4) return <Step4 />;
  if (id === 5) return <Step5 />;
  return <Step6 />;
}

function SharedPage() {
  const { token } = Route.useParams();
  const [result, setResult] = useState<{ title: string; state: AppState } | null | "loading">("loading");

  useEffect(() => {
    loadSharedCalculation(token).then(setResult).catch(() => setResult(null));
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <img src={kungsbackaVapen.url} alt="Kungsbacka kommuns vapen" className="h-12 w-auto" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold">Nyttokalkyl</h1>
            <p className="truncate text-xs text-muted-foreground">
              Kungsbacka kommun{result && result !== "loading" ? ` · ${result.title}` : ""}
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <Eye className="size-3.5" /> Endast läsning
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {result === "loading" ? (
          <p className="text-muted-foreground">Hämtar kalkylen…</p>
        ) : !result ? (
          <p className="text-muted-foreground">
            Länken fungerar inte. Kalkylen kan ha slutat delas eller tagits bort.
          </p>
        ) : (
          <NyttokalkylProvider initial={result.state}>
            <fieldset disabled className="min-w-0 space-y-10">
              {STEPS.map((step) => (
                <section key={step.id}>
                  <h2 className="mb-4 border-b border-border pb-2 font-display text-xl font-semibold">
                    {step.id}. {step.title}
                  </h2>
                  <StepContent id={step.id} />
                </section>
              ))}
            </fieldset>
          </NyttokalkylProvider>
        )}
      </main>
    </div>
  );
}
