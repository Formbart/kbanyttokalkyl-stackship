import { createFileRoute } from "@tanstack/react-router";
import { NyttokalkylApp } from "@/components/nytto/NyttokalkylApp";

export const Route = createFileRoute("/_authenticated/kalkyl")({
  head: () => ({
    meta: [
      { title: "Nyttokalkyl – räkna på nyttan av förändringsprojekt" },
      {
        name: "description",
        content:
          "Nyttokalkyl för Kungsbacka kommun: räkna på finansiell nytta, omfördelning, kvalitativa nyttor och miljönytta i sex steg — med AI-stöd.",
      },
      { property: "og:title", content: "Nyttokalkyl – Kungsbacka kommun" },
      {
        property: "og:description",
        content:
          "Digitalt verktyg i sex steg för att beräkna nytta, kostnader, break-even och uppföljning av förändringsprojekt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NyttokalkylApp,
});
