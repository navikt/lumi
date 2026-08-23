---
title: Bruksvilkår
---

# Bruksvilkår

Denne siden beskriver vilkårene for å bruke Lumi som verktøy for tilbakemeldinger i Nav. Les gjennom før du setter opp din første survey.

## Hva er Lumi?

Lumi er Navs interne verktøy for å kjøre personvernvennlige surveys. Widgeten lever i din app, data lagres i Navs eget cluster (PostgreSQL i GCP), og alt driftes på NAIS. Ingen tredjeparter er involvert.

Du kan bruke Lumi til å samle tilbakemeldinger på både interne og eksterne flater, med surveytyper som rating, top tasks, discovery og egendefinerte spørsmål.

## Forutsetninger for bruk

Før du tar i bruk Lumi, må du:

1. **Fylle ut etterlevelsesdokumentasjon** — gjenbruk [etterlevelsesmalen for Lumi (E726)](https://etterlevelse.ansatt.nav.no/dokumentasjon/201b8151-d312-4c76-bf44-2716d40a417a) og tilpass til din bruk
2. **Lese denne siden** og [Sikkerhet & personvern](/referanse/sikkerhet) for å forstå hvordan data håndteres
3. **Vurdere om du trenger PVK** (personvernkonsekvensvurdering) for din bruk av Lumi — avklar med personvernombudet ved tvil

## Tilgang

- **Widget**: Installer `@navikt/lumi-survey` i appen din — se [Installer widget](/kom-i-gang/installer-widget)
- **Dashboard**: Tilgang styres automatisk via Azure AD og teammedlemskap i NAIS Console — se [Tilgang](/dashboard/tilgang)

## Personvern og ansvar

Lumi maskerer automatisk kjente personopplysningsmønstre i utvalgte felt. Dette er et sikkerhetsnett, og du har fortsatt ansvar for å bruke verktøyet riktig.

::: danger Ikke bruk Lumi til
- **Rekruttering** til brukerundersøkelser eller brukertesting
- **Undersøkelser rettet mot brukere med skjermingskode** (kode 6 eller 7)
- **Bevisst innsamling av personopplysninger** som navn, fødselsnummer eller kontaktinfo
:::

Lumi er laget for anonyme tilbakemeldinger. Ikke oppfordre brukere til å oppgi personlig informasjon i svarene.

## Hva sporer Lumi?

Widgeten samler kontekstdata for segmentering i dashboardet. De innebygde feltene er tekniske egenskaper, men kombinasjonen kan bidra til å skille enheter eller brukere, og valgfrie felt kan inneholde identifikatorer. Konteksten må derfor ikke behandles som garantert anonym.

| Felt | Beskrivelse | Alltid sendt? |
| :--- | :--- | :--- |
| `deviceType` | Enhetstype (mobil, nettbrett, desktop) | Ja |
| `viewport` | Nettleservinduets størrelse i piksler | Ja |
| `screenResolution` | Skjermens størrelse rapportert av nettleseren | Ja |
| `userAgent` | Nettleser og OS | Ja |
| `url` | Siden brukeren er på (full URL) | Nei, kun hvis du setter den manuelt i context |
| `pathname` | URL-pathname | Nei, opt-in via `collectLocation` |
| `tags` | Egendefinerte nøkkelverdi-par fra appen | Nei, valgfritt |
| `debug` | Feilsøkingsinfo fra appen | Nei, valgfritt |

::: info Ingen cookies
Lumi bruker ikke cookies. Dismiss-tilstand lagres via consent-API-et på nav.no, eller localStorage på interne flater.
:::

## Hvordan personopplysninger kan komme inn

Selv om Lumi ikke ber om personopplysninger, kan de blant annet dukke opp slik:

1. **Fritekstfelt** — brukere kan skrive hva som helst, inkludert navn, fødselsnummer eller kontaktinfo. Lumi maskerer automatisk de vanligste mønstrene i fritekst-svar.
2. **URL-er og pathname** — noen Nav-URL-er inneholder fødselsnummer eller andre identifikatorer som query-parametere. Lumi maskerer kjente PII-mønstre ved lagring, men du må fortsatt unngå dynamiske URL-er, tokens og identifikatorer.
3. **Svaralternativer** — hvis du utformer alternativer som avslører sensitiv informasjon. Disse maskeres **ikke** — du må selv sørge for at alternativene ikke er identifiserende.
4. **Tags og debug-data** — valgfrie kontekstverdier kan inneholde identifikatorer. Kjente PII-mønstre maskeres ved lagring, men feltene skal ikke brukes til person- eller saksidentifikatorer.

## Automatisk PII-maskering

Lumi maskerer kjente PII-mønstre i **fritekstsvar** og utvalgte kontekstfelt ved lagring. Bare fritekstsvar kontrolleres på nytt ved lesing.

Maskeringen erstatter treff med plassholdere som `[FØDSELSNUMMER FJERNET]`. Se den normative tabellen under [Hvor og når maskering skjer](/referanse/sikkerhet#pii-feltdekning) for hvilke felt som dekkes.

::: warning Maskering er et sikkerhetsnett
Ikke samle personopplysninger med vilje. `userAgent`, surveydefinert metadata og strukturerte svar PII-maskeres ikke. For URL, pathname, tags og debug-data fanges bare kjente mønstre, så også disse feltene må holdes fri for identifikatorer.
:::

Se [Sikkerhet & personvern](/referanse/sikkerhet#pii-maskering) for mønstre, feltdekning og begrensninger.

## Informasjonsplikt

Du må opplyse brukerne om at Lumi brukes til innsiktsarbeid. Avhengig av flaten:

- **Ekstern flate (nav.no)**: Sørg for at bruken av Lumi er dekket av cookie-banneret og personvernerklæringen på siden der surveyen vises.
- **Intern flate**: Informer brukerne om at tilbakemeldinger samles inn, for eksempel gjennom en kort tekst i surveyen eller på siden.

## Bruk av fritekstfelt

Lumi maskerer automatisk de vanligste personopplysningene i fritekst. Du trenger ikke sette opp egne PII-filtre, men bør kontrollere svarene fordi maskeringen ikke kan fange alt.

Likevel bør du:

- **Vurdere om du trenger fritekst.** Lukkede spørsmål reduserer risikoen for at brukeren skriver personopplysninger, men surveydefinisjon, svaralternativer og kontekst må fortsatt være fri for identifikatorer.
- **Informere brukerne.** Hvis du bruker fritekstfelt, legg til en kort tekst som ber brukerne unngå å skrive personopplysninger.
- **Sjekke svarene jevnlig** i dashboardet, spesielt etter lansering. PII-maskeringen dekker de vanligste mønstrene, men kan ikke fange alt.

## Før du publiserer

Sjekkliste før du lanserer en survey:

- [ ] [Etterlevelsesdokumentasjon (E726)](https://etterlevelse.ansatt.nav.no/dokumentasjon/201b8151-d312-4c76-bf44-2716d40a417a) er fylt ut for din bruk
- [ ] Spørsmålene samler ikke inn personopplysninger bevisst
- [ ] Fritekstfelt har veiledningstekst om å unngå personopplysninger
- [ ] URL-er og pathname du samler inn inneholder ikke sensitive parametere (fødselsnummer, tokens osv.)
- [ ] Svaralternativer avslører ikke sensitiv informasjon om brukeren
- [ ] Du har testet surveyen i dev-miljø
- [ ] Personvernerklæring eller cookie-banner dekker bruken av Lumi (ekstern flate)

## Avvikshåndtering og sletting

Selv med automatisk maskering kan personopplysninger unntaksvis komme gjennom — for eksempel uvanlige formater eller kontekst som gjør svar identifiserbare.

Hvis du oppdager personopplysninger i svarene:

1. **Slett tilbakemeldingen** direkte i dashboardet — du har sletteknapp på hvert enkelt svar.
2. **Vurder alvorlighetsgrad.** Er det direkte identifiserbare opplysninger (fødselsnummer, navn) eller indirekte (kombinasjon av svar)?
3. **Meld avvik** hvis det dreier seg om sensitive personopplysninger, via [Navs avviksportal](https://navno.sharepoint.com/sites/intranett-avvik).

Du har taushetsplikt om opplysninger som samles inn, også dersom de er samlet inn ved uhell.

## Brukerstøtte

Trenger du hjelp?

- **Slack**: [#lumi](https://nav-it.slack.com/archives/C0AG2FKSSMD) — spørsmål, feilmeldinger og forslag
- **GitHub**: [navikt/lumi](https://github.com/navikt/lumi/issues) — rapporter bugs eller be om funksjonalitet

## Se også

- [Sikkerhet & personvern](/referanse/sikkerhet) — PII-maskering, rate limiting og penetrasjonstest
- [Datakontrakt](/referanse/datakontrakt) — full spesifikasjon av hva widgeten sender
- [Tilgang](/dashboard/tilgang) — hvem som har tilgang til dashboardet
