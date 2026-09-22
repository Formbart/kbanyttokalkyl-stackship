# Valbar utskrift av hela nyttokalkylen

## Mål
Göra utskriftsknappen till ett val där användaren markerar vilka av kalkylens sex delar som ska skrivas ut. Utskriften ska samla valda delar, oavsett vilken del som visas på skärmen, och undvika att rubriker, texter, tabellrader och kort delas olämpligt mellan sidor.

## Genomförande
- Ersätt direktutskriften i sidhuvudet med en dialog som listar kalkylens sex delar med kryssrutor, snabbval för alla/inga och en tydlig utskriftsknapp.
- Lägg till en separat utskriftsvy som återanvänder kalkylens befintliga delar och endast visas vid utskrift.
- Behåll den vanliga arbetsvyn oförändrad på skärmen och dölj menyer, navigering, knappar och AI-reglage i utskriften.
- Lägg till utskriftsformat för A4 med konsekventa marginaler, sidrubriker och sidbrytning före varje vald huvuddel.
- Förhindra sidbrytningar mitt i kort, enskilda nyttor, personal-/kostnadsposter, tabellrader, diagram och sammanhängande textblock där webbläsaren tillåter det.
- Kontrollera att valen styr exakt vilka delar som syns i utskriftsläget och att den vanliga sidan fortfarande fungerar.

## Tekniska detaljer
- Utskriftsvalet hålls lokalt i gränssnittet och ändrar inte kalkylens data.
- Alla sex delar renderas samtidigt endast i ett utskriftslager; den interaktiva vyn fortsätter visa ett steg i taget.
- Utskriften startas först när den valda vyn har renderats, så att diagram och innehåll kommer med.
