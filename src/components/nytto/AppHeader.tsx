import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Download, HelpCircle, Printer, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useNyttokalkyl } from "@/lib/nyttokalkyl/store";
import { initialState, type AppState } from "@/lib/nyttokalkyl/types";

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

export function AppHeader() {
  const { state, setState, reset } = useNyttokalkyl();
  const fileRef = useRef<HTMLInputElement>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const onExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nyttokalkyl-${state.project.name || "utkast"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Kalkylen exporterades som JSON.");
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
      });
      toast.success("Kalkylen importerades.");
    } catch {
      toast.error("Kunde inte läsa filen. Är det en giltig JSON-export?");
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-primary-foreground">
          KB
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold leading-tight text-foreground">
            Nyttokalkyl
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            Kungsbacka kommun
            {state.project.name ? ` · ${state.project.name}` : ""}
          </p>
        </div>

        <div className="no-print flex items-center gap-2">
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

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            <span className="hidden sm:inline">Skriv ut</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={onExport}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Exportera</span>
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
