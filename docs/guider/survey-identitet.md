---
title: Survey-identitet og endringer
---

# Survey-identitet og endringer

Behold samme `surveyId` så lenge surveyen måler det samme på en sammenlignbar
måte. Bruk en ny ID når dere endrer strukturen i surveyen eller hva svarene
betyr.

## Hva identifiserer `surveyId`?

En `surveyId` identifiserer én sammenhengende analyseserie innenfor et team.
ID-en gjelder innenfor teamet, og apper i samme team bør bare bruke samme ID
når meningen er at de skal dele definisjon og analyse.

Lumi API lagrer surveydefinisjonen ved den første innsendingen. Senere
innsendinger med samme `surveyId` kontrolleres mot denne definisjonen. En
innsending med inkompatibel struktur får HTTP 409 og lagres ikke.

Velg derfor en stabil ID per survey og bruksmønster, for eksempel
`sykepenger-kvittering`. Ikke lag en ny ID for hver ny versjon av appen.

Dev og prod har hver sin Lumi API med hver sin database. Definisjonen lagres
derfor hver for seg i de to miljøene. Et svar som går gjennom i dev, viser ikke
at prod godtar den samme surveyen. Sammenlign den nye surveyen med versjonen
som samler inn svar i produksjon.

## Når dere kan beholde samme `surveyId`

Tabellen gjelder dagens widget, som sender hele surveydefinisjonen med
`schemaVersion: 2`. Kolonnen «I Surveyverksted» viser hva endringen tilsvarer
når surveyen redigeres der.

| Endring | I Surveyverksted | Samme `surveyId`? | Hva skjer? |
| :--- | :--- | :--- | :--- |
| Rette skrivefeil uten å endre betydningen | Rette teksten i et spørsmål eller svaralternativ | Ja | Lumi API godtar endringen. Gamle og nye svar kan fortsatt sammenlignes. |
| Endre hjelpetekst eller `description` | Endre **Hjelpetekst** | Ja | Teksten er ikke en del av den låste definisjonen. |
| Endre visuell styling eller layout | Endre **Felles overskrift på siden** eller fordele spørsmålene på sidene på en annen måte | Ja | Endringen påvirker ikke den analytiske strukturen. |
| Endre spørsmålstekst eller teksten til et svaralternativ uten å endre betydningen | Skrive om **Spørsmålstekst** eller teksten i et svaralternativ | Ja | Lumi API godtar endringen, men eldre svar beholder de gamle tekstene. Hold endringen liten. |
| Endre hva et spørsmål eller svaralternativ betyr | Skrive om teksten slik at spørsmålet eller svaret betyr noe annet | Nei | Lumi API kan godta en ren tekstendring, men analysen blander da svar på to ulike spørsmål. |
| Endre `required` eller `visibleIf` | Slå **Må besvares** av eller på, eller endre når et spørsmål vises | Ja, hvis trendene fortsatt kan sammenlignes | Lumi API godtar endringen, men den kan endre hvem som får eller svarer på spørsmålet. Bruk ny ID hvis trendene ikke lenger kan sammenlignes. |
| Endre rekkefølgen på spørsmål | **Flytt spørsmål opp**, **Flytt spørsmål ned** eller flytte en side | Ja | Lumi API godtar at spørsmålene bare bytter plass. Dashboardet utleder rekkefølgen fra innsendingene, så bruk ny ID hvis rekkefølgen har betydning for tolkningen. |
| Legge til eller fjerne et spørsmål | **Legg til spørsmål**, **Legg til oppfølgingsspørsmål**, **Slett spørsmål**, og i avansert redigering **Dupliser spørsmålet**, **Ny side** eller **Slett side** | Nei | Hele definisjonen sendes med hver innsending. Endringen gir 409. |
| Endre spørsmåls-ID | Kan ikke gjøres. Surveyverksted lager ID-en | Nei | Lumi API ser dette som ett fjernet og ett nytt felt og svarer med 409. |
| Endre spørsmålstype | Endre **Hvordan skal de svare?** | Nei | Endring av `fieldType` gir 409. |
| Endre `surveyType` | Kan ikke gjøres i et utkast. Typen følger valget under **Hva vil dere finne ut?** | Nei | Endringen gir 409. |
| Endre ratingvariant eller skala | Endre **Vurderingsskala** | Nei | Endring av `ratingVariant` eller `ratingScale` gir 409. |
| Legge til, fjerne, bytte eller flytte ID-er for svaralternativer | **Legg til svaralternativ**, **Slett alternativ**, **Flytt alternativ opp**, **Flytt alternativ ned** eller endre verdien til et alternativ i avansert redigering | Nei | Listen med `optionIds` er låst, også rekkefølgen, og endringen gir 409. |
| Legge til, endre eller fjerne grensen for hvor mange svar brukeren kan velge | Fylle inn, endre eller tømme **Hvor mange svar kan de velge?** | Nei | Endring av `maxSelections` gir 409, også når dere legger til en grense på et spørsmål som ikke hadde en. |
| Gjenbruke en gammel ID til en ny survey | Skrive inn en ID som er brukt før, i **Foreslått survey-ID** | Nei | Nye svar blir enten avvist eller blandet med en historisk analyseserie. |

Surveyverksted varsler ikke når en endring krever ny `surveyId`, heller ikke når
dere flytter et svaralternativ. På versjonssiden står det under
**Hva er endret?** hva som er endret siden forrige delte versjon, men ikke om
endringen gir 409. Bruk tabellen over når dere går gjennom en ny versjon.

### Tekster lagres sammen med svarene

Spørsmålstekst og tekstene til svaralternativene er ikke med i den strukturelle
definisjonen. De lagres likevel i hver innsending og brukes som visningstekst i
analysen. Hvis teksten endres over tid, telles svarene fortsatt sammen, men dashboardet
viser bare én av tekstene, enten den gamle eller den nye.

Rett gjerne skrivefeil. Bruk ny `surveyId` når ordlyden endrer hva brukeren blir
spurt om eller hva et svaralternativ betyr.

## Slik tar dere i bruk en strukturell endring

1. Lag en ny, beskrivende ID, for eksempel `sykepenger-kvittering-v2`.
2. Ta den nye surveyen i bruk i appen, og sjekk at innsendingene vises i
   dashboardet.
3. Fjern den gamle surveyen fra appen når den ikke skal samle inn flere svar.
4. Arkiver den gamle surveyen i dashboardet hvis dere vil skjule den fra
   standardvisningen.

Den gamle og den nye ID-en blir to separate analyseserier, og Lumi kobler dem
ikke automatisk sammen. Arkivering stopper heller ikke innsendinger. Det gjør dere ved å
fjerne eller slå av surveyen i appen.

## Hvis API-et svarer med 409

409 betyr at surveydefinisjonen ikke stemmer med definisjonen som allerede er
registrert for teamet og `surveyId`-en. Innsendingen er avvist og ikke lagret,
så den vises heller ikke i dashboardet.

Backenden deres får HTTP 409 fra Lumi API. Sender backenden feilen videre slik
at `transport.submit` feiler, viser widgeten feilmeldingen for innsending og
kaller `events.onSubmitError`. Standardteksten er «Kunne ikke sende
tilbakemeldingen. Prøv igjen senere.»

Feltet `message` i svaret fra Lumi API sier hva slags endring det gjelder, for
eksempel `addedFields=[field_1], removedFields=[field_2]`.

Svaret viser ikke spørsmåls-ID-ene. De er byttet ut med `field_1`, `field_2`
og så videre, og ID-ene til svaralternativene vises som `[REDACTED]`. Typer,
ratingvarianter, grenser for antall valg og surveytypen står med verdiene sine,
for eksempel `_surveyType: RATING -> CUSTOM`. Finn spørsmålet ved å sammenligne
den nye surveyen med versjonen som er i produksjon.

Dere har to valg:

- gå tilbake til den registrerte strukturen hvis endringen var utilsiktet
- bruk en ny `surveyId` hvis endringen var tilsiktet

Å sende den samme inkompatible innsendingen på nytt løser ikke konflikten.

## Delte versjoner i Surveyverksted

Surveyverksted lar dere dele en ny versjon med samme `surveyId` uansett hva dere
har endret. Hver delt versjon er et øyeblikksbilde som ikke kan endres. Å dele en
versjon tar den ikke i bruk i appen, og Surveyverksted sjekker ikke versjonen mot
definisjonen som Lumi API har lagret.

Før utvikleren tar i bruk en ny versjon, må den sammenlignes med surveyen som
samler inn svar i dag. Inneholder versjonen en endring som gir 409 i tabellen
over, må appen bruke en ny `surveyId` når den tar versjonen i bruk, også i dev.

## Tre versjonsbegreper

| Begrep | Betydning |
| :--- | :--- |
| `schemaVersion` | Versjonen av transportformatet. Den sier ikke hvilken versjon av surveyen brukeren så. |
| `surveyVersion` | Et valgfritt felt i API-ets lesemodell. Dagens widget setter det ikke, og backend bruker det ikke til validering eller til å dele opp analysen. |
| `definitionHash` | Et internt fingeravtrykk av den strukturelle definisjonen. Lumi API bruker det til å oppdage konflikter. Det er ikke en offentlig surveyversjon. |

Dere kan derfor ikke gjøre strukturelle endringer under samme `surveyId` ved å
sette `surveyVersion`. Bruk en ny `surveyId`.

::: info Eldre widget-versjoner
Lumi API godtar fortsatt `schemaVersion: 1` i en overgangsperiode. I slike
innsendinger kan den avledede definisjonen mangle spørsmål som brukeren ikke
svarte på. Ikke bruk dette som en måte å endre en survey som er i produksjon.
:::

## Sjekkliste før dere tar i bruk en endring

- Er `surveyId` unik for analyseserien innenfor teamet?
- Måler alle spørsmål og svaralternativer det samme som før?
- Er `type`, spørsmålstyper, ratingoppsett, grenser for antall valg og ID-ene
  til spørsmål og svaralternativer uendret?
- Er svaralternativene i samme rekkefølge?
- Kan gamle og nye svar fortsatt tolkes samlet?
- Har dere valgt en ny ID hvis svaret på ett av spørsmålene over er nei?
