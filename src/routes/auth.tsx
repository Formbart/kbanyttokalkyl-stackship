import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import loginBg from "@/assets/hermerin-login-bg.jpg.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logga in – Nyttokalkyl Kungsbacka kommun" },
      {
        name: "description",
        content:
          "Logga in för att arbeta med dina nyttokalkyler. Konton skapas av administratören i Kungsbacka kommun.",
      },
      { property: "og:title", content: "Logga in – Nyttokalkyl" },
      {
        property: "og:description",
        content: "Inloggning till Kungsbacka kommuns verktyg för nyttokalkyler.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/kalkyl", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError("Fel e-postadress eller lösenord.");
      return;
    }
    void navigate({ to: "/kalkyl", replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <img
        src={loginBg.url}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-primary-foreground">
            KB
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground">Nyttokalkyl</h1>
            <p className="text-xs text-muted-foreground">Kungsbacka kommun</p>
          </div>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-postadress</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Lösenord</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Loggar in…" : "Logga in"}
          </Button>
        </form>

        <p className="mt-5 text-xs text-muted-foreground">
          Konton skapas av administratören. Har du inget konto — kontakta din administratör för
          att få inloggningsuppgifter.
        </p>
      </div>
    </div>
  );
}
