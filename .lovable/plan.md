# Osparade ändringar på Spara-knappen

## Mål
Göra det tydligt när en öppnad kalkyl har ändringar som ännu inte sparats.

## Genomförande
- Spara en intern jämförelsepunkt när en befintlig kalkyl öppnas eller sparas.
- Jämför den aktuella kalkylen med den senast sparade versionen.
- Visa Spara-knappen i rött när innehållet skiljer sig från den sparade versionen.
- Återställ knappens vanliga färg direkt efter en lyckad sparning.
- Behåll befintliga funktioner för nya och importerade kalkyler oförändrade.

## Kontroll
- Öppna en sparad kalkyl och bekräfta att knappen först har normal färg.
- Ändra ett fält och bekräfta att knappen blir röd.
- Spara och bekräfta att knappen återgår till normal färg.
