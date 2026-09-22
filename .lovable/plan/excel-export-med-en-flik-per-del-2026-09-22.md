# Excel-export med en flik per del

## Mål
Exportknappen ska ladda ner en riktig `.xlsx`-fil. Arbetsboken får sex tydligt namngivna flikar, en för varje del i nyttokalkylen.

## Det som byggs
- Ersätt nuvarande JSON-export med Excel-export.
- Skapa flikarna **1 Grundinformation**, **2 Kostnad idag**, **3 Kostnad förändring**, **4 Kvalitativa nyttor**, **5 Resultat** och **6 Uppföljning**.
- Lägg projektuppgifter, nyttor, kostnadsposter, personal, kvalitativa bedömningar, årsresultat och uppföljningsplaner i tabellform.
- Behåll import av JSON oförändrad, så befintliga sparade kalkyler fortfarande kan läsas in.
- Ge arbetsboken tydliga rubriker, läsbara kolumnbredder, beloppsformat och procentformat.
- Använd formler där Excel ska räkna totalsummor, så filen fortsätter vara användbar om värden ändras efter export.

## Teknisk lösning
- Använd en webbläsarkompatibel XLSX-generator och håll all export lokalt i användarens webbläsare.
- Samla exportlogiken i en separat modul som omvandlar kalkylens befintliga data och beräkningar till arbetsbokens sex flikar.
- Filnamnet baseras på projektnamnet, med reservnamnet `nyttokalkyl-utkast.xlsx`.
- Verifiera att filen kan öppnas, innehåller sex flikar och inte har några formelfel.
