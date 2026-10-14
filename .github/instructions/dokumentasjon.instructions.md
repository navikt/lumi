---
applyTo: "docs/**/*.md,docs/.vitepress/config.ts"
---

# Skriveregler for Lumi-dokumentasjonen

Dokumentasjonen er skrevet på bokmål for team i Nav: produktledere, designere,
innsiktsfolk og utviklere. Følg Navs skriveregler og skriveprinsipper på
<https://aksel.nav.no/god-praksis/artikler/skriveregler-i-nav>. Reglene under
kommer i tillegg, og de har forrang når de er mer presise.

## Innhold

- Begynn med det leseren skal gjøre eller vite. Første setning skal ikke gjenta
  sidetittelen eller fortelle hva siden handler om.
- Bruk konkrete detaljer: navn på knapper, felt, pakker, versjoner, filtre og
  tidsgrenser. Skriv hva som skjer, ikke hva det gir («Brukerne ser surveyen når
  appen er satt i produksjon», ikke «Teamet bestemmer når den rulles ut»).
- Ikke finn på fakta. Tall, teamnavn, tidsbruk og påstander om sikkerhet må ha
  en kilde i repoet. Mangler kilden, skriv `[TRENGER: …]` og spør eieren.
- Forklar en mekanisme én gang og lenk til den. Ikke gjenta flyten
  «lag, legg inn, les» på flere sider.

## Ord

| Skriv | Ikke skriv | Merknad |
| :--- | :--- | :--- |
| Nav, Nais, Nais Console | NAV, NAIS | Slik Nav og Nais skriver navnene selv |
| Entra ID | Azure AD | Nais bruker Entra ID. Kodenavn som `azure:` og `AZURE_APP_CLIENT_ID` beholdes |
| survey, surveyen, surveyer | surveys, spørreundersøkelse om hverandre | Samme ord som i Surveyverksted |
| app, appen | flate | «Flate» er internt og finnes ikke som filter |
| dashboardet, Lumi-dashboardet | dashbord, admin-dashboard | Samme ord som i menyen |
| widgeten | pluginen, modulen | Det `@navikt/lumi-survey` viser i appen |
| fram | frem | Nav bruker radikale former |
| sette i produksjon | rulle ut | |
| ha ansvaret for | eie | |

Bruk navnene fra grensesnittet i Surveyverksted og dashboardet ordrett, i fet
skrift. Engelske kodenavn står i `kode`.

## Form

- Skriv «dere» til teamet. Ikke bland inn «du» på samme side.
- Bare første ord i overskrifter, menypunkter og knapper har stor forbokstav.
- Overskrifter sier hva avsnittet inneholder. Unngå malene «Fra X til Y»,
  «Hvem er X for?» og «Alt du trenger å vite».
- Bruk kort tankestrek med mellomrom ( – ). Bruk aldri lang tankestrek (—).
  Ofte er punktum eller kolon bedre.
- Bruk «og», ikke «&», i tekst og i menyen.
- Skriv tall til og med tolv med bokstaver, datoer som «1. september 2026».
- Bruk lister for trinn og for likestilte valg. Et listepunkt som ikke er en hel
  setning, har liten forbokstav og ikke punktum.
- Fet skrift er for tekst fra grensesnittet, ikke for utheving.
- Ingen emoji i overskrifter, lister, knapper, lenker eller bunntekst. Unntaket
  er når emojien er en del av grensesnittet, som i ratingvariantene.
- Ingen piler (→) i knappetekst. VitePress legger til pil selv der det trengs.

## Mønstre som får teksten til å virke maskinskrevet

Se etter disse når du har skrevet ferdig, og skriv om setningen hvis du finner
dem:

- tre ledd på rad (tre verb, tre adjektiver, tre kort) når det ikke finnes
  nøyaktig tre ting å si
- «ikke bare X, men Y», «ikke X, men Y» og «Y i stedet for X»
- et påhengt ledd som forklarer nytten: «…, noe som gjør det enklere å …»
- fordelsord uten objekt: forstå, innsikt, forbedre, enkelt, effektivt,
  sømløst, kraftig, robust, trygt
- forsikringer uten mekanisme: «teamet bestemmer», «lagres trygt»
- mange forekomster av «eksplisitt», «bevisst» og «faktisk»
- en oppsummering eller et retorisk spørsmål til slutt
- lister med «**Etikett:** tekst» der vanlige setninger holder

## Før du er ferdig

Les teksten høyt. Ved større endringer bør en leser uten kontekst få svare
på hva siden sier. Dersom svarene ikke stemmer med det du ville si, er det
teksten som må endres.
