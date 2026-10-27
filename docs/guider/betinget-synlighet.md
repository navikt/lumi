---
title: Vis bare relevante spørsmål
---

# Vis bare relevante spørsmål

I Surveyverksted kan dere vise et spørsmål bare til brukere som har gitt et bestemt svar, for eksempel et oppfølgingsspørsmål til dem som svarer «Nei». Dere trenger ikke en utvikler for å sette det opp. Når ingen spørsmål på en side skal vises, hopper surveyen over hele siden.

## Legg til et oppfølgingsspørsmål

1. Velg spørsmålet som skal følges opp, i lista **Spørsmål**.
2. Under **Svaralternativer** velger dere **Legg til oppfølgingsspørsmål** ved svaret som skal følges opp. Knappen virker når svaralternativet har tekst.

   Er spørsmålet en vurdering, velger dere i stedet hvilke vurderinger som skal følges opp, under **Legg til oppfølgingsspørsmål**. Eksempler er **Ved lavt svar (1–2)** og **Ved tommel ned**.
3. Skriv spørsmålet under **Spørsmålstekst**. Det nye spørsmålet er et fritekstspørsmål, og under **Hvordan skal de svare?** kan dere velge en annen svartype.

Oppfølgingsspørsmålet får en egen side rett etter spørsmålet det følger opp. I lista **Spørsmål** står regelen under spørsmålet, og den begynner med «Vises når». Velg **Prøv hele undersøkelsen**, gi svaret regelen krever, og sjekk at oppfølgingsspørsmålet kommer. Mens dere redigerer, viser forhåndsvisningen alle spørsmålene, også dem som har en regel. Den starter på siden dere har valgt, og **Neste** går videre til neste side.

## Endre hvem som får et spørsmål

Under **Hvem skal få spørsmålet?** i redigeringen ser dere hvem som får spørsmålet nå, for eksempel **Alle som deltar**. Velg **Endre hvem**, og velg et av disse under **Vis spørsmålet til**:

- **Alle som deltar**
- **De som velger bestemte svar**. Velg spørsmålet under **Hvilket spørsmål?** og svarene under **Hvilke svar skal gi oppfølgingsspørsmålet?**. Det holder at brukeren har valgt ett av dem.
- **De som har svart på et tidligere spørsmål**. Hopper brukeren over det tidligere spørsmålet, vises ikke dette spørsmålet.

Velg **Ferdig** når regelen er riktig. Regelen kan bare vise til spørsmål som kommer før, så det første spørsmålet får alle. I de faste spørsmålene i et oppsett kan dere ikke endre hvem som får spørsmålet, se [Velg hva dere vil måle](/guider/surveytyper).

Skal alle som ikke svarte «Ja», få et oppfølgingsspørsmål, velger dere «Delvis» og «Nei» under **Hvilke svar skal gi oppfølgingsspørsmålet?**.

## Kombiner flere betingelser

Under **Avanserte innstillinger** nederst i redigeringen velger dere **Åpne avansert redigering**. Der lager dere en regel med **Vis bare hvis …** og legger til flere med **Legg til betingelse**. Med **Alle må stemme** må alle betingelsene være oppfylt, og med **Minst én må stemme** holder det med én. Vilkåret **er ikke lik** er oppfylt også før brukeren har svart. Skal oppfølgingen vente på svaret, legger dere til en betingelse med **har fått svar** for det samme spørsmålet og velger **Alle må stemme**.

Regler som bruker konteksten, for eksempel brukerens rolle, må utvikleren legge inn i koden. Surveyverksted viser dem, og dere kan fjerne dem, men ikke endre dem der.

## Det samme i kode

Surveyverksted lagrer regelen som `visibleIf` på spørsmålet. Det er også dette utviklere skriver når de lager eller endrer surveyen i kode.

### Vis et spørsmål etter et tidligere svar

Legg `visibleIf` på spørsmålet som skal vises betinget. Betingelsen må vise til ID-en til et spørsmål som står tidligere i dokumentet.

```typescript
import type { SurveyDocumentV1 } from "@navikt/lumi-survey";

const survey = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "vurdering",
      questions: [
        {
          id: "opplevelse",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan var opplevelsen din?",
          required: true,
        },
      ],
    },
    {
      id: "oppfolging",
      questions: [
        {
          id: "forbedring",
          type: "text",
          prompt: "Hva kan vi gjøre bedre?",
          visibleIf: {
            questionId: "opplevelse",
            operator: "LT",
            value: 4,
          },
        },
      ],
    },
  ],
} satisfies SurveyDocumentV1;
```

Her vises oppfølgingssiden bare når brukeren gir en vurdering lavere enn 4.

### Operatorer

| Operator | I avansert redigering | Når betingelsen er sann | Eksempel |
| :--- | :--- | :--- | :--- |
| `EXISTS` | **har fått svar** | Spørsmålet har et svar | Vis oppfølging etter at brukeren har svart |
| `EQ` | **er lik** | Svaret er lik verdien | Vis når brukeren valgte «Nei» |
| `NEQ` | **er ikke lik** | Svaret er ulikt verdien, også før et svar finnes | Kombiner med `EXISTS` for «har svart, men ikke Ja» |
| `GT` | **er større enn** | Svaret er større enn verdien | Vis for vurdering over 3 |
| `LT` | **er mindre enn** | Svaret er mindre enn verdien | Vis for vurdering under 3 |
| `CONTAINS` | **inneholder** | Svaret inneholder verdien: et valg i en liste, eller tekst uten hensyn til store og små bokstaver | Vis når «Annet» er valgt |

### Vent til brukeren har svart

`NEQ` er også sann før et spørsmål har fått svar, fordi et manglende svar er ulikt verdien dere sammenligner med. Kombiner derfor `EXISTS` og `NEQ` når oppfølgingen skal vente på et svar:

```typescript
visibleIf: {
  all: [
    { questionId: "resultat", operator: "EXISTS" },
    { questionId: "resultat", operator: "NEQ", value: "ja" },
  ],
}
```

### Kombiner betingelser

Bruk `all` når alle betingelsene må være sanne, og `any` når minst én må være sann.

```typescript
{
  id: "hva-manglet",
  type: "text",
  prompt: "Hva manglet?",
  visibleIf: {
    any: [
      { questionId: "del-en", operator: "EQ", value: "nei" },
      { questionId: "del-to", operator: "EQ", value: "nei" },
    ],
  },
}
```

Gruppene kan bare ha ett nivå. Dere kan ikke legge en `any`- eller `all`-gruppe inni en annen gruppe, og en tom gruppe blir avvist.

### Vis et spørsmål for en bestemt kontekst

Synligheten kan også styres av konteksten, for eksempel brukerens rolle. Da har vilkåret `field: "METADATA"` og en `key`, men ingen `questionId`.

```typescript
{
  id: "intern-oppfolging",
  type: "text",
  prompt: "Hva trenger du for å løse oppgaven?",
  visibleIf: {
    field: "METADATA",
    key: "rolle",
    operator: "EQ",
    value: "veileder",
  },
}
```

`key` slås opp i et flatt kart med disse verdiene:

| Nøkkel | Kilde | Merknad |
| :--- | :--- | :--- |
| `deviceType` | Automatisk | `mobile`, `tablet` eller `desktop` |
| `viewport` | Automatisk | Objekt med `width` og `height`, så bruk `EXISTS` |
| `screenResolution` | Automatisk | Objekt med `width` og `height`, så bruk `EXISTS` |
| `userAgent` | Automatisk | Nettleserens user agent-streng |
| `pathname` | `context` eller innsamling dere slår på | Manuelt renset verdi, eller automatisk når `collectLocation` er på |
| `url` | `context` | Samles aldri inn automatisk |
| Egendefinerte nøkler | `context.tags` | For eksempel `rolle`, `tjeneste` eller `abTest` |

Nøklene i `context.tags` ligger på toppnivå. `context.tags.rolle` brukes derfor som `key: "rolle"`. Et systemfelt med en definert verdi går foran en tag med samme navn. `context.debug` er ikke tilgjengelig i synlighetsregler.

### Reglene TypeScript sjekker

En betingelse er enten ett vilkår eller en `any`-/`all`-gruppe. Et vilkår må ha:

- `questionId` for et tidligere svar, eller `field: "METADATA"` og `key` for kontekst
- en av operatorene i tabellen over
- `value` for alle operatorer unntatt `EXISTS`

Gruppene inneholder en liste med slike vilkår. Både TypeScript og widgeten sjekker reglene.

### Hvor betingede spørsmål skal stå

Bruk `visibleIf` til all ny betinget flyt, og legg de betingede spørsmålene der de hører hjemme i rekkefølgen i `pages`.
