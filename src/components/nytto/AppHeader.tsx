import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Printer,
  Save,
  Shield,
  Trash2,
  Upload,
  User,
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
import {
  deleteCalculation,
  listSavedCalculations,
  loadCalculation,
  saveCalculation,
  type SavedCalculation,
} from "@/lib/nyttokalkyl/saved";
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
}: {
  printSelection: PrintStep[];
  onPrintSelectionChange: (steps: PrintStep[]) => void;
}) {
  const { state, setState, reset } = useNyttokalkyl();
  const navigate = useNavigate();
  const { user, isAdmin } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saved, setSaved] = useState<SavedCalculation[]>([]);
  const [title, setTitle] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [savingBusy, setSavingBusy] = useState(false);

  useEffect(() => {
    if (!savedOpen) return;
    void listSavedCalculations()
      .then(setSaved)
      .catch(() => toast.error("Kunde inte hämta dina sparade kalkyler."));
  }, [savedOpen]);

  useEffect(() => {
    if (!title && state.project.name) setTitle(state.project.name);
  }, [state.project.name, title]);

  const onSave = async () => {
    const name = title.trim() || state.project.name.trim();
    if (!name) {
      toast.error("Ge kalkylen ett namn innan du sparar.");
      return;
    }
    setSavingBusy(true);
    try {
      const id = await saveCalculation(state, name, currentId);
      setCurrentId(id);
      setSaved(await listSavedCalculations());
      toast.success("Kalkylen är sparad.");
    } catch {
      toast.error("Kalkylen kunde inte sparas.");
    } finally {
      setSavingBusy(false);
    }
  };

  const onLoad = async (id: string) => {
    try {
      const result = await loadCalculation(id);
      setState(result.state);
      setCurrentId(id);
      setTitle(result.title);
      setSavedOpen(false);
      toast.success(`"${result.title}" är öppnad.`);
    } catch {
      toast.error("Kalkylen kunde inte öppnas.");
    }
  };

  const onDeleteSaved = async (id: string) => {
    try {
      await deleteCalculation(id);
      if (currentId === id) setCurrentId(null);
      setSaved(await listSavedCalculations());
      toast.success("Kalkylen är raderad.");
    } catch {
      toast.error("Kalkylen kunde inte raderas.");
    }
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
      setState({
        project: { ...base.project, ...parsed.project },
        costToday: { ...base.costToday, ...parsed.costToday },
        costChange: { ...base.costChange, ...parsed.costChange },
        qualRatings: parsed.qualRatings ?? {},
        reallocationInGraph: parsed.reallocationInGraph ?? false,
        followUp: parsed.followUp ?? {},
        surveys: parsed.surveys ?? {},

      });
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
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold leading-tight text-foreground">
              Nyttokalkyl
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Kungsbacka kommun
              {state.project.name ? ` · ${state.project.name}` : ""}
            </p>
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
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={savingBusy}
            onClick={() => void onSave()}
          >
            <Save className="size-4" />
            <span className="hidden sm:inline">Spara</span>
          </Button>
          <Dialog open={savedOpen} onOpenChange={setSavedOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FolderOpen className="size-4" />
                <span className="hidden sm:inline">Mina kalkyler</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Mina kalkyler</DialogTitle>
                <DialogDescription>
                  Spara den pågående kalkylen eller återuppta en tidigare.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="calcTitle">Namn på kalkylen</Label>
                <div className="flex gap-2">
                  <Input
                    id="calcTitle"
                    value={title}
                    placeholder="T.ex. Digital signering hemtjänst"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <Button disabled={savingBusy} onClick={() => void onSave()}>
                    Spara
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {saved.length === 0 && (
                  <p className="py-3 text-sm text-muted-foreground">
                    Du har inga sparade kalkyler ännu.
                  </p>
                )}
                {saved.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Uppdaterad {new Date(item.updated_at).toLocaleString("sv-SE")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void onLoad(item.id)}>
                        Öppna
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-negative"
                        onClick={() => void onDeleteSaved(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          {isAdmin && (
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/admin">
                <Shield className="size-4" />
                <span className="hidden lg:inline">Användare</span>
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/konto">
              <User className="size-4" />
              <span className="hidden lg:inline">{user?.email ?? "Mitt konto"}</span>
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
        </div>
      </div>
    </header>
  );
}
