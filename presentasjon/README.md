# Lumi-presentasjonen

Dette er en presentasjon av Lumi. Lysbildene er React-komponenter
på en fast scene på 1920 × 1080 piksler, som skaleres til vinduet. Den ekte
widgeten fra `@navikt/lumi-survey` kjører på lysbildene, med en transport som
ikke sender noe.

Presentasjonen ligger på <https://navikt.github.io/lumi/presentasjon/>. Den er
offentlig, så alt på lysbildene må tåle å være det.

## Kjøre lokalt

Fra rota av repoet:

```bash
pnpm install
pnpm presentasjon:dev
```

`pnpm presentasjon:build` bygger til `presentasjon/dist`. Stiene er relative,
så mappen kan legges ut under hvilken som helst adresse. Før en presentasjon
er det tryggest å kjøre den bygde versjonen lokalt med
`pnpm --filter lumi-presentasjon run preview`, så du ikke er avhengig av nettet.

## Ett foredrag per rom

Samme presentasjon holdes for flere publikum. Adressen velger hvilke lysbilder
som er med:

| Adresse | Rom |
| --- | --- |
| `?rom=faggruppa` | Faggruppa Design for fagsystemer |
| `?rom=frontend` | Frontend forum, med åpningsspørsmålet og de tekniske lysbildene |
| `?rom=produktledere` | Produktlederakademiet |

Uten `?rom` vises alle lysbildene unntatt åpningsspørsmålet for Frontend
forum, som bare brukes når presentasjonen holdes. Hvilke
rom et lysbilde hører til, står i `rooms` på lysbildet, og `roomOnly` skjuler
det på lenken uten `?rom`.

## Hurtigtaster

Disse virker alltid:

| Tast | Handling |
| --- | --- |
| →, Mellomrom, Page Down eller Enter | Neste steg eller lysbilde |
| ←, Page Up eller Backspace | Forrige steg eller lysbilde |
| Home eller End | Første og siste lysbilde |
| Esc | Lukk, eller flytt fokus ut av widgeten |

Hurtigtaster med én tast:

| Tast | Handling |
| --- | --- |
| Tall, så Enter | Gå til lysbilde nummer |
| G eller O | Oversikt |
| F | Fullskjerm |
| B eller punktum | Svart skjerm av og på |
| L | Bytt mellom natt, dag og papir |
| ? | Hurtigtaster |

Talestyring kan trykke hurtigtaster med én tast ved et uhell (WCAG 2.1.4). De
er derfor av på lenken uten `?rom` og på med `?rom`, der presentasjonen holdes.
Bryteren «Hurtigtaster med én tast» i hjelpedialogen slår dem av og på. Valget
lagres i nettleseren, hver for seg for lenkene med og uten `?rom`, så den som
presenterer, ikke mister tastene fordi de ble slått av på den delte lenken.

Når fokus står i widgeten på et lysbilde, virker bare Page Up og Page Down,
som er tastene en presentasjonsklikker sender. Mens du skriver i et
tekstfelt, virker ingen hurtigtaster. Trykk Esc for å styre lysbildene igjen.

Adressen viser hvor du er, for eksempel `#/lumi/2`. Laster du siden
på nytt, står du på samme sted.

## Uten tastatur

Når du flytter musa eller trykker på skjermen, kommer en stripe nederst på
midten med Forrige, Neste, hvilket lysbilde du er på, og Hurtigtaster. Den
forsvinner etter tre sekunder, men aldri mens den har fokus, og den vises ikke
i fullskjerm. Knappene kan alltid nås med Tab. På berøringsskjerm kan du også
sveipe til venstre og høyre.

## Natt, dag og papir

Natt er standard. `?stil=dag` gir lyse farger, og `?stil=papir` er for et lyst
rom. L bytter mellom dem uten å laste siden på nytt. Utskriften og siden for
mobilen bruker alltid papir.

## Høy kontrast

Med tvungne farger, som kontrasttemaene i Windows, følger kartene
systemfargene. Svaret beholder gull. Reglene står i
`src/engine/forced-colors.css`.

## Svaret fra salen

Lysbildet «Dere svarer først» (`SvarMeg.tsx`) står ikke i rekkefølgen nå. Er
det med, blir svaret som gis i widgeten der, husket i fanen og følger med til
lysbildet «Svaret går via appens backend og blir på Nais». Der vises også hva
Lumi API ville lagret. Maskeringen er portert fra
`apps/lumi-api/src/main/kotlin/no/nav/lumi/sensitive/` til
`src/content/masking.ts` og må holdes lik koden i API-et. Har ingen svart, vises
et eksempel.

## Prøv selv på mobilen

`?prov` er en egen side for telefonen med den samme widgeten. QR-koden på
lysbildet «Dere kan prøve widgeten nå» leder dit. Svaret blir på telefonen, og siden viser hva
appen ville fått, og hva Lumi API ville lagret av fritekstsvaret, med samme
maskering som på lysbildet. Siden holder av plass under widgeten, så det den
viser, aldri blir liggende skjult bak den.

## PDF

Åpne adressen med `?print`, gjerne sammen med `rom`, for eksempel
`?print&rom=faggruppa`. Alle lysbildene vises med alle byggesteg, ett per side
på 1920 × 1080 piksler. Velg Skriv ut og Lagre som PDF. Widgetene er med slik
de ser ut når de åpnes, men de kan ikke brukes, og merket «Live» er borte.

## Lage lysbilder

- Lysbildene ligger i `src/slides/deck/`, i rekkefølge i
  `src/slides/deck/index.ts`.
- Et lysbilde har `id`, `title` og `Component`, og ofte `steps` og `rooms`.
  Alle feltene står i `src/engine/types.ts`.
- Byggesteg: `<Reveal at={2}>…</Reveal>`, eller attributtet `data-from="2"`.
- Kart tegnes med byggeklossene i `src/map/`: `LineMap`, `Line`, `Station`,
  `Answer`, `Zone`, `LineBadge` og `AppBox`.
- Fargene betyr det samme overalt: grønt er det teamet gjør, blått er det
  Lumi gjør, oransje er det som er viktig å vite, lilla er det som er utenfor
  Nav, og gull er bare svar. Alle farger og fonter står i `src/theme.css`, og
  fargene er fra Aksel.
- Nedre høyre hjørne holdes fritt, fordi Teams kan legge videoen av den som
  presenterer der.
- Fontene Overpass og Overpass Mono ligger i `src/assets/fonts/` med lisensen
  (SIL Open Font License).
