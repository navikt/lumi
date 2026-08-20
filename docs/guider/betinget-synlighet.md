---
title: Vis bare relevante spørsmål
---

# Vis bare relevante spørsmål

Bruk `visibleIf` til å vise et oppfølgingsspørsmål bare når det er relevant. Når ingen spørsmål på en side er synlige, hopper Lumi over hele siden.

## Vis et spørsmål etter et tidligere svar

Legg `visibleIf` på spørsmålet som skal være skjult. Vis alltid til ID-en til et tidligere spørsmål i dokumentet.

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

## Operatorer

| Operator | Når betingelsen er sann | Eksempel |
| :--- | :--- | :--- |
| `EXISTS` | Spørsmålet har et svar | Vis oppfølging etter at brukeren har svart |
| `EQ` | Svaret er lik verdien | Vis når brukeren valgte «Nei» |
| `NEQ` | Svaret er ulikt verdien, også før et svar finnes | Kombiner med `EXISTS` for «har svart, men ikke Ja» |
| `GT` | Svaret er større enn verdien | Vis for vurdering over 3 |
| `LT` | Svaret er mindre enn verdien | Vis for vurdering under 3 |
| `CONTAINS` | En liste med svar inneholder verdien | Vis når «Annet» er valgt |

## Vent til brukeren har svart

`NEQ` er også sann før et spørsmål har fått svar, fordi et manglende svar er ulikt verdien du sammenligner med. Kombiner derfor `EXISTS` og `NEQ` når oppfølgingen skal vente på et svar:

```typescript
visibleIf: {
  all: [
    { questionId: "resultat", operator: "EXISTS" },
    { questionId: "resultat", operator: "NEQ", value: "ja" },
  ],
}
```

## Kombiner betingelser

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

Gruppene kan ha ett nivå. Du kan ikke legge en ny `any`- eller `all`-gruppe inni en gruppe, og en tom gruppe blir avvist.

## Vis et spørsmål for en bestemt kontekst

Bruk `field: "METADATA"` når visningen skal styres av kontekst i stedet for et tidligere svar.

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
| `viewport` | Automatisk | Objekt med `width` og `height`; bruk `EXISTS` |
| `screenResolution` | Automatisk | Objekt med `width` og `height`; bruk `EXISTS` |
| `userAgent` | Automatisk | Nettleserens user agent-streng |
| `pathname` | Context / valgt innsamling | Manuelt renset verdi, eller automatisk når `collectLocation` er på |
| `url` | Context | Samles aldri inn automatisk |
| Egendefinerte nøkler | `context.tags` | For eksempel `rolle`, `tjeneste` eller `abTest` |

Nøklene i `context.tags` ligger på toppnivå. `context.tags.rolle` brukes derfor som `key: "rolle"`. Et systemfelt med en definert verdi vinner over en tag med samme navn. `context.debug` er ikke tilgjengelig i synlighetsregler.

## Reglene TypeScript sjekker

En betingelse er enten ett vilkår eller en `any`-/`all`-gruppe. Et vilkår må ha:

- `questionId` for et tidligere svar, eller `field: "METADATA"` og `key` for kontekst
- en av operatorene i tabellen over
- `value` for alle operatorer unntatt `EXISTS`

Gruppene inneholder en liste med slike vilkår. Reglene valideres både av TypeScript og widgeten.

## Hold flyten enkel

Bruk `visibleIf` til all ny betinget flyt. Legg de betingede spørsmålene i dokumentrekkefølgen der de naturlig hører hjemme. Da blir surveyen enkel å forstå, forhåndsvise og vedlikeholde.
