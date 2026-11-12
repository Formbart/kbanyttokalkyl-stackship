import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
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
import { changePassword as changePasswordFn, signOut } from "@/lib/auth.functions";
import { deleteOwnAccount } from "@/lib/account.functions";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/konto")({
  head: () => ({
    meta: [
      { title: "Mitt konto – Nyttokalkyl" },
      {
        name: "description",
        content: "Byt lösenord eller radera ditt konto i Kungsbacka kommuns nyttokalkyl.",
      },
      { property: "og:title", content: "Mitt konto – Nyttokalkyl" },
      { property: "og:description", content: "Hantera ditt konto och ditt lösenord." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: KontoPage,
});

function KontoPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Det nya lösenordet måste vara minst 8 tecken.");
      return;
    }
    if (next !== repeat) {
      toast.error("Lösenorden matchar inte.");
      return;
    }
    setBusy(true);
    try {
      await changePasswordFn({ data: { currentPassword: current, newPassword: next } });
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Lösenordet kunde inte bytas.");
      return;
    }
    setBusy(false);
    setCurrent("");
    setNext("");
    setRepeat("");
    toast.success("Lösenordet är uppdaterat.");
  };

  const removeAccount = async () => {
    try {
      await deleteOwnAccount();
      await signOut().catch(() => undefined);
      void navigate({ to: "/auth", replace: true });
    } catch {
      toast.error("Kontot kunde inte raderas. Försök igen.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Mitt konto</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/kalkyl">
              <ArrowLeft className="size-4" />
              Till kalkylen
            </Link>
          </Button>
        </div>

        {isAdmin && (
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            Du är administratör.{" "}
            <Link to="/admin" className="font-medium text-brand underline">
              Hantera användare
            </Link>
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">Byt lösenord</h2>
          <form onSubmit={(e) => void changePassword(e)} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current">Nuvarande lösenord</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next">Nytt lösenord</Label>
              <Input
                id="next"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="repeat">Upprepa nytt lösenord</Label>
              <Input
                id="repeat"
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Sparar…" : "Spara nytt lösenord"}
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-negative/40 bg-card p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">Radera konto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kontot och alla sparade nyttokalkyler tas bort permanent.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="mt-4 text-negative">
                Radera mitt konto
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Radera kontot permanent?</AlertDialogTitle>
                <AlertDialogDescription>
                  Alla dina sparade nyttokalkyler raderas och går inte att återskapa.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Avbryt</AlertDialogCancel>
                <AlertDialogAction onClick={() => void removeAccount()}>
                  Radera konto
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
      <Toaster />
    </div>
  );
}
