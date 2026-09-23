import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteCalculation,
  listSavedCalculations,
  loadCalculation,
  PENDING_CALCULATION_STORAGE_KEY,
  renameCalculation,
  type SavedCalculation,
} from "@/lib/nyttokalkyl/saved";

export const Route = createFileRoute("/_authenticated/kalkyler")({
  head: () => ({
    meta: [
      { title: "Mina kalkyler – Nyttokalkyl" },
      {
        name: "description",
        content: "Öppna och hantera dina sparade nyttokalkyler för Kungsbacka kommun.",
      },
      { property: "og:title", content: "Mina kalkyler – Nyttokalkyl" },
      { property: "og:description", content: "Öppna och hantera sparade nyttokalkyler." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SavedCalculationsPage,
});

function SavedCalculationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<SavedCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<SavedCalculation | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  const refresh = async () => {
    try {
      setItems(await listSavedCalculations());
    } catch {
      toast.error("Kunde inte hämta dina sparade kalkyler.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const openCalculation = async (id: string) => {
    setBusyId(id);
    try {
      const result = await loadCalculation(id);
      window.sessionStorage.setItem(
        PENDING_CALCULATION_STORAGE_KEY,
        JSON.stringify({ id, title: result.title, state: result.state }),
      );
      void navigate({ to: "/kalkyl" });
    } catch {
      toast.error("Kalkylen kunde inte öppnas.");
      setBusyId(null);
    }
  };

  const removeCalculation = async (id: string) => {
    setBusyId(id);
    try {
      await deleteCalculation(id);
      setItems((current) => current.filter((item) => item.id !== id));
      toast.success("Kalkylen är raderad.");
    } catch {
      toast.error("Kalkylen kunde inte raderas.");
    } finally {
      setBusyId(null);
    }
  };

  const openRename = (item: SavedCalculation) => {
    setRenameTarget(item);
    setTitleDraft(item.title);
  };

  const saveRename = async () => {
    const name = titleDraft.trim();
    if (!renameTarget || !name) {
      toast.error("Skriv en rubrik först.");
      return;
    }
    setBusyId(renameTarget.id);
    try {
      await renameCalculation(renameTarget.id, name);
      setItems((current) =>
        current.map((item) =>
          item.id === renameTarget.id
            ? { ...item, title: name, updated_at: new Date().toISOString() }
            : item,
        ),
      );
      setRenameTarget(null);
      toast.success("Rubriken är ändrad.");
    } catch {
      toast.error("Rubriken kunde inte ändras.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/95">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Nyttokalkyl</p>
            <h1 className="font-display text-2xl font-semibold text-foreground">Mina kalkyler</h1>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/kalkyl">
              <ArrowLeft className="size-4" />
              Till kalkylen
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Laddar sparade kalkyler…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <FolderOpen className="mx-auto size-10 text-muted-foreground" />
            <h2 className="mt-4 font-display text-xl font-semibold text-foreground">
              Inga sparade kalkyler ännu
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Skapa en ny kalkyl med plusknappen i kalkylens toppmeny.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">{item.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Uppdaterad {new Date(item.updated_at).toLocaleString("sv-SE")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Ändra rubrik för ${item.title}`}
                    disabled={busyId === item.id}
                    onClick={() => openRename(item)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === item.id}
                    onClick={() => void openCalculation(item.id)}
                  >
                    Öppna
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-negative"
                    aria-label={`Radera ${item.title}`}
                    disabled={busyId === item.id}
                    onClick={() => void removeCalculation(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ändra rubrik</DialogTitle>
            <DialogDescription>
              Rubriken visas i Mina kalkyler och används när du öppnar kalkylen.
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
                onClick={() => setRenameTarget(null)}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                disabled={busyId === renameTarget?.id}
                onClick={() => void saveRename()}
              >
                Spara rubrik
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}