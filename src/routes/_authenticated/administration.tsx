import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useSession } from "@/hooks/useSession";
import { usePositions } from "@/hooks/usePositions";
import { clearPositions, replacePositions } from "@/lib/positions.functions";
import {
  downloadPositionsTemplate,
  parsePositionsFile,
} from "@/lib/nyttokalkyl/positionsExcel";
import { formatKr } from "@/lib/nyttokalkyl/calc";
import { FORVALTNINGAR } from "@/lib/nyttokalkyl/types";

export const Route = createFileRoute("/_authenticated/administration")({
  head: () => ({
    meta: [
      { title: "Administration – befattningar i Nyttokalkyl" },
      {
        name: "description",
        content:
          "Administrera förvaltningarnas befattningar och månadslöner som används i Kungsbacka kommuns nyttokalkyl.",
      },
      {
        property: "og:title",
        content: "Administration – befattningar i Nyttokalkyl",
      },
      {
        property: "og:description",
        content:
          "Importera och underhåll befattningslistor per förvaltning för nyttokalkylen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdministrationPage,
});

function AdministrationPage() {
  const { isAdmin, loading } = useSession();
  const { personalData, reload } = usePositions();
  const [forvaltning, setForvaltning] = useState(FORVALTNINGAR[0]!);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!loading && isAdmin) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Laddar…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Endast för administratörer
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ditt konto har inte behörighet till Administration.
          </p>
          <Button asChild className="mt-5">
            <Link to="/kalkyl">Till kalkylen</Link>
          </Button>
        </div>
      </div>
    );
  }

  const positions = personalData[forvaltning] ?? [];

  const onImport = async (file: File) => {
    setBusy(true);
    try {
      const parsed = await parsePositionsFile(file);
      const result = await replacePositions({
        data: { forvaltning, positions: parsed },
      });
      await reload();
      toast.success(
        `${result.count} befattningar importerade till ${forvaltning}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Importen misslyckades. Inget sparades.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onClear = async () => {
    setBusy(true);
    try {
      await clearPositions({ data: { forvaltning } });
      await reload();
      toast.success(`Listan för ${forvaltning} är tömd.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunde inte tömma listan.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/kalkyl">
            <ArrowLeft className="size-4" />
            Till kalkylen
          </Link>
        </Button>
        <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">
          Administration
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Underhåll förvaltningarnas befattningar och månadslöner. Listorna är
          gemensamma och används av alla som gör nyttokalkyler.
        </p>

        <Tabs defaultValue="positions" className="mt-6">
          <TabsList>
            <TabsTrigger value="positions">Befattningar</TabsTrigger>
          </TabsList>
          <TabsContent value="positions" className="mt-5 space-y-5">
            <div className="surface-card p-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                  <p className="mb-1.5 text-sm font-medium">Förvaltning</p>
                  <Select
                    value={forvaltning}
                    onValueChange={(v) => setForvaltning(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORVALTNINGAR.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="secondary">
                  {positions.length} befattningar
                </Badge>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onImport(file);
                  }}
                />
                <Button
                  className="gap-2"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Importera Excel
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void downloadPositionsTemplate()}
                >
                  <Download className="size-4" />
                  Ladda ner mall
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="gap-2 text-negative"
                      disabled={busy || positions.length === 0}
                    >
                      <Trash2 className="size-4" />
                      Rensa lista
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tömma listan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Alla {positions.length} befattningar för {forvaltning}{" "}
                        tas bort. Befintliga kalkyler behåller de siffror som
                        redan är ifyllda.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Avbryt</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void onClear()}>
                        Töm listan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                En ny import <strong>ersätter hela listan</strong> för den valda
                förvaltningen — rader läggs inte till. Rubrikraden får ligga
                längre ner i filen (BI-exporter har ofta en filtertext först).
                Kolumnen &quot;Gemensamma mätvärden&quot; läses som månadslön
                exkl. PO.
              </p>
            </div>

            <div className="surface-card overflow-x-auto p-5">
              {positions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Inga befattningar importerade för {forvaltning} ännu.
                </p>
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-3">Befattning</th>
                      <th className="pb-2 pr-3">AID</th>
                      <th className="pb-2 pr-3">Månadslön exkl. PO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-2 pr-3">{p.befattning}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {p.aid || "—"}
                        </td>
                        <td className="py-2 pr-3">{formatKr(p.manadslon)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </div>
  );
}
