import { useEffect, useState } from "react";
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
  Plus,
  Printer,
  Save,
  Settings,
  Shield,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { initialState } from "@/lib/nyttokalkyl/types";
import { Checkbox } from "@/components/ui/checkbox";
import { STEPS } from "./StepNav";
import type { PrintStep } from "./PrintView";
import { exportNyttokalkylToExcel } from "@/lib/nyttokalkyl/exportExcel";
import { signOut } from "@/lib/auth.functions";
import { useSession } from "@/hooks/useSession";
import { saveCalculation } from "@/lib/nyttokalkyl/saved";
import { GLOSSARY } from "@/lib/nyttokalkyl/glossary";
import kungsbackaVapen from "@/assets/kungsbacka-kommunvapen.png.asset.json";


const BENEFIT_GLOSSARY: { term: string; def: string }[] = [
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
  hasUnsavedChanges,
  onSaved,
}: {
  printSelection: PrintStep[];
  onPrintSelectionChange: (steps: PrintStep[]) => void;
  currentId: string | null;
  onCurrentIdChange: (id: string | null) => void;
  calculationTitle: string;
  onCalculationTitleChange: (title: string) => void;
  hasUnsavedChanges: boolean;
  onSaved: () => void;
}) {
  const { state, setState, reset } = useNyttokalkyl();
  const navigate = useNavigate();
  const { user, fullName, isAdmin, isSuperAdmin } = useSession();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [newCalculationOpen, setNewCalculationOpen] = useState(false);
  const [newCalculationName, setNewCalculationName] = useState("");
  const [savingBusy, setSavingBusy] = useState(false);

  useEffect(() => {
    if (!calculationTitle && state.project.name) onCalculationTitleChange(state.project.name);
  }, [calculationTitle, onCalculationTitleChange, state.project.name]);

  const displayName = fullName?.trim() || user?.email || "";
  const activeTitle = state.project.name.trim() || calculationTitle.trim();

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
      onSaved();
      toast.success("Kalkylen är sparad.");
    } catch {
      toast.error("Kalkylen kunde inte sparas.");
    } finally {
      setSavingBusy(false);
    }
  };

  const onNewCalculation = () => {
    const name = newCalculationName.trim();
    if (!name) {
      toast.error("Skriv ett namn på kalkylen.");
      return;
    }
    const nextState = initialState();
    nextState.project.name = name;
    reset();
    setState(nextState);
    onCurrentIdChange(null);
    onCalculationTitleChange(name);
    setNewCalculationOpen(false);
    setNewCalculationName("");
    void navigate({ to: "/kalkyl" });
    toast.success("Ny kalkyl är skapad.");
  };

  const onSignOut = async () => {
    await signOut().catch(() => undefined);
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
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img
            src={kungsbackaVapen.url}
            alt="Kungsbacka kommuns vapen"
            className="h-12 w-auto shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold leading-tight text-foreground">
              Nyttokalkyl
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Kungsbacka kommun
              {activeTitle ? ` · ${activeTitle}` : ""}
            </p>
          </div>
          <nav className="no-print ml-auto flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-1" aria-label="Användarmeny">
            {isAdmin && (
              <>
                <Button asChild variant="ghost" size="sm" className="gap-2 px-2 lg:px-3">
                  <Link to="/administration">
                    <SlidersHorizontal className="size-4" />
                    <span className="hidden lg:inline">Administration</span>
                  </Link>
                </Button>
                {isSuperAdmin && (
                  <Button asChild variant="ghost" size="sm" className="gap-2 px-2 lg:px-3">
                    <Link to="/admin">
                      <Shield className="size-4" />
                      <span className="hidden lg:inline">Användare</span>
                    </Link>
                  </Button>
                )}
              </>
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="gap-2 px-2 lg:px-3"
              aria-label="Mitt konto och lösenord"
            >
              <Link to="/konto">
                <Settings className="size-4" />
                <span className="hidden lg:inline">Mitt konto</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 px-2 lg:px-3"
              onClick={() => void onSignOut()}
            >
              <LogOut className="size-4" />
              <span className="hidden lg:inline">Logga ut</span>
            </Button>
            {displayName && (
              <span className="max-w-20 truncate pl-1 text-xs font-medium text-foreground sm:max-w-40 sm:text-sm xl:max-w-56">
                {displayName}
              </span>
            )}
          </nav>
        </div>

        <div className="no-print mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={newCalculationOpen} onOpenChange={setNewCalculationOpen}>
              <DialogTrigger asChild>
                <Button type="button" size="sm" className="gap-2" onClick={() => setNewCalculationName("")}>
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Ny kalkyl</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Skapa ny kalkyl</DialogTitle>
                  <DialogDescription>Ge kalkylen ett namn innan du börjar.</DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onNewCalculation();
                  }}
                >
                  <Input
                    autoFocus
                    value={newCalculationName}
                    onChange={(event) => setNewCalculationName(event.target.value)}
                    placeholder="Namn på kalkylen"
                    aria-label="Namn på kalkylen"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setNewCalculationOpen(false)}>
                      Avbryt
                    </Button>
                    <Button type="submit" disabled={!newCalculationName.trim()}>
                      Skapa kalkyl
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Button
              variant={hasUnsavedChanges ? "destructive" : "outline"}
              size="sm"
              className="gap-2"
              disabled={savingBusy}
              onClick={() => void onSave()}
              aria-label={hasUnsavedChanges ? "Spara osparade ändringar" : "Spara"}
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
          </div>

          <div className="hidden h-7 w-px bg-border sm:block" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void onExport()}>

            <Download className="size-4" />
            <span className="hidden sm:inline">Exportera Excel</span>
          </Button>
          </div>

          <div className="hidden h-7 w-px bg-border sm:block" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
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
            <Dialog open={glossaryOpen} onOpenChange={setGlossaryOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <HelpCircle className="size-4" />
                  <span className="hidden sm:inline">Hjälp</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Glosbok</DialogTitle>
                  <DialogDescription>Begrepp som används i nyttokalkylen.</DialogDescription>
                </DialogHeader>
                <dl className="space-y-4">
                  {Object.entries(GLOSSARY).map(([term, entry]) => <div key={term}><dt className="text-sm font-semibold text-foreground">{term}</dt><dd className="text-sm text-muted-foreground">{entry.description}{"example" in entry && <p className="mt-1 italic">{entry.example}</p>}</dd></div>)}
                  {BENEFIT_GLOSSARY.map((g) => (
                    <div key={g.term}>
                      <dt className="text-sm font-semibold text-foreground">{g.term}</dt>
                      <dd className="text-sm text-muted-foreground">{g.def}</dd>
                    </div>
                  ))}
                </dl>
              </DialogContent>
            </Dialog>
          </div>

        </div>
      </div>
    </header>
  );
}
