# Datakontrakt V1 for analyseprodukter

Denne kontrakten er den normative grensen mellom Lumi og konsumenter av et
publisert analyseprodukt. Den beskriver hva kolonnene betyr og hvilke
invarianter som må være sanne. Fysiske prosjekt- og datasettnavn fastsettes av
plattformintegrasjonen.

V1 publiserer tre analytiske viewtyper og en teknisk manifest-view. Det finnes
ingen konfigurasjon for å velge rått, nøstet, wide eller long format: wide,
long, feltkatalog og manifest publiseres som én samlet kontrakt.

## Felles identitet og tid

- `product_id` er stabil identitet for ett analyseprodukt.
- `product_release` er den aktive immutable releasen som styrer radens
  nåværende allowlist og retensjon. Dette gjelder også i en deprecated
  major-view; majoren identifiseres av viewnavnet.
- `product_snapshot_id` er en ugjennomsiktig identitet for det atomisk aktive
  produktsnapshotet. Alle rader i alle viewtyper fra samme aktivering har samme
  verdi.
- Kildeidentitet er alltid `(team_slug, app, survey_id)`. `survey_id` alene er
  ikke globalt unik.
- `team_slug` kommer fra autorisert teamkontekst og kan aldri overstyres av en
  klient.
- `submitted_date` beregnes fra serverens lagringstid i `Europe/Oslo`.
- `submitted_hour` er et UTC-timestamp trunkert til hel time og finnes bare når
  det er eksplisitt valgt.
- Klientens eksakte `submittedAt` eller `startedAt` publiseres aldri.

`response_key` og `answer_key` er nøkkelbaserte, produktspesifikke
pseudonymer. De er stabile gjennom releaser og major-visninger i samme produkt,
men forskjellige mellom produkter. Intern Lumi-ID og privat `source_row_key`
finnes aldri i kontrakten. Nøkkelrotasjon er en breaking endring og krever ny
major-versjon og kontrollert parallellperiode.

## Release-pinnet kildekontrakt

En release pinner kildekatalogrevisjonen og eksakt tillatt kombinasjon av:

- `(team_slug, app, survey_id)`
- `definition_status` og tillatte `definition_hash`-verdier, med eksplisitt
  legacy-regel for `NULL`
- tillatte ikke-null `flow_hash`-verdier med normalisert `visibleIf`,
  eksplisitte avhengigheter og evaluatorversjon
- `field_id`, `field_type`, ratingvariant/-skala og `max_selections`
- tillatte `option_id`-er
- godkjente metadatarevisjoner og dimensjoner

En ukjent definisjon, ikke-null flow-hash, felttype eller option blir aldri
automatisk publisert eller droppet fra en ellers publisert innsending. Bare
berørt produkt går til `Må vurderes`, fryser nye data ved siste trygge
`data_cutoff_at` og fortsetter purge-only refresh for retensjon og
kildesletting. Andre produkter fra samme source-snapshot fortsetter uavhengig.
Historiske `UNPINNED`-rader kan ikke tillates av en release. De ekskluderes
eksplisitt når en nyere, kjent flyt etablerer et trygt cutover. Hvis den sist
observerte innsendingen igjen er `UNPINNED`, blokkeres ny release og et aktivt
produkt fryser ved siste trygge cutoff. Dermed kan en rollback til gammel
klient eller deprecated `logic` aldri stille starte en stadig voksende
eksklusjon. En ukjent ikke-null hash blokkerer alltid.

Kildeendringen tas inn gjennom et nytt utkast, ny preview og ny validert
release. En ny flervalgsoption er kompatibel når releasen legger til en
nullable wide-kolonne og Metabase-/katalogsynk er planlagt. En ny
enkeltvalgsoption utvider domenet i eksisterende `<field>__option_id` og
katalogen, uten ny svarkolonne. Endret felttype, betydning eller ratingkontrakt
er breaking. Labelendring alene endrer ikke strukturell identitet, men følger
reglene for godkjent metadata nedenfor.

## `responses_<app>_<survey>_wide_v1`

Det publiseres én wide-view per valgt `(app, survey_id)`. Den har én rad per
release-tillatt, pinnet innsending og er fasit for den eksplisitt avgrensede
response-populasjonen og applicability-baserte denominatorer. Historiske
`UNPINNED`-rader er synlig rapportert som ekskludert i preview/release. En
tillatt innsending er med selv om ingen av de valgte svarfeltene ble besvart.

Viewnavn og dynamiske kolonnenavn avledes deterministisk fra stabil ID,
kollisjonssikker slug og kort hash. Brukeren kan ikke skrive SQL-identifikatorer.

### Faste kolonner

```text
response_key       STRING NOT NULL
product_id         STRING NOT NULL
product_release    INT64 NOT NULL
product_snapshot_id STRING NOT NULL
team_slug          STRING NOT NULL
app                STRING NOT NULL
survey_id          STRING NOT NULL
survey_type        STRING NOT NULL
submitted_date     DATE NOT NULL
submitted_hour     TIMESTAMP NULL     -- bare når eksplisitt valgt
definition_hash    STRING NULL
definition_status  STRING NOT NULL    -- REGISTERED | LEGACY_DERIVED
flow_hash          STRING NULL
flow_status        STRING NOT NULL    -- PINNED | UNPINNED
```

Lumi fabrikerer aldri en `definition_hash`. Legacy-rader uten registrert hash
har `definition_hash=NULL` og `definition_status=LEGACY_DERIVED`.

`flow_hash` er hash av hele den normaliserte `visibleIf`-flyten:
spørsmålsrekkefølge, predicate-avhengigheter og evaluatorens semantikkversjon.
`PINNED` krever en ikke-null hash som API-et selv beregnet fra en validert,
fullstendig flow-kontrakt og matchet ved ingest; en klientoppgitt hash er aldri
tilstrekkelig. Samme
`definition_hash` med endret flyt skal gi ulik `flow_hash`. Eksisterende rader
uten en entydig historisk flytrevisjon får `flow_hash=NULL` og
`flow_status=UNPINNED`; Lumi rekonstruerer dem aldri med dagens betingelser.
En survey som bruker deprecated `logic`, sender ingen flow-kontrakt og blir
`UNPINNED`. V1 lagrer, hasher eller evaluerer ikke `logic`; surveyen må
migreres til `visibleIf` før nye rader kan få eksakt applicability.

Flow-kontrakten registreres immutable og app-avgrenset på
`(team, app, survey_id, definition_hash, flow_hash)` før feedbackraden lagres i
samme transaksjon. Bare hashene lagres på feedbackraden. Definition og flow
fjernes fra rå feedback-JSON, og kildekatalogen leser materialiserte
kontraktobservasjoner i stedet for å skanne feedbacktabellen. Gamle klienter
fortsetter å virke med `flow_hash=NULL`.

En flow-kontrakt kan ha maksimalt 50 immutable revisjoner per
`(team, app, survey_id, definition_hash)`. Predicate-nøkler er maksimalt 200
tegn, predicate-strenger maksimalt 2048 tegn, og answer-predicates valideres
mot felttype, ratingintervall og choice-domene. Normalisert flow er maksimalt
64 KiB, og lagrede definition-/flow-kontrakter har et samlet budsjett på
16 MiB per team. Budsjettet serialiseres bare når en ny revisjon registreres;
kjente revisjoner deler eksisterende kontrakt. Når en revisjons- eller
bytegrense nås, lagres selve svaret fortsatt, men med `flow_hash=NULL`; kilden
blir dermed fail-closed `UNPINNED`. En kontrakt slettes automatisk når siste
feedbackrad som refererer den slettes. Kontrakten kan derfor ikke leve lenger
enn kildedataene den dokumenterer.

### Normativ `visible-if-v1`-semantikk

Alle conditions evalueres mot tilstanden ved innsending. En manglende verdi er
`undefined`; `null`, objekter og frie JSON-verdier finnes ikke i kontrakten.

| Operator | Normativ betydning |
| --- | --- |
| `EXISTS` | sann når input ikke er `undefined` |
| `EQ` | streng likhet uten typekonvertering |
| `NEQ` | negasjonen av streng likhet |
| `GT` / `LT` | numerisk sammenligning av endelige tall |
| `CONTAINS` på streng | case-insensitiv substring |
| `CONTAINS` på flervalg | eksakt medlemskap i listen |

`ALL` er sann når alle conditions er sanne; `ANY` er sann når minst én er
sann. Conditions normaliseres til deterministisk rekkefølge før hashing, men
rekkefølgen endrer ikke evaluatorresultatet. ANSWER kan bare referere et
tidligere felt. Den lukkede `deviceType`-dimensjonen støtter `EXISTS`, `EQ`,
`NEQ` og `CONTAINS`; likhetsverdier må være `desktop`, `mobile` eller
`tablet`. Enhver endring i disse sannhetstabellene, null-/typesemantikken eller
normaliseringen krever en ny evaluatorversjon og ny hashdomeneidentitet.

`flow_status=PINNED` krever både `definition_status=REGISTERED` og ikke-null
`flow_hash`. `flow_status=UNPINNED` krever `flow_hash=NULL`. Brudd på denne
invarianten stopper produktpubliseringen. En `UNPINNED` kilderad er aldri en
aktiv offentlig V1-rad; statusen brukes i privat validering og preview for å
forklare blokkering eller eksplisitt historisk eksklusjon.

### Dynamiske kolonner

```text
alle felt:       <field>__applicable BOOL
rating:          <field>__rating INT64
enkeltvalg:      <field>__option_id STRING
flervalg:        <field>__selection_count INT64
                 <field>__<option>__selected BOOL
dimensjon:       dim_<key>_<hash> STRING|BOOL|FLOAT64
```

`<field>__applicable` beskriver om feltet var relevant for innsendingen:

- `TRUE` krever `flow_status=PINNED` og betyr at feltet fantes og var
  ubetinget, eller at release-pinnet `visibleIf` fra radens `flow_hash` kunne
  evalueres deterministisk til sann.
- `FALSE` betyr at en registrert, fullstendig definisjon beviser at feltet ikke
  fantes, eller at en pinnet og sikkert evaluerbar `visibleIf` var usann.
- `NULL` er bare gyldig når en tillatt, pinnet definisjon ikke kan uttrykke en
  offentlig verdi for feltet; en `UNPINNED` kilderad ekskluderes før viewet.

Prioriteten er normativ: strukturelt bevist fravær i en release-tillatt,
registrert definisjon gir `FALSE`. Dagens predicate brukes aldri på en annen
historisk flytrevisjon. `UNPINNED` og `LEGACY_DERIVED` inngår ikke i den aktive
V1-populasjonen.

Alle answer- og metadataavhengigheter i en predicate må selv være eksplisitt
valgt, klassifisert og offentlig i samme produkt før det betingede feltet kan
inngå i en release. Preview viser avhengigheten og hvilken inferens både
answer-tilstedeværelse og applicability røper. En bare allowlistet, men uvalgt
avhengighet blokkerer releasen; det finnes ingen skjult «evaluation-only»-omvei
i V1. Historiske rader med unpinned/ukomplett flyt ekskluderes med et synlig
kvalitetsvarsel; `NULL` brukes ikke som en omvei til å publisere dem. En
betinget gren kan aldri merkes `TRUE` bare fordi feltet finnes i definisjonen. Et
ubesvart, men bevist tilgjengelig felt har derimot `applicable=TRUE` og `NULL` i
svarverdien.

En offentlig svarverdi kan bare finnes når feltets applicability er `TRUE`.
`FALSE` eller `NULL` gir alltid `NULL` i alle wide-svarkolonner og ingen
tilsvarende long-rad. `UNPINNED` historikk ekskluderes fra både wide og long
med `PASSED_WITH_WARNINGS`. Manifestet viser bare kvalitetsstatus; team-scope
preview kan vise et personverntersklet antall uten verdiinnhold. Dette kan ikke
aktiveres for en ukjent ikke-null flow-hash.

Hvis applicability er `FALSE`, men kildekandidaten likevel har et svar, er det
et kontraktsbrudd. Produktet fryser før aktivering og fortsetter bare
purge-only; verdien undertrykkes ikke lydløst. Det gjelder både strukturelt
fravær og usann pinnet `visibleIf`, for rating, enkeltvalg, flervalg og
`EMPTY_SELECTION`.

For et felt introdusert i D2 får registrerte D1-rader `FALSE` og pinnede,
ubetingede D2-rader `TRUE`; historiske rader blir ikke feilaktig regnet som
manglende svar. Når nyeste allowlist fjerner et felt, blir både svar- og
applicability-kolonnene `NULL` i deprecated majors. Det finnes da ikke lenger
et publisert grunnlag for en feltrate.

Flervalg bruker treverdisemantikk:

- `TRUE` betyr at alternativet ble valgt
- `FALSE` betyr at spørsmålet ble besvart, alternativet fantes i radens
  release-pinnede definisjon, men ble ikke valgt
- `NULL` betyr at spørsmålet ikke ble besvart, eller at alternativet ikke
  fantes i radens definisjon

`selection_count` skiller tilfellene: `NULL` betyr ubesvart; en ikke-null count
sammen med `NULL` option-bool betyr at optionen ikke var tilgjengelig i denne
definitionen. En D1→D2-utvidelse med ny option skal derfor aldri omskrive
historiske D1-rader til `FALSE`.

V1 varsler ved 80 genererte svar-, applicability- og dimensjonskolonner og har
hard grense på 120 per wide-view. JSON eller arrays kan ikke brukes for å omgå
grensen. Over grensen må feltutvalget reduseres eller flyttes til et annet
produkt.

## `answers_long_v1`

Den produktomfattende long-viewen er fasit for publiserte svarverdier og har én
rad per verdiatom:

- rating gir én rad
- enkeltvalg gir én rad for valgt alternativ
- flervalg gir én rad per valgt alternativ
- eksplisitt besvart, registrert og pinnet flervalg uten valg gir én
  `EMPTY_SELECTION`-rad
- ubesvart spørsmål gir ingen rad

```text
response_key         STRING NOT NULL
answer_key           STRING NOT NULL
product_id           STRING NOT NULL
product_release      INT64 NOT NULL
product_snapshot_id  STRING NOT NULL
team_slug            STRING NOT NULL
app                  STRING NOT NULL
survey_id             STRING NOT NULL
survey_type           STRING NOT NULL
submitted_date        DATE NOT NULL
submitted_hour        TIMESTAMP NULL
definition_hash       STRING NULL
definition_status     STRING NOT NULL
flow_hash             STRING NULL
flow_status           STRING NOT NULL

field_id              STRING NOT NULL
field_type            STRING NOT NULL    -- RATING | SINGLE_CHOICE | MULTI_CHOICE
field_metadata_hash   STRING NOT NULL
value_kind            STRING NOT NULL    -- RATING | OPTION | EMPTY_SELECTION
rating_value          INT64 NULL
option_id             STRING NULL
option_metadata_hash  STRING NULL
selection_count       INT64 NULL
dim_<key>_<hash>      STRING|BOOL|FLOAT64 NULL
```

### Radinvarianter

| `field_type` | `value_kind` | Påkrevde verdier | Kardinalitet |
| --- | --- | --- | --- |
| `RATING` | `RATING` | `rating_value` innen godkjent `rating_min..rating_max`; `option_id` og `option_metadata_hash` er `NULL` | nøyaktig én rad per besvart felt |
| `SINGLE_CHOICE` | `OPTION` | `option_id`, `option_metadata_hash`, `selection_count=1` | nøyaktig én rad per besvart felt |
| `MULTI_CHOICE` | `OPTION` | unik `option_id`, ikke-null `option_metadata_hash`, `selection_count=N` | N rader med samme `answer_key` |
| `MULTI_CHOICE` | `EMPTY_SELECTION` | `option_id=NULL`, `option_metadata_hash=NULL`, `selection_count=0` | én rad for eksplisitt registrert/pinnet tomvalg |

For et flervalg er N `COUNT(DISTINCT option_id)`. Alle N radene har samme
`answer_key` og `selection_count=N`, og det finnes maksimalt én rad per
`(answer_key, option_id)`. `answer_key` identifiserer dermed det logiske svaret,
mens raden representerer ett verdiatom.

Duplisert option-ID i en registrert definisjon eller duplisert valgt option i
et registrert/pinnet svar er et kontraktsbrudd og fryser produktet. Wide sin
`selection_count` og long sin N beregnes fra samme validerte option-sett og er
dermed identiske. `LEGACY_DERIVED`/`UNPINNED` publiseres ikke og har derfor
ingen offentlig dedupliseringssemantikk.

Ratingvariant, skala og min/max skal være innbyrdes konsistente med den
release-pinnede kildedefinisjonen. NPS har intervallet `0..10`; verdien `0` er
et gyldig svar og kan aldri behandles som `NULL`, falsy eller manglende.

Korrekte tellinger er:

```sql
-- Besvarte spørsmål i long
COUNT(DISTINCT answer_key)

-- Innsendinger med minst én publisert svarverdi
COUNT(DISTINCT response_key)
```

Totalt antall innsendinger er alle rader i relevant wide-view. For en
feltspesifikk svarrate er nevneren
`COUNTIF(<field>__applicable IS TRUE)`. Telleren begrenses til samme rader og
bruker ikke-null rating/enkeltvalg eller ikke-null `selection_count` for
flervalg. `FALSE` og `NULL` inngår ikke i nevneren. Legacy-rader med ukjent
applicability kan derfor ikke gis en eksakt feltrate; preview og manifest viser
et kvalitetsvarsel. Ingen denominator skal utledes fra long.

En option-rate må i tillegg avgrenses til definisjoner der optionen fantes.
Nevneren bruker `applicable=TRUE`, `definition_status=REGISTERED` og en
`EXISTS` mot nøyaktig produkt/release/snapshot, kilde, `definition_hash`,
`field_id`, `option_id` og `entry_kind=OPTION` i `field_catalog_v1`. Dette
gjelder både enkelt- og flervalg; fravær av en ny option i D1 er ikke et
historisk nullvalg. En rate blant besvarte bruker samme nevnerfilter og krever
i tillegg ikke-null svarverdi/`selection_count`. Preview og generert
Metabase-metadata skal navngi om raten bruker alle eligible eller bare besvarte
innsendinger.

```sql
WHERE wide.<field>__applicable IS TRUE
  AND wide.definition_status = 'REGISTERED'
  AND EXISTS (
    SELECT 1
    FROM field_catalog_v1 AS option_catalog
    WHERE option_catalog.product_id = wide.product_id
      AND option_catalog.product_release = wide.product_release
      AND option_catalog.product_snapshot_id = wide.product_snapshot_id
      AND option_catalog.team_slug = wide.team_slug
      AND option_catalog.app = wide.app
      AND option_catalog.survey_id = wide.survey_id
      AND option_catalog.definition_hash = wide.definition_hash
      AND option_catalog.field_id = '<field_id>'
      AND option_catalog.option_id = '<option_id>'
      AND option_catalog.entry_kind = 'OPTION'
  )
```

## `field_catalog_v1`

Feltkatalogen gjør etiketter og strukturell metadata tilgjengelig uten å bruke
tekst som fysisk identitet:

```text
metadata_hash        STRING NOT NULL
entry_kind           STRING NOT NULL    -- FIELD | OPTION
product_id           STRING NOT NULL
product_release      INT64 NOT NULL
product_snapshot_id  STRING NOT NULL
team_slug            STRING NOT NULL
app                  STRING NOT NULL
survey_id            STRING NOT NULL
definition_hash      STRING NULL

field_id             STRING NOT NULL
field_type           STRING NOT NULL
rating_variant       STRING NULL
rating_scale         INT64 NULL
rating_min           INT64 NULL
rating_max           INT64 NULL
max_selections       INT64 NULL

option_id            STRING NULL
option_ordinal       INT64 NULL
display_label        STRING NULL
label_source         STRING NOT NULL    -- REGISTERED_METADATA | PRODUCT_ALIAS | UNKNOWN
metadata_revision    STRING NULL
first_observed_date  DATE NULL
last_observed_date   DATE NULL
is_current_label     BOOL NOT NULL
```

Spørsmåls- og alternativetiketter i en innsending er klientstyrt metadata. De
kan inneholde fritekst eller personopplysninger og brukes aldri som offentlig
etikett, som hashinput eller som kilde til katalogkardinalitet.

En offentlig etikett må komme fra teamkontrollert, versjonert metadata som er
registrert gjennom en autentisert Lumi-flyt, eller fra et eksplisitt
produktalias som valideres og publiseres med releasen. Registrering og alias
normaliseres til ren tekst, lengdebegrenses, kontrolleres for forbudt innhold og
persondata og auditeres som offentlig katalogmetadata. Legacy-felt uten slik
metadata får `display_label=NULL`, `label_source=UNKNOWN` til eieren registrerer
et alias. Derfor gjelder følgende:

- `field_metadata_hash` inkluderer godkjent feltstruktur, etikett, kilde og
  metadatarevisjon.
- `option_metadata_hash` inkluderer felt-/option-ID og tilsvarende godkjent
  alternativmetadata.
- En long-rad peker til metadatarevisjonen som den aktuelle view-majoren
  anvender, ikke til en upålitelig etikett fra innsendingen.
- `first_observed_date`/`last_observed_date` beskriver når den strukturelle
  felt-/option-ID-en først og sist finnes i dataene, beregnet fra serverens
  lagringstid i `Europe/Oslo`. De er ikke gyldighetsperiode for etiketten.
- Manglende eller konfliktende registrert metadata er kvalitetsavvik. Lumi
  velger aldri en tilfeldig «siste etikett».
- Hvert tillatt felt og hver tillatt option får alltid en deterministisk
  `UNKNOWN`-fallbackrad i et vanlig fullsnapshot. Den er ikke current når
  godkjent metadata finnes, men gjør sikkerhetsredaksjon mulig uten å opprette
  en ny metadataidentitet fra et fryst produkt.

Katalogradene har disse invariantene:

| `entry_kind` / `label_source` | Påkrevd | Skal være `NULL` |
| --- | --- | --- |
| `FIELD` | `field_id`, `field_type`, `metadata_hash` | `option_id`, `option_ordinal` |
| `OPTION` | `field_id`, choice-`field_type`, `option_id`, `metadata_hash` | ratingmetadata |
| `REGISTERED_METADATA` | ikke-tom `display_label`, `metadata_revision` | – |
| `PRODUCT_ALIAS` | ikke-tom `display_label`, `metadata_revision` | – |
| `UNKNOWN` | – | `display_label`, `metadata_revision` |

`option_ordinal` er enten `NULL` eller et ikke-negativt, unikt ordinal innen
samme `(product_id, app, survey_id, definition_hash, field_id,
metadata_revision)`. Ratingfelter krever konsistent variant/scale/min/max;
choice-felter har disse ratingkolonnene som `NULL`. En malformed katalograd er
et kontraktsbrudd selv om ingen answer-rad peker til den.

`metadata_hash` beregnes deterministisk over `entry_kind`, full kildeidentitet,
`definition_hash` med eksplisitt nullmarkør, felt-/option-ID, strukturell
metadata, `display_label`, `label_source` og `metadata_revision`.

Feltmetadata joines med følgende komplette predikat:

```sql
answers.product_id = field_catalog.product_id
AND answers.product_release = field_catalog.product_release
AND answers.product_snapshot_id = field_catalog.product_snapshot_id
AND answers.team_slug = field_catalog.team_slug
AND answers.app = field_catalog.app
AND answers.survey_id = field_catalog.survey_id
AND (
  answers.definition_hash = field_catalog.definition_hash
  OR (answers.definition_hash IS NULL AND field_catalog.definition_hash IS NULL)
)
AND answers.field_id = field_catalog.field_id
AND answers.field_metadata_hash = field_catalog.metadata_hash
AND field_catalog.entry_kind = 'FIELD'
```

Optionmetadata bruker en egen katalogalias med dette komplette predikatet:

```sql
answers.product_id = option_catalog.product_id
AND answers.product_release = option_catalog.product_release
AND answers.product_snapshot_id = option_catalog.product_snapshot_id
AND answers.team_slug = option_catalog.team_slug
AND answers.app = option_catalog.app
AND answers.survey_id = option_catalog.survey_id
AND (
  answers.definition_hash = option_catalog.definition_hash
  OR (answers.definition_hash IS NULL AND option_catalog.definition_hash IS NULL)
)
AND answers.field_id = option_catalog.field_id
AND answers.option_id = option_catalog.option_id
AND answers.option_metadata_hash = option_catalog.metadata_hash
AND option_catalog.entry_kind = 'OPTION'
```

Hver `field_metadata_hash` skal matche nøyaktig én FIELD-rad. Hver
`value_kind=OPTION` skal ha ikke-null `option_metadata_hash` som matcher
nøyaktig én OPTION-rad. Rating og `EMPTY_SELECTION` skal ha
`option_metadata_hash=NULL`. En `OPTION`-rad matcher ikke samtidig FIELD-joinet;
konsumenten bruker to aliaser av katalogen.

`is_current_label` vurderes innen eksakt `(product_id, app, survey_id,
definition_hash, field_id[, option_id])`. Ved uløst konflikt er ingen kandidat
current, og refresh blokkeres.

Wide grupperer bevisst etter stabil felt-/option-ID og har ikke metadatahash
per svar. Kolonnebeskrivelsen er derfor displaymetadata for aktiv release, ikke
historisk fasit for ordlyden i gamle innsendinger. Preview varsler når Lumi har
registrert flere godkjente etiketter for samme stabile ID. Analyse per
metadatarevisjon bruker long; V1 hevder aldri historisk labelnøyaktighet fra
klientleverte innsendinger. Endret semantisk betydning under samme ID er
breaking og skal normalt løses med ny felt-ID; allerede sammenblandede data
blokkeres fremfor å gis en oppdiktet historikk.

Hvis en tidligere godkjent etikett tilbakekalles fordi den inneholder
persondata eller forbudt innhold, undertrykkes revisjonen i alle aktive og
deprecated majors ved neste snapshot. En `SECURITY_REDACTION`-aktivering fjerner
gammel label, katalograd og view-/kolonnebeskrivelse og flytter refererende hash
til deterministisk `UNKNOWN`. Den kan ikke introdusere erstatningstekst; en
godkjent erstatning krever ny validert release. Sikkerhetstilbakekalling kan
utløse ekstra refresh og følger samme 36-timers mål-SLO som kildesletting.

Den effektive publiseringsspesifikasjonen for en redaksjon er den immutable
releasen minus de auditerte tilbakekallingene. Denne spesifikasjonen er felles
input til kompilator, digest, ny immutable boundary-FQN, binder, reconciler og
alias desired state. Redaksjonen beholder `product_release`, men får ny
`product_snapshot_id`; gammel FQN deauthorizeres før aliasbyttet. Et
tilbakekallingssett kan ikke produsere en metadataidentitet som ikke allerede
fantes som godkjent eller `UNKNOWN` i forrige fullsnapshot.

## `product_manifest_v1`

Manifestet har én rad per offentlig analytisk ressurs i produktets aktive
pointer:

```text
product_id           STRING NOT NULL
product_release      INT64 NOT NULL
product_snapshot_id  STRING NOT NULL
resource_name        STRING NOT NULL
resource_kind        STRING NOT NULL    -- WIDE | LONG | FIELD_CATALOG
schema_digest        STRING NOT NULL
row_count            INT64 NOT NULL
contract_version     STRING NOT NULL
source_snapshot_at   TIMESTAMP NOT NULL
published_at         TIMESTAMP NOT NULL
data_cutoff_at       TIMESTAMP NULL
snapshot_mode        STRING NOT NULL    -- FULL | PURGE_ONLY | SECURITY_REDACTION
quality_status       STRING NOT NULL    -- PASSED | PASSED_WITH_WARNINGS
```

Separate Metabase-/Quarto-spørringer er ikke én transaksjon. Konsumenten som
krever samme øyeblikksbilde, sammenligner derfor `product_snapshot_id` fra
manifest, wide, long og katalog og retryer ved mismatch. For en mulig tom
ressurs brukes én BigQuery-statement som LEFT JOINer eksakt ressursrad i
manifestet mot viewet på `product_snapshot_id`. Da returnerer manifestdelen én
rad med `row_count=0` selv når viewkolonnene er `NULL`; en tom→ikke-tom
pointerendring kan ikke blandes inne i statementet. `product_release` alene er
ikke snapshotidentitet.

```sql
SELECT manifest.product_snapshot_id, manifest.row_count, resource.*
FROM product_manifest_v1 AS manifest
LEFT JOIN responses_example_wide_v1 AS resource
  ON resource.product_snapshot_id = manifest.product_snapshot_id
WHERE manifest.resource_name = 'responses_example_wide_v1'
```

## Syntetisk semantikkeksempel

En syntetisk innsending besvarer ratingfeltet `opplevelse` med `4` og
flervalgsfeltet `prioritering` med alternativene `a` og `c`:

- Wide har én response-rad med `opplevelse__rating=4`,
  `prioritering__selection_count=2`,
  `prioritering__a__selected=TRUE`,
  `prioritering__b__selected=FALSE` og
  `prioritering__c__selected=TRUE`.
- Long har én ratingrad og to flervalgsrader. Flervalgsradene har samme
  `answer_key` og `selection_count=2`.
- Feltkatalogen har FIELD-rader for begge felt og OPTION-rader for `a`, `b` og
  `c`, selv om `b` ikke er valgt i denne innsendingen.

Preview kan vise slike syntetiske rader og aggregerte, lavtallsbeskyttede mål,
men aldri en reell enkeltinnsending. Ekte mål kommer fra et fast sett
forhåndsdefinerte celler per kilde/felt, ikke fra vilkårlige unioner,
komplementer eller dato-/gruppekombinasjoner. Endring av draften velger blant
de samme cellene. Celler med 1–4 distinkte innsendinger returnerer bare
`BELOW_THRESHOLD`; 0 kan vises som 0 og minst 5 kan vises eksakt. Det brukes
også sekundærsuppresjon: en vist total eller undergruppe skjules når en
differanse eller et komplement kan utlede en ikke-null celle under 5.
Eksempelvis kan ikke total `6` og delmengde `5` vises samtidig fordi det
avslører komplementet `1`.

## Dimensjoner

En dimensjon kan bare publiseres hvis den finnes i et sentralt klassifisert
register med eier, forklaring, stabil output-ID, BigQuery-type, dataklasse,
tillatt team/app/survey-scope, maksimal kardinalitet og policy for nye verdier.

Valgte dimensjoner gjentas som flate, typede skalar-kolonner i både wide og
long. Uvalgte dimensjoner inngår ikke i produktets bidrag til det private
snapshotet og finnes ikke i produktets offentlige ressurser. Ukjent type,
typeendring eller overskredet policy blokkerer publisering/refresh eller krever
ny major; råverdien blir aldri automatisk stringifisert.

## Eksplisitt utelatt

Følgende kan ikke velges og finnes verken i privat eller offentlig eksportlag:

- tekst- og datosvar
- rå `feedback_json` eller surveydefinisjon
- vilkårlig context eller uklassifiserte tags
- full URL, query-parametere og pathname
- user-agent, viewport og skjermoppløsning
- debug og dedupliseringsnøkkel
- klientens eksakte tidsstempler
- intern database-ID
- verdier eller kolonner av typen `JSON`, `STRUCT` eller `ARRAY`

## Skjemaevolusjon

- Nytt felt/survey eller nullable kolonne er kompatibelt.
- Enhver ny offentlig kolonne, view eller surveyressurs merkes også som
  Metabase-/katalogsynk; dette gjelder både wide, long og produktregistreringen.
- Enhver publisert metadatarevisjon eller endret kolonnebeskrivelse utløser
  katalogoppdatering og Metabase metadata-sync/re-scan selv om fysisk schema er
  uendret.
- Fjerning, rename, type-/betydningsendring eller nøkkelrotasjon er breaking og
  oppretter en ny major-view.
- Annet team, forbudt datakategori, ukjent dimensjon eller ugyldig
  kildekontrakt er blokkert.
- En deprecated major beholder sitt fysiske schema frem til sin eksplisitte
  slettedato. Kolonner som nyeste release ikke lenger tillater beholdes, men er
  alltid `NULL`; long- og katalograder for fjernede felt forsvinner. Hvis en hel
  survey fjernes, består dens deprecated wide-view med null rader og stabilt
  schema frem til slettedato. Deretter fjernes viewet.
- En deprecated major leser samme effektive retensjon og source-deletions som
  nyeste release. `product_release` viser releasen som nå styrer allowlisten;
  viewnavnet viser majoren.

Kontrakten kan ikke publiseres før alle relevante kontroller i
[trussel- og verifikasjonsmodellen](./trusselmodell-v1.md) er grønne.
