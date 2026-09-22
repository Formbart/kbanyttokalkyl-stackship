import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Mail, RefreshCw, Trash2, UserPlus } from "lucide-react";
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
import { useSession } from "@/hooks/useSession";
import {
  createAppUser,
  deleteAppUser,
  listAppUsers,
  resetAppUserPassword,
  sendCredentials,
  type AppUserRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Användare – Nyttokalkyl administration" },
      {
        name: "description",
        content:
          "Administrera användare i Kungsbacka kommuns nyttokalkyl: skapa konton, skicka inloggningsuppgifter och radera konton.",
      },
      { property: "og:title", content: "Användare – Nyttokalkyl administration" },
      { property: "og:description", content: "Skapa och hantera användarkonton." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

interface NewCredentials {
  email: string;
  password: string;
  fullName?: string | undefined;
  event: "account_created" | "password_reset";
}

function AdminPage() {
  const { isAdmin, loading } = useSession();
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<NewCredentials | null>(null);

  const refresh = async () => {
    try {
      setUsers(await listAppUsers());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte hämta användare.");
    }
  };

  useEffect(() => {
    if (!loading && isAdmin) void refresh();
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
            Ditt konto har inte behörighet till användarhanteringen.
          </p>
          <Button asChild className="mt-5">
            <Link to="/kalkyl">Till kalkylen</Link>
          </Button>
        </div>
      </div>
    );
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await createAppUser({ data: { email, fullName } });
      setCreds({
        email: result.email,
        password: result.password,
        fullName,
        event: "account_created",
      });
      setEmail("");
      setFullName("");
      await refresh();
      toast.success("Användaren är skapad med ett automatiskt lösenord.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte skapa användaren.");
    } finally {
      setBusy(false);
    }
  };

  const onSend = async (c: NewCredentials) => {
    try {
      const res = await sendCredentials({ data: c });
      if (res.sent) toast.success(`Inloggningsuppgifterna skickades till ${c.email}.`);
      else if (res.reason === "missing_webhook")
        toast.error("Utskick är inte kopplat ännu — kopiera uppgifterna och skicka dem själv.");
      else toast.error("Utskicket misslyckades. Kopiera uppgifterna och skicka dem själv.");
    } catch {
      toast.error("Utskicket misslyckades.");
    }
  };

  const onReset = async (user: AppUserRow) => {
    try {
      const result = await resetAppUserPassword({ data: { userId: user.id } });
      setCreds({
        email: result.email,
        password: result.password,
        fullName: user.fullName ?? undefined,
        event: "password_reset",
      });
      toast.success("Ett nytt lösenord är genererat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte byta lösenord.");
    }
  };

  const onDelete = async (user: AppUserRow) => {
    try {
      await deleteAppUser({ data: { userId: user.id } });
      await refresh();
      toast.success("Kontot och all kopplad data är raderad.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte radera kontot.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Användare</h1>
            <p className="text-sm text-muted-foreground">
              Skapa konton, skicka inloggningsuppgifter och radera konton.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/kalkyl">
              <ArrowLeft className="size-4" />
              Till kalkylen
            </Link>
          </Button>
        </div>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">Ny användare</h2>
          <form
            onSubmit={(e) => void onCreate(e)}
            className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="newEmail">E-postadress</Label>
              <Input
                id="newEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newName">Namn (valfritt)</Label>
              <Input
                id="newName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <Button type="submit" className="gap-2" disabled={busy}>
              <UserPlus className="size-4" />
              Skapa konto
            </Button>
          </form>

          {creds && (
            <div className="mt-5 rounded-lg border border-brand/40 bg-muted p-4">
              <p className="text-sm font-semibold text-foreground">Inloggningsuppgifter</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">E-post:</dt>
                  <dd className="font-medium">{creds.email}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Lösenord:</dt>
                  <dd className="font-mono font-medium">{creds.password}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `E-post: ${creds.email}\nLösenord: ${creds.password}`,
                    );
                    toast.success("Uppgifterna är kopierade.");
                  }}
                >
                  <Copy className="size-4" />
                  Kopiera
                </Button>
                <Button size="sm" className="gap-2" onClick={() => void onSend(creds)}>
                  <Mail className="size-4" />
                  Skicka kontouppgifter
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreds(null)}>
                  Stäng
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Lösenordet visas bara en gång. Användaren kan byta det under Mitt konto.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">Alla konton</h2>
          <div className="mt-4 divide-y divide-border">
            {users.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Inga konton ännu.</p>
            )}
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user.fullName || user.email}
                    {user.isAdmin && (
                      <span className="ml-2 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">
                        Administratör
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => void onReset(user)}
                  >
                    <RefreshCw className="size-4" />
                    Nytt lösenord
                  </Button>
                  {!user.isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="gap-2 text-negative">
                          <Trash2 className="size-4" />
                          Radera
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Radera {user.email}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Kontot och alla nyttokalkyler som hör till användaren raderas
                            permanent.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void onDelete(user)}>
                            Radera konto
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <Toaster />
    </div>
  );
}
