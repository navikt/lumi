# Readiness for NAV-wide utrulling — 23. august 2026

Dette er et datert beslutningsgrunnlag for Lumi-widgeten på commit
[`4d7c5aa`](https://github.com/navikt/lumi/commit/4d7c5aa89dbbde3efaecf6237d3e0c0bd7c72c9d).
Det skiller teknisk verifikasjon fra beslutningen om hvilke surveys som skal
være aktive. Ingen surveys er migrert eller aktivert som del av vurderingen.

## Anbefaling

| Omfang | Beslutning | Begrunnelse |
| --- | --- | --- |
| Videre utvikling og forberedelse av én canary | **Kjør** | Den automatiske fullkjeden er grønn for ti V1-scenarier som representerer alle nåværende typediskriminanter |
| Migrering av eksisterende surveys | **Vent** | Eier, ønsket aktiv status og målingskontinuitet må avklares først |
| NAV-wide aktivering for flere team | **Ikke ennå** | Retensjon, autorisasjonsfunn og første ekte konsumentproxy må avklares eller verifiseres |
| HA, oppskalering og generell indeksbygging | **Utsett** | Sakte utrulling gir ikke belegg for denne løpende kostnaden nå; bruk målbare terskler |
| PITR | **Egen beslutning** | Recovery-målet må ses sammen med retensjon og sletting, ikke pakkes inn i HA-valget |

Den mest kosteffektive veien er derfor å holde Lumi teknisk klar, rette de små
konkrete feilene, bruke én faktisk konsument som canary og vente med permanent
kapasitetskost til bruk eller målinger forsvarer den.

## Verifikasjonsbevis

### Automatisk fullkjede

[CI-kjøring 32621097080](https://github.com/navikt/lumi/actions/runs/32621097080)
bestod på eksakt commit `4d7c5aa`. Artifakten
`full-chain-release-verification-32621097080` inneholder en maskinlesbar
`release-verification-report.json` med:

- `outcome: passed`
- `controlledRoundTrip: passed`
- `localSubmissionProxy: passed`
- `surveyContractMatrix: passed`
- 10 av 10 scenarier bestått, med egen receipt for hvert scenario

Matrisen verifiserer payload og V2-definisjon før transport, og deretter
widget → lokal proxy → Lumi API → Postgres → eksakt feedbackrad og
dashboardtype:

| Scenario | Det som dekkes |
| --- | --- |
| `rating-emoji` | rating, emoji, tekst og `visibleIf` |
| `rating-thumbs` | rating, tommel, tekst og `visibleIf` |
| `rating-stars` | rating, stjerner, tekst og `visibleIf` |
| `rating-nps` | rating, NPS, tekst og `visibleIf` |
| `discovery` | tekst, enkeltvalg, sider og `visibleIf` |
| `top-tasks` | enkeltvalg, tekst, sider og `visibleIf` |
| `task-priority-checkbox` | flervalg med avkryssing |
| `task-priority-combobox` | flervalg med komboboks |
| `custom-field-matrix` | tekst, enkeltvalg og flervalg |
| `pages-multi-question` | flere sider, flere spørsmål, `visibleIf` og stjerner |

Dette representerer alle fem nåværende V1-surveytyper, alle fire
spørsmålstyper, alle fire ratingvarianter og begge flervalgspresentasjonene.
Det er ikke det samme som å fullkjedeteste enhver mulig kombinasjon i hele det
offentlige API-et. Legacy-konfigurasjon, alle `visibleIf`-operatorer og
-grupper, metadatabetingelser, intro-/suksessvarianter og alle permutasjoner
dekkes primært av kontrakts- og komponenttester. Matrisen bør få en
typekoblet driftstest dersom nye offentlige unionmedlemmer skal kunne gjøre
fullkjeden rød automatisk.

`DATE` er en mulig lagret svartype i API-kontrakten, men kan ikke authoreres
eller rendres av `@navikt/lumi-survey`, og er derfor ikke en utestet
widgettype.

Neste billige herding av riggen er ett legacy-flat fullkjedescenario og et
eksplisitt, uttømmende manifest som TypeScript tvinger til å oppdatere når en
ny survey-, spørsmål-, rating- eller flervalgstype legges til. Det øker
driftsbeskyttelsen uten ny infrastruktur eller løpende skykost.

### Autentisert dev-runde

Status: **bestått**.

Den 23. august ble den eksisterende kjøringen
`lumi-release-verification-20260822-6c1ee1b6` rekonstruert i innlogget dev fra
de lagrede receipt-ene, uten nye innsendinger. Den maskinlesbare rapporten
viste:

- profil `dev-authenticated-roundtrip` i `dev-gcp`
- bestått team-preflight for `team-esyfo/lumi-dashboard`
- startprobe lagret `2026-08-22T12:31:40.110Z` og lest tilbake eksakt
- fullført holdvindu `2026-08-22T12:46:40.110Z`
- sluttprobe lagret `2026-08-22T12:47:08.096Z` og lest tilbake eksakt
- ingen readback-avvik
- `outcome: passed`
- `coverage.controlledRoundTrip: passed`

Rapportlenken rekonstruerte dermed beviset fra Postgres via dashboardets
innloggede lesesti. Resultatet var ikke avhengig av lokal nettleserstate.

15-minuttersvinduet er en tidsseparert repetisjon av den autentiserte kjeden:
startproben må kunne leses tilbake eksakt, og en ny sluttprobe må være lagret
etter vinduet. Det reduserer risikoen for at et øyeblikksbilde eller én heldig
request blir tolket som stabilitet. Det er ikke en lasttest, en 15-minutters
oppetidsgaranti eller bevis for alle konsumentapper.

### Det beviset bevisst ikke dekker

Den automatiske rapporten markerer følgende eksplisitt:

- `globalAzureHealth: not-assessed`
- `trygdeetatenProxy: not-tested`
- `navWideRelease: pending`

Dev-rapporten markerer i tillegg `localSubmissionProxy: not-tested`. Den
lokale CI-profilen har verifisert Lumi sin lokale submission-proxy, men ingen
av profilene beviser en annen konsumentapps deployede proxy.

Første avklarte canary må derfor sende et syntetisk svar gjennom den faktisk
deployede `lumi-submission-proxy`-integrasjonen og lese samme receipt tilbake i
dashboardet. Global helsetilstand og alarmrespons er operasjonell oppfølging,
ikke noe denne selvbetjente riggen later som den beviser.

## Kostbevisst vurdering av åpne funn

Dette er anbefalinger, ikke utførte issue-, label- eller konfigurasjonsendringer.

| Issue | Vurdering nå | Anbefalt neste steg |
| --- | --- | --- |
| [#473](https://github.com/navikt/lumi/issues/473) Manuell konsumenttilgang | Eksplisitt allowlisting er friksjon, men også en forståelig zero-trust-kontroll. Ikke en teknisk blocker ved langsom utrulling. | Behold manuell onboarding til volum eller ny eier gjør automatisering lønnsom. Dokumenter ansvar og ledetid, og legg eventuelt til en billig CI-sjekk mot drift mellom dev- og prod-listene. |
| [#478](https://github.com/navikt/lumi/issues/478) Retensjon | Reell styringsmangel før mange team tar løsningen i bruk. Manuell sletting av surveyens feedback, markører og dashboardmetadata finnes, men oppbevaringstid, eier og automatisk håndheving mangler. Den immutable definisjonen beholdes. | Ta menneskelig beslutning om retensjonsperiode og ansvar; implementer deretter håndheving og verifikasjon før bred aktivering. |
| [#479](https://github.com/navikt/lumi/issues/479) Autorisasjonsfallback | Latent, konfigurasjonsavhengig fail-open-kodegren: tomt teamoppslag kan falle tilbake til appens viewer-identitet. Risikoen er dempet i dagens NAIS-oppsett fordi workload-token kreves og viewer bare gir team for en `User`, men autorisasjonsinvarianten er feil og dagens test låser den uønskede grenen. | Liten, lavkost kodefiks med regresjonstest før nye team får tilgang. |
| [#480](https://github.com/navikt/lumi/issues/480) Teamcache | Koden cacher i 12 timer, mens dokumentasjonen lover opptil 1 time. Kortere TTL øker oppslag, men 12 timer gir lang tilbakekallingstid. | Avklar et eksplisitt revocation-SLO. Én time er et rimelig kost/sikkerhets-kompromiss dersom dokumentasjonsløftet skal beholdes. |
| [#482](https://github.com/navikt/lumi/issues/482) `esyfo-analyse` | Migreringene gir rollen SELECT på nåværende og fremtidige tabeller. Repoet beviser ikke om den fortsatt brukes. | Eier må bekrefte behov uten at agenten går i NAV-verktøy. Hvis ubrukt: fjern tilgangen; hvis brukt: avgrens formål og tabeller før flere team. |
| [#483](https://github.com/navikt/lumi/issues/483) Slettetekst og definisjonsrad | Feedback, markører og metadata slettes, mens den immutable definisjonen beholdes med vilje. Dialogen lover derfor mer enn implementasjonen gjør. Kvotepåstanden er en separat problemstilling. | Rett teksten nå. Behandle eventuell kvotefrigjøring og definisjonsretensjon separat, med ønsket audit-kontrakt. |
| [#484](https://github.com/navikt/lumi/issues/484) HA/PITR | Prod-manifestet deklarerer én databaseinstans med HA av og ingen PITR-innstilling. Effektiv backup-/PITR-status kan ikke bevises fra repoet alene. Nye alarmer og avgrensede analyseforespørsler gjør deler av risikobildet bedre, men endrer ikke recovery-egenskapene. | Ikke slå på HA eller skaler på antagelser nå. Definer terskler for team/last/SLO. Ta PITR som en separat RPO-/retensjonsbeslutning. |
| [#490](https://github.com/navikt/lumi/issues/490) Aktiv surveyperiode | Det opprinnelige 30-dagersproblemet for historiske surveys er løst. En smal restfeil finnes: en aktiv survey avsluttes ved cachet `lastSubmissionAt`, så et nytt svar på en senere Oslo-dato kan skjules frem til neste bootstrap-refetch. Backend-cachen varer opptil fem minutter, mens klientens fem minutters `staleTime` ikke i seg selv utløser refetch. En naiv «aktive slutter i dag»-fiks kan samtidig gjøre en sovende, gammel survey tom igjen eller lage et svært langt søkeintervall. | Revider akseptansekriteriene før kode. Bevar historisk ankring og løs stale-metadata-racen uten å gjeninnføre 30-dagersfeilen; lås begge tilfeller med regresjonstester. |
| [#494](https://github.com/navikt/lumi/issues/494) `debug`/`userAgent` | Den konkrete dokumentasjonsfeilen er løst: feltene beskrives som lagret, men ikke eksponert i dagens lesestier. Den underliggende dataminimeringen og formålet med full user-agent er fortsatt et reelt personvern-/produktvalg. | Retitle eller splitt saken slik at det løste dokumentasjonsfunnet ikke blandes med beslutningen om å slutte å samle inn eller å eksponere feltene. Ikke velg retning automatisk. |
| [#497](https://github.com/navikt/lumi/issues/497) Indekser og søk | Mulig skaleringsrisiko, men uten produksjonsmåling eller `EXPLAIN` som forsvarer nye indekser og skrivekost. Analysearbeidet er nå avgrenset i minnet, og issue-forslaget om at den eksisterende survey-ID-indeksen er redundant holder ikke for alle rader. | Utsett migrering og ikke fjern indeksen på antagelsen i saken. Sett terskel på radvolum og p95, og mål før indeksvalg. Vurder UI-debounce som et billigere første tiltak ved behov. |

Rate-limit-avvisninger er kontrollert separat: dagens `main` registrerer `429`
som `lumi_submissions_total{outcome="rejected"}`, og API-testen
`records a user rate-limited TokenX submission as rejected` verifiserer dette.

### Foreslåtte kostutløsere

Dette er startgrenser i fravær av produksjonsbaseline, ikke etablerte SLO-er:

- automatiser onboarding når det kommer minst tre access-forespørsler på 30
  dager, seks på 90 dager, eller arbeidet bruker mer enn fire teamtimer per
  måned i to måneder
- vurder databasetier når poolutnyttelsen er over 70 prosent i 15 minutter,
  ventende lån varer i fem minutter, connection acquisition p95 er over 250 ms,
  eller relevant API-latens er over 750 ms p95 / 2 sekunder p99
- vurder søkeindekser når søk/bootstrap overskrider samme API-latensterskel i
  to utrullingshold, eller en representativ plan bruker over 250 ms og skanner
  minst 100 000 teamrader
- gjør HA beslutningspliktig når eier krever for eksempel minst 99,9 prosent
  tilgjengelighet eller RTO på høyst én time; avgjør PITR før automatisk
  retensjon, bulk-sletting eller backfill

Billige tiltak som kan komme før triggerne er en manifest-driftstest,
søkedebounce og selvinstrumentering av databasepool/query-latens. De innebærer
ikke høyere databaseklasse eller HA-kost.

## Før én canary kan merge

1. Avklar én survey som faktisk skal beholdes, med eier og uendret eller bevisst
   endret måling.
2. Få autentisert dev-rapport til `passed` uten Grafana eller NAIS-konsoll.
3. Kjør et syntetisk start- og sluttsvar gjennom canary-appens faktiske proxy.
4. Review eksakt commit med grønne tester; ikke bruk auto-merge.

## Før aktivering for flere team

I tillegg til grønn canary:

1. Beslutt retensjonsperiode, slettemodell og eier i #478.
2. Rett autorisasjonsfallbacken i #479, og avklar revocation-SLO i #480 og
   faktisk behov for rollen i #482 før nye team får tilgang.
3. Dokumenter onboardingansvar og forventet behandlingstid for #473.
4. Følg målbare kapasitets- og recovery-terskler; ikke gjør HA, PITR eller
   indekskost til skjulte standardvalg.
5. Fyll ut beslutningstabellen i
   [runbooken for NAV-wide utrulling](./nav-wide-rollout.md) før migrering.
