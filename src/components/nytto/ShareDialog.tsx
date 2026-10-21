import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
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
import { getShareToken, stopSharing } from "@/lib/nyttokalkyl/saved";

export function ShareDialog({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const onOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next) return;
    setBusy(true);
    try {
      const token = await getShareToken(id);
      setUrl(`${window.location.origin}/delad/${token}`);
    } catch {
      toast.error("Delningslänken kunde inte skapas.");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Länken är kopierad.");
  };

  const stop = async () => {
    try {
      await stopSharing(id);
      toast.success("Delningen är avslutad. Den gamla länken fungerar inte längre.");
      setOpen(false);
    } catch {
      toast.error("Delningen kunde inte avslutas.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => void onOpenChange(v)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dela "{title}"</DialogTitle>
          <DialogDescription>
            Alla som har länken kan se kalkylen utan att logga in, men inte ändra den. Senast sparade
            version visas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={busy ? "Skapar länk…" : url} aria-label="Delningslänk" />
          <Button type="button" className="gap-2" disabled={busy || !url} onClick={() => void copy()}>
            <Copy className="size-4" /> Kopiera
          </Button>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" className="text-negative" disabled={busy} onClick={() => void stop()}>
            Sluta dela
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
