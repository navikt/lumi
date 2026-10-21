# Lumi-presentasjonen

«Hvor bor svaret?» er en presentasjon av Lumi. Lysbildene er React-komponenter
på en fast scene på 1920 × 1080 piksler, som skaleres til vinduet. Den ekte
widgeten fra `@navikt/lumi-survey` kjører på lysbildene, med en transport som
ikke sender noe.

Presentasjonen ligger på <https://navikt.github.io/lumi/presentasjon/>. Den er
offentlig, så alt på lysbildene og i notatene må tåle å være det.

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
| `?rom=faggruppa` | Faggruppa Design for fagsystemer, med spørsmål til gruppene |
| `?rom=frontend` | Frontend forum, med åpningsspørsmålet og de tekniske modulene |
| `?rom=produktledere` | Produktlederakademiet |

Uten `?rom` vises alle lysbildene unntatt åpningskroken for Frontend forum og
spørsmålene til gruppene, som bare brukes når presentasjonen holdes. Hvilke
rom et lysbilde hører til, står i `rooms` på lysbildet, og `roomOnly` skjuler
det på lenken uten `?rom`.

## Hurtigtaster

| Tast | Handling |
| --- | --- |
| → · Mellomrom · Page Down · Enter | Neste steg eller lysbilde |
| ← · Page Up · Backspace | Forrige steg eller lysbilde |
| Home · End | Første og siste lysbilde |
| Tall, så Enter | Gå til lysbilde nummer |
| G · O | Oversikt |
| F | Fullskjerm |
| B · . | Svart skjerm av og på |
| P | Presentatørvisning |
| ? | Hurtigtaster |
| Esc | Lukk, eller flytt fokus ut av widgeten |

Når fokus står i widgeten på et lysbilde, virker bare Page Up og Page Down,
som er tastene en presentasjonsklikker sender. Mens du skriver i et
tekstfelt, virker ingen hurtigtaster. Trykk Esc for å styre lysbildene igjen.

Adressen viser hvor du er, for eksempel `#/hvor-bor-svaret/2`. Laster du siden
på nytt, står du på samme sted.

## Svaret fra salen

Svaret som gis i widgeten på lysbildet «Svar meg», blir husket i fanen og
følger med til lysbildet «Svaret går samme vei som appens egne data». Der vises
også hva Lumi API ville lagret. Maskeringen er portert fra
`apps/lumi-api/src/main/kotlin/no/nav/lumi/sensitive/` til
`src/content/masking.ts` og må holdes lik koden i API-et. Har ingen svart, vises
et eksempel.

## Prøv selv på mobilen

`?prov` er en egen side for telefonen med den samme widgeten. QR-koden på
lysbildet «Prøv selv» leder dit. Svaret blir på telefonen, og siden viser hva
appen ville fått.

## Presentatørvisning

Trykk P. Presentatørvisningen åpnes i et nytt vindu, på samme adresse med
`?presenter`. Den viser lysbildet som vises nå, neste steg eller lysbilde,
notater, tidtaker og klokke. Begge vinduene kan styre presentasjonen, og de
følger hverandre. Legg publikumsvinduet på projektoren og presentatørvisningen
på din egen skjerm. Tidtakeren starter når du trykker Start.

## PDF

Åpne adressen med `?print`, gjerne sammen med `rom`, for eksempel
`?print&rom=faggruppa`. Alle lysbildene vises med alle byggesteg, ett per side
på 1920 × 1080 piksler. Velg Skriv ut og Lagre som PDF.

## Lage lysbilder

- Lysbildene ligger i `src/slides/deck/`, i rekkefølge i
  `src/slides/deck/index.ts`.
- Et lysbilde har `id`, `title`, `steps`, `notes`, `rooms` og `Component`.
- Byggesteg: `<Reveal at={2}>…</Reveal>`, eller attributtet `data-from="2"`.
- Kart tegnes med byggeklossene i `src/map/`: `LineMap`, `Line`, `Station`,
  `Answer`, `Zone`, `LineBadge` og `AppBox`.
- Gull er bare for svar. Alle farger og fonter står i `src/theme.css`, og
  fargene er fra Aksel.
- Nedre høyre hjørne holdes fritt, fordi Teams kan legge videoen av den som
  presenterer der.
- Fontene Overpass og Overpass Mono ligger i `src/assets/fonts/` med lisensen
  (SIL Open Font License).
