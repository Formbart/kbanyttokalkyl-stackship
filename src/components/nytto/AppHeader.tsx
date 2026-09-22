import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Download,
  FolderOpen,
  HelpCircle,
  LogOut,
  Pencil,
  Plus,
  Printer,
  Save,
  Settings,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { initialState, type AppState } from "@/lib/nyttokalkyl/types";
import { Checkbox } from "@/components/ui/checkbox";
import { STEPS } from "./StepNav";
import type { PrintStep } from "./PrintView";
import { exportNyttokalkylToExcel } from "@/lib/nyttokalkyl/exportExcel";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { saveCalculation } from "@/lib/nyttokalkyl/saved";
import kungsbackaVapen from "@/assets/kungsbacka-kommunvapen.png.asset.json";


const GLOSSARY: { term: string; def: string }[] = [
  {
    term: "Finansiell nytta 💰",
    def: "Nytta som ger en faktisk minskad kostnad eller ökad intäkt i budget — pengar som frigörs och kan användas till annat.",
  },
  {
    term: "Omfördelningsnytta ↺",
    def: "Frigjord arbetstid som inte tas ut som besparing, utan används till annat värdeskapande arbete.",
  },
  {
    term: "Kvalitativ nytta 🖤",
    def: "Förbättring som är svår att sätta ett kronbelopp på, t.ex. ökad rättssäkerhet, bättre arbetsmiljö eller nöjdare invånare.",
  },
  {
    term: "Miljönytta ♻️",
    def: "Minskad klimat- eller miljöpåverkan, t.ex. färre resor, mindre papper eller lägre energianvändning.",
  },
  {
    term: "Nyttorealisering",
    def: "Arbetet med att säkerställa att de planerade nyttorna faktiskt uppstår — med ansvar, uppföljning och åtgärder.",
  },
  {
    term: "Effektmål",
    def: "Mätbart mål för den effekt förändringen ska ge, formulerat så att det går att följa upp.",
  },
  {
    term: "Intressenter",
    def: "De som påverkas av eller kan påverka förändringen: invånare, medarbetare, chefer, andra förvaltningar eller externa parter.",
  },
  {
    term: "Felmarginal",
    def: "Osäkerhet i en kostnadspost, angiven i procent. Används för att räkna fram bästa och sämsta scenario.",
  },
  {
    term: "Engångskostnad",
    def: "Kostnad som uppstår vid ett enda tillfälle, t.ex. inköp, införandeprojekt eller utbildningsinsats.",
  },
  {
    term: "Löpande driftkostnader",
    def: "Kostnad som återkommer varje år, t.ex. licenser, support eller underhåll.",
  },
];

export function AppHeader({
  printSelection,
  onPrintSelectionChange,
  currentId,
  onCurrentIdChange,
  calculationTitle,
  onCalculationTitleChange,
}: {
  printSelection: PrintStep[];
  onPrintSelectionChange: (steps: PrintStep[]) => void;
  currentId: string | null;
  onCurrentIdChange: (id: string | null) => void;
  calculationTitle: string;
  onCalculationTitleChange: (title: string) => void;
}) {
  const { state, setState, reset } = useNyttokalkyl();
  const navigate = useNavigate();
  const { user, fullName, isAdmin } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingBusy, setSavingBusy] = useState(false);

  useEffect(() => {
    if (!calculationTitle && state.project.name) onCalculationTitleChange(state.project.name);
  }, [calculationTitle, onCalculationTitleChange, state.project.name]);

  const displayName = fullName?.trim() || user?.email || "";
  const activeTitle = state.project.name.trim() || calculationTitle.trim();

  const openTitleDialog = () => {
    setTitleDraft(activeTitle);
    setTitleOpen(true);
  };

  const onSaveTitle = async () => {
    const name = titleDraft.trim();
    if (!name) {
      toast.error("Skriv en rubrik först.");
      return;
    }
    const nextState = {
      ...state,
      project: { ...state.project, name },
    };
    setState(nextState);
    onCalculationTitleChange(name);
    setTitleOpen(false);

    if (!currentId) {
      toast.success("Rubriken är ändrad.");
      return;
    }

    setSavingBusy(true);
    try {
      await saveCalculation(nextState, name, currentId);
      toast.success("Rubriken är ändrad och sparad.");
    } catch {
      toast.error("Rubriken ändrades här men kunde inte sparas.");
    } finally {
      setSavingBusy(false);
    }
  };

  const onSave = async () => {
    const name = state.project.name.trim() || calculationTitle.trim();
    if (!name) {
      toast.error("Ge kalkylen ett namn innan du sparar.");
      return;
    }
    setSavingBusy(true);
    try {
      const id = await saveCalculation(state, name, currentId);
      onCurrentIdChange(id);
      onCalculationTitleChange(name);
      toast.success("Kalkylen är sparad.");
    } catch {
      toast.error("Kalkylen kunde inte sparas.");
    } finally {
      setSavingBusy(false);
    }
  };

  const onNewCalculation = () => {
    reset();
    onCurrentIdChange(null);
    onCalculationTitleChange("");
    void navigate({ to: "/kalkyl" });
    toast.success("Ny kalkyl är skapad.");
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };


  const onExport = async () => {
    try {
      await exportNyttokalkylToExcel(state);
      toast.success("Kalkylen exporterades till Excel med sex flikar.");
    } catch {
      toast.error("Excel-filen kunde inte skapas. Försök igen.");
    }
  };

  const onImportFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<AppState>;
      const base = initialState();
      const importedName = parsed.project?.name?.trim() ?? "";
      setState({
        project: { ...base.project, ...parsed.project },
        costToday: { ...base.costToday, ...parsed.costToday },
        costChange: { ...base.costChange, ...parsed.costChange },
        qualRatings: parsed.qualRatings ?? {},
        reallocationInGraph: parsed.reallocationInGraph ?? false,
        followUp: parsed.followUp ?? {},
        surveys: parsed.surveys ?? {},

      });
      onCurrentIdChange(null);
      onCalculationTitleChange(importedName);
      toast.success("Kalkylen importerades.");
    } catch {
      toast.error("Kunde inte läsa filen. Är det en giltig JSON-export?");
    }
  };

  const togglePrintStep = (step: PrintStep, checked: boolean) => {
    onPrintSelectionChange(
      checked
        ? [...new Set([...printSelection, step])].sort((a, b) => a - b)
        : printSelection.filter((item) => item !== step),
    );
  };

  const onPrint = () => {
    if (printSelection.length === 0) return;
    setPrintOpen(false);
    window.setTimeout(() => window.print(), 150);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={kungsbackaVapen.url}
            alt="Kungsbacka kommuns vapen"
            className="h-12 w-auto shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold leading-tight text-foreground">
              Nyttokalkyl
            </h1>
            <div className="mt-0.5 flex min-w-0 items-center gap-2">
              <p className="truncate text-xs text-muted-foreground">
                Kungsbacka kommun
                {activeTitle ? ` · ${activeTitle}` : ""}
              </p>
              <Dialog open={titleOpen} onOpenChange={setTitleOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label="Ändra rubrik"
                    onClick={openTitleDialog}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Ändra rubrik</DialogTitle>
                    <DialogDescription>
                      Rubriken används i menyn, Mina kalkyler och vid sparning.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      placeholder="Namn på nyttokalkylen"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setTitleOpen(false)}
                      >
                        Avbryt
                      </Button>
                      <Button
                        type="button"
                        disabled={savingBusy}
                        onClick={() => void onSaveTitle()}
                      >
                        Spara rubrik
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="no-print mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Dialog open={glossaryOpen} onOpenChange={setGlossaryOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Glosbok och hjälp">
                <HelpCircle className="size-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Glosbok</DialogTitle>
                <DialogDescription>
                  Begrepp som används i nyttokalkylen.
                </DialogDescription>
              </DialogHeader>
              <dl className="space-y-4">
                {GLOSSARY.map((g) => (
                  <div key={g.term}>
                    <dt className="text-sm font-semibold text-foreground">
                      {g.term}
                    </dt>
                    <dd className="text-sm text-muted-foreground">{g.def}</dd>
                  </div>
                ))}
              </dl>
            </DialogContent>
          </Dialog>

          <Dialog open={printOpen} onOpenChange={setPrintOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Printer className="size-4" />
                <span className="hidden sm:inline">Skriv ut</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Välj delar att skriva ut</DialogTitle>
                <DialogDescription>
                  De valda delarna samlas i ett dokument med anpassade sidbrytningar.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 border-b border-border pb-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPrintSelectionChange(STEPS.map((step) => step.id))}
                >
                  Välj alla
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onPrintSelectionChange([])}
                >
                  Rensa val
                </Button>
              </div>
              <div className="space-y-2">
                {STEPS.map((step) => (
                  <label
                    key={step.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 hover:bg-muted"
                  >
                    <Checkbox
                      checked={printSelection.includes(step.id)}
                      onCheckedChange={(checked) =>
                        togglePrintStep(step.id, Boolean(checked))
                      }
                    />
                    <span className="text-sm font-medium">
                      {step.id}. {step.title}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  {printSelection.length === 0
                    ? "Välj minst en del."
                    : `${printSelection.length} av 6 delar valda`}
                </p>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={printSelection.length === 0}
                  onClick={onPrint}
                >
                  <Printer className="size-4" />
                  Öppna utskrift
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="default"
            size="icon"
            aria-label="Ny kalkyl"
            onClick={onNewCalculation}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={savingBusy}
            onClick={() => void onSave()}
          >
            <Save className="size-4" />
            <span className="hidden sm:inline">Spara</span>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/kalkyler">
                <FolderOpen className="size-4" />
                <span className="hidden sm:inline">Mina kalkyler</span>
            </Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/admin">
                <Shield className="size-4" />
                <span className="hidden lg:inline">Användare</span>
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void onExport()}>

            <Download className="size-4" />
            <span className="hidden sm:inline">Exportera Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">Importera</span>
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file);
              e.target.value = "";
            }}
          />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-negative">
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Rensa</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rensa hela kalkylen?</AlertDialogTitle>
                <AlertDialogDescription>
                  All ifylld information tas bort. Exportera först om du vill
                  spara arbetet.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    reset();
                    toast.success("Kalkylen är rensad.");
                  }}
                >
                  Rensa allt
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-2" aria-label="Mitt konto och lösenord">
              <Link to="/konto">
                <Settings className="size-4" />
                <span className="hidden lg:inline">Mitt konto</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => void onSignOut()}
            >
              <LogOut className="size-4" />
              <span className="hidden lg:inline">Logga ut</span>
            </Button>
            {displayName && (
              <span className="hidden max-w-56 truncate text-sm font-medium text-foreground xl:block">
                {displayName}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
