---
title: Bruksvilkår
---

# Bruksvilkår

Les vilkårene før dere setter opp den første surveyen.

## Hva er Lumi?

Lumi er Navs interne verktøy for surveyer. Widgeten kjører i appen deres. Svarene lagres i Lumis PostgreSQL-database i Google Cloud (Cloud SQL), satt opp gjennom Nais. Lumi API og dashboardet kjører på Nais, og statistikken i dashboardet, som kan inneholde utdrag av fritekstsvar, mellomlagres i noen minutter i Valkey på Nais.

Dere kan bruke Lumi til å samle tilbakemeldinger i både interne og eksterne apper. Oppsettene dere kan velge mellom, står i [Velg hva dere vil måle](/guider/surveytyper).

## Forutsetninger for bruk

Før dere tar i bruk Lumi, må dere gjøre dette:

1. Fyll ut etterlevelsesdokumentasjon. Lag en kopi av [etterlevelsesmalen for Lumi (E726)](https://etterlevelse.ansatt.nav.no/dokumentasjon/201b8151-d312-4c76-bf44-2716d40a417a) for teamet deres, og tilpass den til deres bruk.
2. Les denne siden og [Sikkerhet og personvern](/referanse/sikkerhet), så dere vet hvordan dataene blir behandlet.
3. Vurder om dere trenger en personvernkonsekvensvurdering (PVK) for deres bruk av Lumi. Er dere i tvil, avklar med personvernombudet.

## Tilgang

Dere installerer widgeten i appen med pakken `@navikt/lumi-survey`, se [Installer widgeten](/kom-i-gang/installer-widget). Tilgangen til dashboardet styres automatisk av Entra ID og teammedlemskapet i Nais Console, se [Tilgang](/dashboard/tilgang).

## Personvern og ansvar

Nav er behandlingsansvarlig. På vegne av Nav har dere ansvaret for surveyen deres: hva den spør om, hvordan svarene brukes, etterlevelsesdokumentasjonen og eventuell PVK. Team eSyfo drifter Surveyverksted, Lumi API og dashboardet.

::: danger Ikke bruk Lumi til
- rekruttering til brukerundersøkelser eller brukertesting
- undersøkelser rettet mot brukere med skjermingskode (kode 6 eller 7)
- bevisst innsamling av personopplysninger som navn, fødselsnummer eller kontaktinformasjon
:::

Lumi lagrer ikke hvem som svarte. Svarene kan likevel inneholde personopplysninger, så ikke lov brukerne at de er anonyme, og ikke oppfordre dem til å oppgi personlig informasjon.

## Hva sporer Lumi?

Widgeten sender med kontekstdata som brukes til segmentering i dashboardet. De innebygde feltene beskriver tekniske egenskaper, men sammen kan de bidra til å skille enheter eller brukere fra hverandre, og de valgfrie feltene kan inneholde identifikatorer. Regn derfor ikke med at konteksten er anonym.

| Felt | Beskrivelse | Alltid sendt? |
| :--- | :--- | :--- |
| `deviceType` | Enhetstype (mobil, nettbrett, desktop) | Ja |
| `viewport` | Nettleservinduets størrelse i piksler | Ja |
| `screenResolution` | Skjermens størrelse rapportert av nettleseren | Ja |
| `userAgent` | Nettleser og OS | Ja |
| `url` | Siden brukeren er på (full URL) | Nei, kun hvis dere setter den manuelt i context |
| `pathname` | URL-pathname | Nei, opt-in via `collectLocation` |
| `tags` | Egendefinerte nøkkelverdi-par fra appen | Nei, valgfritt |
| `debug` | Feilsøkingsinfo fra appen | Nei, valgfritt |

Den fullstendige spesifikasjonen av hva widgeten sender, står i [Datakontrakt](/referanse/datakontrakt).

::: info Lagring i nettleseren
Lumi setter ingen cookies. På nav.no lagres det at brukeren har lukket surveyen, bare hvis brukeren har samtykket i cookie-banneret. I apper som bruker `storageStrategy: "localStorage"`, lagres det i localStorage. Se [Lagring](/guider/lagring).
:::

## Lagring og sletting

Svar slettes automatisk når de er eldre enn tolv måneder. Svar dere sletter i dashboardet, slettes med en gang. Databasen sikkerhetskopieres, så et slettet svar kan finnes i sikkerhetskopiene en tid etterpå. Detaljene står i [Sikkerhet og personvern](/referanse/sikkerhet#lagringstid).

Setter dere opp BigQuery-eksport, har dere ansvaret for kopien i teamets prosjekt og for hvem som får tilgang til den, se [Teamets ansvar](/dashboard/bigquery#ansvar).

## Hvordan personopplysninger kan komme inn

Lumi ber ikke om personopplysninger, men de kan likevel komme inn, blant annet slik:

1. I fritekstfelt kan brukerne skrive hva som helst, også navn, fødselsnummer eller kontaktinformasjon. Lumi maskerer kjente mønstre som fødselsnummer og e-postadresser, men ikke navn.
2. Noen Nav-URL-er har fødselsnummer eller andre identifikatorer som query-parametere. Lumi maskerer kjente PII-mønstre i URL-er og pathname ved lagring, men dere må fortsatt unngå dynamiske URL-er, tokens og identifikatorer.
3. Svaralternativene kan avsløre sensitiv informasjon, avhengig av hvordan dere formulerer dem. De blir ikke maskert, så dere må selv sørge for at alternativene ikke er identifiserende.
4. Tags og debug-data er valgfrie kontekstverdier som kan inneholde identifikatorer. Kjente PII-mønstre maskeres ved lagring, men feltene skal ikke brukes til person- eller saksidentifikatorer.

## Automatisk PII-maskering

Lumi maskerer kjente PII-mønstre i fritekstsvar og utvalgte kontekstfelt ved lagring. Bare fritekstsvar kontrolleres på nytt ved lesing.

Maskeringen erstatter treff med plassholdere som `[FØDSELSNUMMER FJERNET]`. Hvilke felt som dekkes, står i tabellen [Hvor og når maskering skjer](/referanse/sikkerhet#pii-feltdekning).

::: warning Maskeringen fanger ikke alt
Ikke samle personopplysninger med vilje. `userAgent`, surveydefinert metadata og strukturerte svar blir ikke PII-maskert. I URL, pathname, tags og debug-data fanges bare kjente mønstre, så også disse feltene må holdes fri for identifikatorer.
:::

Mønstrene, feltdekningen og begrensningene står i [Sikkerhet og personvern](/referanse/sikkerhet#pii-maskering).

## Informasjonsplikt

Dere må opplyse brukerne om at Lumi brukes til innsiktsarbeid. Hvordan dere gjør det, avhenger av appen:

- I apper på nav.no må bruken av Lumi være dekket av cookie-banneret og personvernerklæringen på siden der surveyen vises.
- I interne apper må dere informere brukerne om at tilbakemeldinger samles inn, for eksempel med en kort tekst i surveyen eller på siden.

## Bruk av fritekstfelt

Lumi maskerer kjente mønstre i fritekst, men ikke navn og vanlige adresser. Dere bør derfor:

- vurdere om surveyen trenger fritekst
- beholde varselet om personopplysninger ved fritekstfeltet. Det er med som standard.
- sjekke svarene i dashboardet jevnlig, særlig etter lansering

Lukkede spørsmål reduserer risikoen for at brukerne skriver personopplysninger, men surveydefinisjonen, svaralternativene og konteksten må fortsatt være fri for identifikatorer.

## Før dere publiserer

Gå gjennom sjekklisten før dere lanserer en survey:

- [ ] Teamet har en egen kopi av [etterlevelsesmalen (E726)](https://etterlevelse.ansatt.nav.no/dokumentasjon/201b8151-d312-4c76-bf44-2716d40a417a), fylt ut for deres bruk
- [ ] Dere har vurdert om dere trenger en PVK
- [ ] Spørsmålene er ikke laget for å samle inn personopplysninger
- [ ] Varselet om personopplysninger vises ved fritekstfeltene
- [ ] URL-er og pathname dere samler inn, inneholder ikke sensitive parametere som fødselsnummer eller tokens
- [ ] Svaralternativer avslører ikke sensitiv informasjon om brukeren
- [ ] Dere har testet surveyen i dev-miljøet
- [ ] Personvernerklæringen dekker bruken av Lumi, og cookie-banneret dekker lagringen i nettleseren (apper på nav.no)
- [ ] Brukerne er informert om at tilbakemeldinger samles inn (interne apper)

## Avvikshåndtering og sletting

Selv med automatisk maskering kan personopplysninger unntaksvis slippe gjennom, for eksempel i uvanlige formater eller når konteksten gjør et svar identifiserbart.

Hvis dere oppdager personopplysninger i svarene:

1. Slett tilbakemeldingen i dashboardet. Hvert svar har en egen sletteknapp. Har dere satt opp [BigQuery-eksport](/dashboard/bigquery), starter Lumi en ny kjøring automatisk, og svaret forsvinner fra BigQuery når kjøringen lykkes.
2. Slett svaret i kopier dere har laget selv, for eksempel nedlastede filer, lagrede resultater i Metabase og datafortellinger. Har dere delt dataene fra BigQuery, si fra til dem dere har delt dem med.
3. Vurder hvor alvorlig det er. Er opplysningene direkte identifiserbare, som fødselsnummer og navn, eller indirekte, som en kombinasjon av svar?
4. Meld avvik i [Navs avviksportal](https://navno.sharepoint.com/sites/intranett-avvik) hvis det gjelder sensitive personopplysninger.

Dere har taushetsplikt om opplysningene som samles inn, også om de er samlet inn ved et uhell.

## Brukerstøtte

Bruk [#lumi på Slack](https://nav-it.slack.com/archives/C0AG2FKSSMD) til spørsmål, feilmeldinger og forslag. Feil og ønsker om ny funksjonalitet kan også meldes som issues i [navikt/lumi på GitHub](https://github.com/navikt/lumi/issues).
