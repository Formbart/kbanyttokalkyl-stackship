import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getSessionInfo } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nyttokalkyl – Kungsbacka kommun" },
      {
        name: "description",
        content:
          "Kungsbacka kommuns verktyg för nyttokalkyler: beräkna nytta, kostnader och uppföljning av förändringsprojekt.",
      },
      { property: "og:title", content: "Nyttokalkyl – Kungsbacka kommun" },
      {
        property: "og:description",
        content: "Logga in för att arbeta med dina nyttokalkyler.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    void getSessionInfo()
      .then((info) => navigate({ to: info.user ? "/kalkyl" : "/auth", replace: true }))
      .catch(() => navigate({ to: "/auth", replace: true }));
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Laddar…</p>
    </div>
  );
}
