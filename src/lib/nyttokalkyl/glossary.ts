export const GLOSSARY = {
  "Finansiell nettonytta": {
    description: "Pengar som faktiskt sparas eller kostar extra i budgeten. Räknas som kostnad idag minus kostnad vid förändring, i nuvärde. Positivt = förändringen sparar pengar. Negativt = förändringen kostar mer än nuläget. Bara verkliga budgetposter ingår: investeringar, drift, licenser och personal som faktiskt avvecklas.",
    example: "Exempel: −2,6 Mkr betyder att förändringen kostar 2,6 Mkr mer än nuläget under kalkylperioden.",
  },
  "Omfördelningsnytta": {
    description: "Värdet av personaltid som frigörs men används till annat. Personalen och lönerna finns kvar – det är ingen besparing i budget. Värdet räknas som frigjorda timmar × timkostnad inkl. PO.",
    example: "Exempel: lärare som lägger 10 % mindre tid på administration och mer tid på undervisning.",
  },
  "Ackumulerad finansiell nettonytta": {
    description: "Den finansiella nettonyttan summerad år för år. Visar hur mycket som totalt sparats (eller kostat) fram till och med respektive år. Det år värdet går från minus till noll eller plus är break-even – då har förändringen betalat sig.",
  },
  "Ackumulerad inkl. omfördelning": {
    description: "Samma som ackumulerad finansiell nettonytta, men med värdet av den omfördelade tiden inräknat. Visar förändringens totala värde för verksamheten och motsvarar 'Ja'-läget i Kungsbackas Excel-mall. Det påverkar inte budgeten – använd den finansiella nettonyttan för budgetbeslut.",
  },
  "Nettonytta inkl. omfördelning": {
    description: "Finansiell nettonytta + omfördelningsnytta i nuvärde. Visar det totala värdet för verksamheten, men bara den finansiella delen påverkar budgeten.",
  },
  "Break-even år": {
    description: "Första året då den ackumulerade finansiella nettonyttan är noll eller positiv. 'Uppnås ej inom kalkylperioden' betyder att förändringen inte betalar sig finansiellt inom perioden – värdet kan ändå ligga i omfördelade och kvalitativa nyttor.",
  },
  "Nuvärde": {
    description: "Framtida belopp omräknade till basårets värde med diskonteringsräntan, så att pengar olika år kan jämföras.",
  },
  "Intervall (Sämsta/Bästa)": {
    description: "Utfallet om kostnaderna hamnar i ytterkanten av den angivna felmarginalen. Felmarginalen avser bara det som skiljer alternativen åt.",
  },
} satisfies Record<string, { description: string; example?: string }>;

export type GlossaryTerm = keyof typeof GLOSSARY;

export function glossaryText(term: GlossaryTerm) {
  const entry = GLOSSARY[term];
  return [term, entry.description, "example" in entry ? entry.example : undefined].filter(Boolean).join("\n\n");
}