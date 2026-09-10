---
title: "ADR 0006: Teamavgrensede analyseprodukter"
status: Akseptert
date: 2026-08-29
---

# ADR 0006: Teamavgrensede analyseprodukter

- **Status:** Akseptert
- **Dato:** 2026-08-29
- **Berører:** #482, #507, #550, #551 og ADR 0005

## Kontekst

Team som bruker Lumi trenger å analysere strukturerte surveysvar i BigQuery,
Datamarkedsplassen, Metabase og datafortellinger. Den første konkrete
kandidaten er iSyfo/eSyfo, men løsningen skal fungere for minst 50 team uten
databasebruker, håndskrevet SQL, kodegren eller deploy per team.

Dagens brede `esyfo-analyse`-tilgang til Lumi-Postgres er en intern snarvei.
Den eksponerer en lagringsmodell med nøstet rådata og gir en tilgangsflate som
ikke skalerer til andre team. En generell eksport av `feedback_json` ville
flyttet både personvernrisiko, skjemaustabilitet og Lumi-spesifikk parsing til
hver konsument.

Analysebehovet er samtidig mer enn en nedlasting. Et team trenger et varig,
forståelig dataprodukt med eksplisitt formål, dataeierskap, kontrakt,
retensjon, tilgangsgrense og livsløp.

## Beslutning

### Lumi eier et kontrollplan for analyseprodukter

Et team kan opprette flere analyseprodukter. Ett produkt kan inneholde flere
surveys fra samme team når formål, tilgang og livsløp er felles. Produktet har
egen stabil `product_id`; team avledes alltid fra eksisterende autorisasjon og
kan ikke oppgis eller overstyres i request-body.

Hvert produkt har ett muterbart utkast og én aktiv, immutable release.
Validering er knyttet til eksakt draft-revisjon og kildekatalog. Publisering
lager en ny nummerert release med full konfigurasjon, aktør, tidspunkt og
base-`schema_digest`. Hvert aktivt snapshot har i tillegg effektiv
`schema_digest` fra releasen minus eventuelle auditerte
sikkerhetstilbakekallinger. Brudd i kontrakten lager en ny major-versjon; en
gammel major kan aldri bevare felt, dimensjoner eller retensjon som ikke lenger
er tillatt.

Releasen pinner også separate `flow_hash`-verdier: normalisert
`visibleIf`-flyt, predicate-avhengigheter, spørsmålsrekkefølge og
evaluatorversjon. Dagens strukturelle `definition_hash` inneholder ikke dette
og kan ikke brukes til å rekonstruere historisk synlighet. Rader uten en
registrert, ingest-matchet flytrevisjon får `flow_status=UNPINNED` og aldri en
oppdiktet eksakt applicability. Deprecated `logic` inngår ikke i den nye
analysemodellen; surveys som fortsatt bruker den sender ingen flow-kontrakt og
må migreres til `visibleIf` før nye rader kan pinnes.

En release tillater bare ikke-null, serverberegnede flow-hasher. Historisk
`UNPINNED` kan ekskluderes etter et nyere, pinnet cutover, men hvis siste
observerte rad igjen er `UNPINNED`, blokkeres kilden. Flowregisteret er
app-avgrenset, har maksimalt 50 revisjoner per kilde og definisjon, og lagrer
predicate-strenger på maksimalt 2048 tegn. Hver normaliserte flow er begrenset
til 64 KiB, og definition-/flow-registeret har et samlet 16 MiB-budsjett per
team. Kvoteoverflow stopper ikke feedbackinnsamling; raden lagres `UNPINNED`.
Immutable kontrakter slettes når siste refererende feedbackrad slettes, slik
at predicate-konstanter følger kildens retention. `visible-if-v1` sin operator-, type-, null- og
normaliseringssemantikk er normativt spesifisert i V1-datakontrakten; enhver
endring krever ny evaluatorversjon.

Nye releaser bruker `PublicationSpecification V2`. Den pinner hver tillatte
`definition_hash` med sine eksakte `flow_hash`-verdier; de to listene kan aldri
kombineres som et kartesisk produkt. For hvert valgt felt lagrer hver
definisjonsrevisjon eksplisitt `PRESENT` eller `ABSENT`, samt den eksakte
felt-, rating- og optionstrukturen. Dermed kan en D1-rad skille «feltet fantes
ikke» fra «feltet var ubesvart», også etter at D2 har introdusert feltet eller
en ny option. Spesifikasjonen kopierer ikke rå definition, predicates,
predicate-verdier eller klientlabels.

`PublicationSpecification V2` inneholder også `includeSubmittedHour` og det
kompilerte offentlige ressursskjemaet. Preview-konvolutten er versjonert som
V2, mens selve konsumentkontrakten fortsatt er V1. Samme frosne
V2-ressurskompilator brukes ved preview og ved validering av en lagret release;
lagrede resources må være strukturelt identiske med output av eksakte pins,
dimensjoner og timevalget selv om alle digester er beregnet på nytt.

Historiske V1-releaser forblir immutable og lesbare som provenance, men kan
ikke bli eksportgrunnlag. Et V1-utkast må valideres og publiseres som en ny
V2-release fra dagens kildekatalog.

Den aktive releasen materialiseres gjennom et deterministisk effective scope.
En nyere ønsket release blir straks en subtractiv øvre allowlist for det
aktive produktet; nye surveys, felt og dimensjoner blir først synlige i den
nye kandidaten ved aktivering. Rollback til en eldre release kan derfor ikke
gjeninnføre bredere scope, men må publiseres som en ny release. Pause tillater
utkast og validering, men ikke aktivering før produktet gjenopptas.
`submitted_hour` følger samme regel: fjerning gir straks `NULL_ONLY` i det
vedlikeholdte produktet, mens tillegg bare finnes i den nye kandidaten frem til
aktivering.

Lumi oppretter en lukket publiseringsflate, men gir aldri menneskelig
lesetilgang. Personer og grupper søker om og får tilgang gjennom
Datamarkedsplassen.

### Den offentlige kontrakten er flat og minimert

Et publisert produkt har alltid:

- én `responses_<app>_<survey>_wide_vN` per valgt kilde, med én rad per
  innsending
- én produktomfattende `answers_long_vN`, med én rad per publisert verdiatom
- én produktomfattende `field_catalog_vN`, med versjonert felt- og
  alternativmetadata
- én `product_manifest_v1`, med aktiv release/snapshot og én rad per offentlig
  ressurs

Den lange visningen er fasit for publiserte svarverdier. Den
surveyspesifikke wide-visningen er fasit for hele populasjonen og dermed for
totaler. Feltspesifikke denominatorer avledes fra eksplisitte
`<field>__applicable`-kolonner i wide, ikke fra fravær av long-rader.
`product_snapshot_id` finnes i alle viewtypene, slik at
konsumenten kan oppdage et pointerbytte mellom separate spørringer. Kontrakten
er nærmere spesifisert i
[V1-datakontrakten](../analyseprodukter/datakontrakt-v1.md).

Rått eller nøstet format er ikke et valg. Verken privat eller offentlig
eksportlag kan inneholde rå `feedback_json`, tekstsvar, datosvar, intern UUID,
vilkårlig context, URL, pathname, user-agent, debug, eller kolonner med typene
`JSON`, `STRUCT` eller `ARRAY`. Bare strukturerte svarfelt og dimensjoner fra et
sentralt klassifisert register kan velges.

Spørsmåls- og alternativetiketter i en innsending er klientstyrt metadata og
er ikke en godkjent tekstkilde. Offentlige etiketter kommer bare fra en
teamkontrollert, versjonert metadataregistrering eller et eksplisitt
produktalias. Legacy-data uten godkjent metadata får `NULL`/`UNKNOWN`; en
observert etikett eksporteres aldri.

Applicability for et betinget felt kan røpe utfallet av predicate-input. V1
tillater derfor bare feltet i en ny release når alle svar- og
metadataavhengigheter selv er eksplisitt valgt, klassifisert og offentlig i
samme produkt. Preview viser både avhengigheten og inferensen før release.
Historiske rader med ufullstendig eller unpinned flyt får `NULL` med
kvalitetsvarsel og får ingen offentlig verdi for det aktuelle feltet; dette
brukes ikke som en omvei for nye scopes. En kildeverdi ved bevist
`applicable=FALSE` fryser produktet før aktivering, enten `FALSE` skyldes
strukturelt fravær eller usann predicate.

Offentlige `response_key` og `answer_key` er stabile, nøkkelbaserte og
produktspesifikke pseudonymer. Samme kilderad får ulike nøkler i ulike
produkter. Nøklene er ikke anonymisering, og nøkkelmateriale skal aldri være
tilgjengelig for konsumenter.

V1 oppretter ikke en egen varig analyseidentitet eller sidecar-tabell for hver
feedbackrad. Intern feedback-ID kan bare brukes transient som input til den
betrodde, produktspesifikke nøkkelavledningen og skal aldri persisteres i
privat staging eller logges. Den source-globale atomstrømmen bruker i stedet en
ugjennomsiktig `snapshot_row_ref` som bare kobler rader innen én kandidat og
regenereres ved neste kjøring. Hver membership kobler denne referansen til det
aktuelle produktets stabile `response_key`. En transport er ikke egnet dersom
den ikke kan oppfylle dette uten å eksponere intern ID eller nøkkelmateriale.

### Eksporten bruker ett autoritativt fullsnapshot

V1 starter med én Lumi-eid Cloud SQL-connection og én planlagt federated query
til en versjonert, read-only `analytics_export_v1`-kontrakt. Kontrakten er én
transportuavhengig, source-global atomstrøm: kildefakta eksporteres én gang,
mens tynne memberships knytter dem til effective scopes. Den er ikke et
analytikergrensesnitt; konsumenter får fortsatt bare wide-, long-, katalog- og
manifestressursene. Hver kjøring leser kilden én gang til unik staging,
validerer source-globale invarianter og flytter en monoton
source-snapshot-pointer atomisk. Delvise, feilende eller eldre kildelesninger
kan aldri bli aktive.

Hvert produkt materialiseres deretter fra den aktive source-kandidaten og får
sin egen atomiske produktpointer. Produktet flyttes bare når release-,
isolasjon-, kontrakt- og retensjonskontrollene er grønne. Et produktlokalt
kontraktsbrudd stopper dermed ikke andre produkter. Berørt produkt fryser
inntaket ved siste trygge `data_cutoff_at`, går til `Må vurderes` og fortsetter
å lage purge-only snapshots fra dagens kilde, slik at slettede og utløpte rader
fortsatt forsvinner uten at nye, uvaliderte svar delpubliseres.

Maintenance-snapshots er monotont informasjonsreduserende fra forrige aktive
produktsnapshot. `PURGE_ONLY` kan bare fjerne nøkler som ikke lenger finnes i
en validert source-membership eller som har falt utenfor effektiv retensjon.
`SECURITY_REDACTION` kan i tillegg nullstille en tilbakekalt label, fjerne
katalog-/viewbeskrivelse og flytte referansen til en deterministisk
`UNKNOWN`-metadatahash som ble forhåndsmaterialisert av fullsnapshotet for
feltet/optionen. Ingen av dem kan legge til nøkler,
erstatte labelen med ny tekst, endre andre overlevende verdier/release/cutoff
eller rekonstruere data fra en uvalidert payload. En godkjent erstatningslabel
krever ny validert release.

Kompilatorens autoritative input er en `EffectivePublicationSpec`: den
immutable releasen minus et auditert sett med sikkerhetstilbakekallinger.
Tilbakekallingssettet kan bare fjerne godkjent metadata eller velge en
`UNKNOWN`-fallback som allerede finnes i fullsnapshotet; det kan aldri legge
til scope, felt, alternativ, dimensjon eller tekst. Samme effective spec og
digest er trusted desired state for kompilator, boundary-FQN, binder,
reconciler og alias-publisher. En redaksjon beholder `product_release`, men får
ny `product_snapshot_id`, `snapshot_mode=SECURITY_REDACTION` og ny digest når
den offentlige definisjonen endres.

Fjerning av publisert katalog-/viewbeskrivelse endrer digest og kan ikke mutere
et bundet view. Redaksjonen oppretter derfor en ny immutable boundary-FQN,
validerer og binder den, deauthorizerer gammel FQN før aliaset flyttes, og
verifiserer deretter at den gamle FQN-en ikke kan leses. Kortvarig
utilgjengelighet er akseptabelt i dette fail-closed-sikkerhetsløpet; gammel
metadata er det ikke. Den gamle ressursen slettes først etter verifisert
revokering.

Monotonikontrollen sammenligner forretningspayload og logiske nøkler, ikke
aktiveringsmetadata. Ny `product_snapshot_id`, publiseringstid og
`snapshot_mode` forventes å endres ved en ny maintenance-aktivering.

Replay betyr et nytt fullsnapshot fra dagens kilde; tidligere snapshots kan
ikke brukes til rollback fordi de kan gjeninnføre slettede data. Run-scopede
artefakter har hard TTL på maksimalt 24 timer.

Det private, kanoniske snapshotet inneholder bare unionen som trengs av aktive
releaser, pausede releaser og deprecated majors frem til avtalt slettedato.
Utkast og ferdig avviklede releaser materialiseres aldri. Nyeste release er
alltid øvre allowlist for produktet, slik at en gammel major ikke kan holde et
fjernet felt eller en fjernet dimensjon i privatlaget.

En sentral NAIS Job er eksplisitt fallback dersom en spike ikke beviser én
konsistent eksternlesning, akseptabel Cloud SQL-last, atomisk aktivering,
observability og slettesynk. Datastream og Airflow innføres ikke i V1.

### Hvert produkt får en isolert publiseringsflate

Målbildet er et dedikert Lumi-analyseprosjekt uten arvet menneskelig eller
default lesetilgang. Hvert analyseprodukt får et separat BigQuery-datasett
eller en tilsvarende isolert publiseringsflate. Konsumenter kan aldri lese
Lumi-Postgres, privat staging eller kanonisk snapshot.

Identitetene for Cloud SQL-eksport, BigQuery-connection, scheduled query,
kontraktkompilator, view-publisher, cross-dataset-binder, Lumi API og
konsumenter holdes atskilt og får minste privilegium. Publisher får bare
rettighetene BigQuery faktisk krever for å opprette eksakt
effective-spec-kompilert view, og kan ikke kjøre vilkårlige spørringsjobber
eller endre datasettilgang.
En separat binder eller NADA-mekanisme autoriserer bare et immutable,
release-scopet boundary-view mot privatlaget. FQN inkluderer produkt, major,
release og digest. Publisher oppretter ressursen, binder leser faktisk SQL og
reberegner digest mot trusted effective spec før binding, og ingen identitet kan
mutere viewet så lenge bindingen er aktiv. Endring oppretter en ny FQN;
offboarding revokerer binding før ressursen slettes.

De stabile offentlige V1-navnene kan være aliases over den aktive, bundne
releaseressursen. En separat alias-publisher har ingen canonical-tilgang og kan
bare velge en aktiv, bundet, ikke-tilbakekalt boundary-FQN med samme
`product_id`, major, release og digest som trusted desired state. Forsøk på å
peke produkt A til produkt B eller en gammel/revokert release avvises og
auditeres. Hvis plattformen ikke kan håndheve immutable binding, må flyten være
`deauthorize -> update -> revalidate -> authorize`, eller produktet må
materialiseres fysisk. Drift på en bundet ressurs gir umiddelbar deauthorization
før reparasjon. Et digestfelt alene er ikke en sikkerhetsgrense fordi BigQuery
autoriserer FQN, ikke SQL-innholdet.

BigQuery-rettigheten som kan endre en dataset-ACL kan teknisk også være sterk
nok til å gi mennesketilgang. Det kan derfor ikke bare hevdes at binder «ikke
kan» gjøre dette. Før produksjon må NADA eie bindingen, eller en separat,
auditert sikkerhetsport må begrense og godkjenne eksakte resource bindings.
Datamarkedsplassen forvalter fortsatt person- og gruppetilgang. Lumi API har
ikke databasecredential eller direkte publiseringsprivilegier.

Per-view authorization, authorized datasets, sharding og materialiserte
produktkopier har ulike kvote- og privilegiekonsekvenser. Endelig
publiseringstopologi velges først når spiken har bevist isolasjon og et
ressursbudsjett for opptil 500 aktive produkter, flere surveys og parallelle
majors. En løsning som gir fremtidige, ukontrollerte views implisitt
source-tilgang blir ikke godkjent bare fordi den holder seg under en kvote.

### Retensjon og sletting er del av kontrakten

Produktet velger 30, 90 eller 180 dager, eller kildens maksimum. Effektiv
retensjon er alltid den korteste av produktvalget og kildens faktiske
retensjon. Kildesletting og manuell sletting skal være borte fra alle aktive og
deprecated eksportressurser ved neste vellykkede fullsnapshot. Mål-SLO er
høyst 36 timer. Kjøringen skjer minst daglig og får automatiske retryforsøk
innenfor de neste seks timene; 36 timer uten slettesynk er et SLO-brudd med
operatørvarsel og runbook, ikke en påstand om at plattformutfall er umulige.

Pause fryser en immutable `data_cutoff_at` og stopper nye svar i produktet,
men stopper aldri innsamling i Lumi, retensjon eller slettesynk. Offboarding
stenger tilgang, fjerner markedsplassbindinger, views, data og grants, og
verifiserer tomhet før produktet kan få status `Slettet`.

Hvert produkt har obligatorisk vurderingsdato maksimalt 12 måneder frem.
Eierne varsles 30 og 7 dager før. Manglende fornyelse fører først til
`Må vurderes`, deretter pause og kontrollert offboarding; mislykket varsling kan
aldri forlenge dataretensjonen.

### Eksterne plattformgrenser må bevises før produksjon

Før produksjon må NADA-/plattformkontrakten bekrefte prosjektarv, minste IAM,
authorized views, programmatisk livsløp i Datamarkedsplassen, servicekontoer,
region, credentialrotasjon og registrering av flere views som ett dataprodukt.
Hvis teammedlemmer arver lesetilgang, krever aktivering en eksisterende ekstern
godkjenningsport. Lumi skal ikke bygge en egen IAM- eller godkjenningsmotor.

Lumi-kontrollplanet og BigQuery-discovery er teamisolert. Et eksplisitt
godkjent sett med navn, formål, eier og kontraktmetadata kan derimot være
synlig på tvers av team i Datamarkedsplassen, fordi discovery er dens formål.
Operasjonell metadata, preview-statistikk og ikke-publiserte navn er aldri del
av dette unntaket.

Offentlig plattformdokumentasjon låser tre ytterligere V1-grenser:

- Hvert analyseprodukt får ett separat offentlig BigQuery-datasett. Tilgang
  til én ressurs gir metadata-innsyn i resten av datasettet, så ulike produkter
  eller team kan ikke dele datasett.
- Produktdatasettene eies ikke av `spec.gcp.bigQueryDatasets` i Lumis
  NAIS-manifest. Dagens dokumenterte NADA-tilgangsflyt kan ikke gjenbruke slike
  datasett fordi NAIS overskriver senere tilgangsendringer.
- Metabase-tilgjengelighet er en egen, svakere plattformstatus: grupper
  synkroniseres ikke fra Datamarkedsplassen, og schemaendringer krever en
  eksplisitt sync. Lumi kan derfor aldri utlede Metabase-tilgang fra et aktivt
  datasnapshot.

Offentlig dokumentasjon lukker ikke minste-IAM, servicekonto-only prosjekt,
cross-dataset binding, programmatisk Marketplace-livsløp eller offboarding.
Gate B forblir stengt til NADA har besvart den versjonerte
[plattformvalideringen og avklaringspakken](../analyseprodukter/plattformvalidering-v1.md).

Kravene og evidensen som må foreligge før dev, shadow og produksjon er
spesifisert i
[trussel- og verifikasjonsmodellen](../analyseprodukter/trusselmodell-v1.md).

## Første pilot

iSyfo/eSyfo går gjennom samme UI, API, eksport og provisioning som andre team.
Første release inneholder bare de avtalte strukturerte feltene fra Bro og
Modia, ingen tags, fritekst eller datosvar. Piloten må bevise:

- samme totalpopulasjon som kilden, og samme svarmål som dagens Quarto for en
  periode der radene har ingest-matchet `flow_hash`, med samme filtre
- faktisk bruk i Metabase og datafortelling/notebook
- minst to vellykkede planlagte snapshots før cutover
- at et syntetisk eller reelt team B kan onboardes uten kode eller deploy
- at team B aldri kan se data eller operasjonell metadata fra team A, utenom
  eksplisitt godkjent katalogmetadata i Datamarkedsplassen

Den brede `esyfo-analyse`-tilgangen fjernes kontrollert først etter bevist
paritet og cutover. V1 lager ikke en antatt historisk flow for eksisterende
rader. Eldre `UNPINNED` svarverdier er derfor ikke med i answer-pariteten.
Cutover krever at dataeier aksepterer den pinnede perioden; et behov for eldre
svarhistorikk krever en separat, sikkerhetsreviewet backfillbeslutning.

## Konsekvenser

### Positivt

- Data scientists får en flat, relasjonell kontrakt i stedet for Lumi-intern
  råstruktur.
- Teamet kan se eksakt schema, syntetiske eksempelrader og eksklusjoner før
  publisering.
- Ett sentralt kontrollplan kan støtte mange team uten transport eller deploy
  per produkt.
- Produktisolasjon, retensjon, sletting og offboarding er innebygde
  kontraktskrav fremfor driftsrutiner hos hver konsument.

### Kostnad og residualrisiko

- Lumi får et nytt kontrollplan, kontraktkompilator, publisher/reconciler og
  operasjonelt ansvar for snapshots og slettesynk.
- Wide-visninger må håndtere kolonnegrenser og Metabase-synk; long er derfor
  nødvendig som stabil analytisk fasit.
- Produktspesifikke pseudonymer reduserer koblingsmulighet på tvers av
  produkter, men eliminerer ikke personvernrisiko i små eller særpregede
  datasett.
- Produksjonsaktivering avhenger av avklaringer og støttede mekanismer hos NADA
  og Datamarkedsplassen.
- Eksisterende svarhistorikk mangler ingest-matchet flow. V1 undertrykker disse
  feltverdiene fremfor å gjette historisk synlighet, så piloten bygger et nytt
  verifiserbart analysevindu fra aktiveringstidspunktet.

## Forkastede alternativer

### Gi hvert team database- eller rådatatilgang

Forkastet fordi det skalerer privilegier og Lumi-spesifikk parsing, eksponerer
for mye data og gjør sletting og kontraktsendringer vanskelige å håndheve.

### Publisere bare wide eller bare long

Forkastet. Bare wide gir ustabilt schema og dårlig støtte for flere surveys;
bare long mister en enkel og komplett response-populasjon for Metabase.

### Inkrementell transport eller CDC fra dag én

Forkastet for dagens målte volum. Fullsnapshot gir enklere, mer beviselig
idempotens, sletting og replay. Valget revurderes ved målte kapasitetsbehov.

### Bygge tilgangsgodkjenning og dashboardbygger i Lumi

Forkastet fordi Datamarkedsplassen og Metabase allerede eier disse
ansvarsområdene. Lumi skal publisere en trygg datakontrakt og vise ærlig
plattformstatus.

## Oppfølging

Implementeringen deles i små vertikale steg fra #482. Ingen produksjonsdata,
databasegrants, eksportjobber eller IAM-endringer aktiveres av denne ADR-en.
ADR 0005 sine kapasitets- og recoverygrenser gjelder også for analyseeksporten.

## Kilder

- [NADA: dataprodukter](https://docs.knada.io/dataprodukter/dele/dataprodukt/)
- [NADA: dataoverføring](https://docs.knada.io/dataprodukter/dele/dataoverf%C3%B8ring/)
- [NADA: tilgangsstyring og authorized views](https://docs.knada.io/dataprodukter/tilgangsstyring/)
- [NADA: Metabase](https://docs.knada.io/analyse/metabase/)
- [NADA: datafortellinger](https://docs.knada.io/analyse/datafortellinger/)
- [NAIS: BigQuery](https://doc.nais.io/persistence/bigquery/)
- [Plattformvalidering V1](../analyseprodukter/plattformvalidering-v1.md)
- [Google Cloud: BigQuery authorized views](https://docs.cloud.google.com/bigquery/docs/authorized-views)
- [Google Cloud: administrere BigQuery-views](https://docs.cloud.google.com/bigquery/docs/managing-views)
- [Google Cloud: BigQuery quotas and limits](https://docs.cloud.google.com/bigquery/quotas)
