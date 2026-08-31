# Plattformvalidering V1 for analyseprodukter

Denne siden skiller det som er bekreftet i offentlig NADA-, NAIS- og
Google-dokumentasjon fra det som fortsatt krever en eksplisitt avklaring med
NADA. Den er evidensgrunnlag for
[ADR 0006](../adr/0006-teamavgrensede-analyseprodukter.md) og Gate B/D i
[trusselmodellen](./trusselmodell-v1.md).

Gjennomgangen er utført 31. august 2026. Den oppretter ingen databasebruker,
BigQuery-ressurs, IAM-binding, scheduler eller Datamarkedsplassen-ressurs.
Offentlig dokumentasjon er ikke et bevis på faktisk IAM i Lumi-prosjektet;
slikt bevis må samles fra dev før en ekte connection kan tas i bruk.

## Konklusjon

Hovedretningen er støttet:

- NADA beskriver planlagt federated query som en vanlig transport fra
  PostgreSQL til BigQuery.
- Ett dataprodukt kan samle flere tabeller/views som naturlig hører sammen,
  så lenge de ligger i samme GCP-prosjekt.
- Tilgang til tabeller/views forvaltes i Datamarkedsplassen, og authorized
  views kan hindre lesetilgang til underliggende tabeller.
- Metabase og datafortellinger kan konsumere BigQuery-produktet uten at Lumi
  bygger en egen analyse- eller tilgangsflate.

Gate B er likevel **stengt**. Offentlig dokumentasjon beskriver ikke en
programmatisk, minste-privilegert publiseringsflyt som oppfyller Lumis krav til
isolasjon, immutable bindings, offboarding og opptil 500 produkter. NADA må
bekrefte eller korrigere punktene i avklaringspakken nedenfor før en ekte
dev-connection opprettes.

## Validerte plattformgrenser

| ID | Funn | Konsekvens for V1 | Status |
| --- | --- | --- | --- |
| P01 | NADA beskriver federated query fra PostgreSQL, videre transformasjon i BigQuery og planlagt kjøring med servicekonto. Google krever at query location matcher connection location, og anbefaler å skjerme operasjonell databasebelastning. | Federated fullsnapshot beholdes som første transportspike, men er ikke produksjonsgodkjent før region, last, konsistens og stoppgrenser er bevist. NAIS Job er fortsatt fallback. | Bekreftet retning |
| P02 | NADA opplyser at BigQuery-datasett opprettet av en NAIS-applikasjon foreløpig ikke kan gjenbrukes i deres tilgangsflyt fordi NAIS overskriver tilgangene. NAIS-manifestet kan heller ikke oppdatere innstillinger på et eksisterende datasett. | Produktdatasett skal ikke legges til `spec.gcp.bigQueryDatasets` i `lumi-api`-manifestet. Provisioning og sletting må bruke en NADA-støttet mekanisme med eksplisitt livsløp. | Bekreftet begrensning |
| P03 | Når en person får tilgang til én tabell/view gjennom Datamarkedsplassen, får personen metadata-innsyn i resten av samme BigQuery-datasett. | V1 bruker ett separat offentlig BigQuery-datasett per analyseprodukt. Flere produkter eller team deler aldri offentlig datasett. Bare eksplisitt godkjent katalogmetadata kan være globalt søkbar. | Besluttet grense |
| P04 | Ett dataprodukt i Datamarkedsplassen kan inneholde flere datasettressurser som ligger i samme GCP-prosjekt. | Wide-, long-, katalog- og manifestressurser kan presenteres som ett Lumi-analyseprodukt. Alle offentlige produktdatasett må ligge i samme dedikerte analyseprosjekt. | Bekreftet modell |
| P05 | Datamarkedsplassen autoriserer viewet automatisk når view og underliggende tabeller ligger i samme BigQuery-datasett. Cross-dataset views må etter offentlig oppskrift autoriseres manuelt i kildedatasettet. | Lumi kan ikke anta at Datamarkedsplassen oppretter bindingen mellom privat snapshot og et isolert produktdatasett. En støttet binder/API eller fysisk materialisering er en produksjonsblokkering. | Må avklares med NADA |
| P06 | Authorized views beskytter underliggende tabeller, men en source-dataset har en samlet grense på 2 500 authorized views, datasets og functions. Slettede view-referanser kan telle mot grensen i opptil 24 timer. Authorized datasets gir også framtidige views i det autoriserte datasettet source-tilgang. | Per-view authorization kan overskride budsjettet ved 500 produkter, flere surveys og parallelle majors. Authorized dataset godtas ikke uten kontroll som hindrer at vilkårlige framtidige views opprettes. Fysisk produktkopi er fail-closed fallback. | Topologi må bevises i spike |
| P07 | Google skiller connection service agent, den som bruker connection, scheduled-query-identiteten og datasettprivilegier. NADA-eksempelet bruker flere brede, forhåndsdefinerte roller på prosjekt- og datasettnivå. | Rolleeksemplene kopieres ikke ukritisk. Eksakte permissions, ressursnivå og capability-separasjon må bekreftes. Ingen runtime-identitet skal både kunne endre source-ACL, publisere vilkårlig SQL og gi mennesketilgang. | Må avklares med NADA |
| P08 | Datamarkedsplassen forvalter tilgang per tabell/view. For personopplysninger kreves relevant behandling i Behandlingskatalogen. | Lumi publiserer ingen menneskegrant. Produkteier må oppgi gyldig behandlingsreferanse der det kreves, og Datamarkedsplassen forblir godkjenningsport. | Bekreftet ansvar |
| P09 | Metabase synkroniserer ikke gruppetilganger fra Datamarkedsplassen, bortsett fra `all-users@nav.no`. Tilgangsbegrensede datasett krever individuell tilgang. Schemaendringer krever sync, og ny skann skjer ellers daglig. | Lumi viser separat Metabase-status og kan ikke love at en gruppe eller ny kolonne er tilgjengelig. Piloten må verifisere individuelle iSyfo-brukere og eksplisitt schema-sync/re-scan. | Bekreftet begrensning |
| P10 | Datafortellinger kan registreres og oppdateres programmatisk med team-token. Denne API-en publiserer selve fortellingen, ikke analyseproduktet eller BigQuery-tilgangen. | Datafortelling er en konsument av samme V1-kontrakt, ikke en egen eksport- eller IAM-modell i Lumi. | Bekreftet avgrensning |
| P11 | NADA beskriver Soda v4 Data Contracts kjørt som NAIS Job, med Slack-varsler og tilgjengelige kontrollresultater. Dokumentasjonen beskriver ikke hvordan dette kobles til Lumis produktstatus, eierfornyelse eller operatørvarsling. | Soda kan være en ekstra kvalitetskontroll, men erstatter ikke Lumis fail-closed publiseringskontroller eller autoritative run-status. Kanal, mottaker, statusintegrasjon og ansvar må avklares før shadow. | Delvis bekreftet; ansvar åpent |

## Bindingsalternativer som skal spikes

Alternativene vurderes i denne rekkefølgen. Ingen av dem kan aktiveres før
minste IAM og faktisk isolasjon er verifisert.

| Alternativ | Fordel | Risiko og obligatorisk bevis |
| --- | --- | --- |
| Immutable authorized view per release | Eksakt FQN kan bindes og tilbakekalles separat. | Kvote må holde for minst 500 produkter med surveys og parallelle majors. Publisher må miste mutate-capability før binding, og 24-timers heng ved sletting må håndteres med unike FQN-er og kapasitetsmargin. |
| Authorized dataset per produkt | Ett source-ACL-innslag per produkt gir bedre kvotemargin. | Alle nåværende og framtidige views i produktdatasettet får source-tilgang. Bare aktuelt dersom plattformen kan bevise at ingen identitet kan opprette eller endre et view uten samme policyvalidering som binderen. |
| Fysisk, atomisk produktkopi | Ingen cross-dataset authorization fra offentlig flate til privat snapshot; enklere konsumentgrense. | Mer lagring og kopiering. Spiken må bevise atomisk pointerbytte, slettesynk, opprydding, kostnad og at privat identitet ikke lekker til produktet. Dette er fail-closed fallback dersom viewbindingen ikke kan gjøres trygg. |

Ingen stabil alias skal peke til en ressurs før den immutable kandidaten er
validert og bundet/materialisert. Offboarding revokerer lesbarhet før gammel
ressurs slettes. Et gammelt snapshot kan aldri brukes som rollback.

## Avklaringspakke til NADA

Svarene skal dokumenteres med dato, kontaktpunkt og lenke til støttet
mekanisme. Et muntlig «det går nok» lukker ikke en gate.

1. Kan et dedikert Lumi-analyseprosjekt opprettes uten arvet menneskelig eller
   default lesetilgang, og hvordan dokumenteres faktisk arv og deny-policy?
2. Hvilken støttet mekanisme skal opprette og avvikle ett produktdatasett per
   analyseprodukt når NAIS-manifestet ikke kan eie datasettene?
3. Finnes et støttet API eller en deklarativ integrasjon for å registrere,
   oppdatere og avvikle dataprodukt + flere tabell/view-ressurser i
   Datamarkedsplassen? Hvis ikke: hva er den støttede selvbetjente porten, og
   hvilke statuser kan Lumi lese autoritativt?
4. Kan NADA eie eller tilby cross-dataset-bindingen etter validering av eksakt
   immutable FQN og SQL, eller bør V1 materialisere fysiske produktkopier?
5. Hvilke eksakte IAM-permissions og ressursnivåer kreves for connection
   service agent, scheduled-query servicekonto, publisher, binder og
   offboarder? Hvilke identiteter kan endre dataset-ACL eller gi mennesker
   tilgang?
6. Hvilken region skal connection, private datasett og produktdatasett bruke
   mot Lumis Cloud SQL-instans, og hvilken privat nettvei er støttet?
7. Hvordan forvaltes og roteres Cloud SQL-credential for connection uten
   menneskeeid hemmelighet eller privilegert tilgang i Lumi API?
8. Er 500 produktdatasett i ett prosjekt en støttet modell, og hvilke kvoter,
   provisioninggrenser og kostnader må lasttesten inkludere?
9. Hvordan representeres flere views og parallelle major-versjoner som ett
   dataprodukt, og hvordan håndteres schema-sync/re-scan i Metabase?
10. Hvilke behandlings-/PVK-krav og metadatafelt må være oppfylt før første
    tilgang kan godkjennes?
11. Er Soda v4 Data Contracts den støttede kvalitetsintegrasjonen for denne
    modellen, og hvordan skal resultater og feil inngå i autoritativ
    produktstatus? Hvilke kanaler og ansvarlige mottakere støttes for
    operasjonelle avvik og varsler om eierfornyelse?

## Beslutningsport etter svar

Gate B kan bare åpnes når alle punktene under er dokumentert:

- valgt bindingstopologi med eksplisitt ressursbudsjett
- faktisk IAM-matrise uten udokumentert arv
- region, privat nettvei og credential-eierskap
- støttet provisioning- og offboardingmekanisme
- støttet kvalitets-/statusintegrasjon og varsling med tydelig eierskap
- syntetisk dev-plan for team A/B, forbudt-data-canary og feilinjeksjon

Hvis NADA ikke tilbyr en sikker cross-dataset-binder, velges fysisk
produktkopi før dev-spiken. Hvis produktdatasettene ikke kan være isolert uten
menneskelig arv, stoppes produksjonsløpet; Lumi bygger ikke en egen
godkjenningsmotor som omgår plattformen.

## Kilder

- [NADA: registrere dataprodukt](https://docs.knada.io/dataprodukter/dele/dataprodukt/)
- [NADA: dataoverføring](https://docs.knada.io/dataprodukter/dele/dataoverf%C3%B8ring/)
- [NADA: tilgangsstyring](https://docs.knada.io/dataprodukter/tilgangsstyring/)
- [NADA: Metabase](https://docs.knada.io/analyse/metabase/)
- [NADA: datafortellinger](https://docs.knada.io/analyse/datafortellinger/)
- [NADA: kvalitetssikring med Soda og Data Contracts](https://docs.knada.io/dataprodukter/kvalitetssikring/)
- [NAIS: BigQuery-datasett](https://doc.nais.io/persistence/bigquery/)
- [Google Cloud: federated queries](https://docs.cloud.google.com/bigquery/docs/federated-queries-intro)
- [Google Cloud: koble BigQuery til Cloud SQL](https://docs.cloud.google.com/bigquery/docs/connect-to-sql)
- [Google Cloud: scheduled queries](https://docs.cloud.google.com/bigquery/docs/scheduling-queries)
- [Google Cloud: authorized views](https://docs.cloud.google.com/bigquery/docs/authorized-views)
- [Google Cloud: authorized datasets](https://docs.cloud.google.com/bigquery/docs/authorized-datasets)
