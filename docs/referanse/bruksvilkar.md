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

1. **Ha etterlevelsesdokumentasjon** for tjenesten din som dekker brukerundersøkelser
2. **Lese denne siden** og [Sikkerhet & personvern](/referanse/sikkerhet) for å forstå hvordan data håndteres
3. **Vurdere om du trenger PVK** (personvernkonsekvensvurdering) for din bruk av Lumi — avklar med personvernombudet ved tvil

## Tilgang

- **Widget**: Installer `@navikt/lumi-survey` i appen din — se [Installer widget](/kom-i-gang/installer-widget)
- **Dashboard**: Tilgang styres automatisk via Azure AD og teammedlemskap i NAIS Console — se [Tilgang](/dashboard/tilgang)

## Personvern og ansvar

Lumi maskerer personopplysninger automatisk, men du har fortsatt ansvar for å bruke verktøyet riktig.

::: danger Ikke bruk Lumi til
- **Rekruttering** til brukerundersøkelser eller brukertesting
- **Undersøkelser rettet mot brukere med skjermingskode** (kode 6 eller 7)
- **Bevisst innsamling av personopplysninger** som navn, fødselsnummer eller kontaktinfo
:::

Lumi er laget for anonyme tilbakemeldinger. Ikke oppfordre brukere til å oppgi personlig informasjon i svarene.

## Hva sporer Lumi?

Widgeten samler kontekstdata for segmentering i dashboardet. Ingen av feltene identifiserer enkeltpersoner.

| Felt | Beskrivelse | Alltid sendt? |
| :--- | :--- | :--- |
| `deviceType` | Enhetstype (mobil, nettbrett, desktop) | Ja |
| `viewport` | Skjermstørrelse i piksler | Ja |
| `userAgent` | Nettleser og OS | Ja |
| `url` | Siden brukeren er på (full URL) | Nei, kun hvis du setter den manuelt i context |
| `pathname` | URL-pathname | Nei, opt-in via `collectLocation` |
| `tags` | Egendefinerte nøkkelverdi-par fra appen | Nei, valgfritt |
| `debug` | Feilsøkingsinfo fra appen | Nei, valgfritt |

::: info Ingen cookies
Lumi bruker ikke cookies. Dismiss-tilstand lagres via consent-API-et på nav.no, eller localStorage på interne flater.
:::

## Hvordan personopplysninger kan komme inn

Selv om Lumi ikke ber om personopplysninger, kan de dukke opp på tre måter:

1. **Fritekstfelt** — brukere kan skrive hva som helst, inkludert navn, fødselsnummer eller kontaktinfo. Lumi maskerer automatisk de vanligste mønstrene i fritekst-svar.
2. **URL-er og pathname** — noen Nav-URL-er inneholder fødselsnummer eller andre identifikatorer som query-parametere. Disse maskeres **ikke** automatisk — det er ditt ansvar å unngå å samle inn URL-er med sensitive parametere.
3. **Svaralternativer** — hvis du utformer alternativer som avslører sensitiv informasjon. Disse maskeres **ikke** — du må selv sørge for at alternativene ikke er identifiserende.

## Automatisk PII-maskering

Lumi maskerer personopplysninger automatisk i **fritekst-svar** ved lagring *og* ved lesing. Følgende mønstre fanges opp: fødselsnummer, Nav-ident, e-post, telefonnummer, kortnummer, kontonummer og hemmelig adresse.

Maskeringen erstatter sensitive data med plassholdere som `[FØDSELSNUMMER FJERNET]`, slik at klartekst aldri lagres i databasen.

::: warning Maskering gjelder kun fritekst-svar
URL-er, pathname, context-tags og svaralternativer maskeres **ikke** automatisk. Du er selv ansvarlig for at disse feltene ikke inneholder personopplysninger.
:::

Se [Sikkerhet & personvern](/referanse/sikkerhet#pii-maskering) for fullstendig liste over mønstre og eksempler.

## Bruk av fritekstfelt

Lumi maskerer automatisk de vanligste personopplysningene i fritekst. Du trenger ikke sette opp egne filtre eller gjøre manuelle sjekker.

Likevel bør du:

- **Vurdere om du trenger fritekst.** Lukkede spørsmål gir strukturerte data og eliminerer risikoen helt.
- **Informere brukerne.** Hvis du bruker fritekstfelt, legg til en kort tekst som ber brukerne unngå å skrive personopplysninger.
- **Sjekke svarene jevnlig** i dashboardet, spesielt etter lansering. PII-maskeringen dekker de vanligste mønstrene, men kan ikke fange alt.

## Før du publiserer

Sjekkliste før du lanserer en survey:

- [ ] Etterlevelsesdokumentasjon er på plass
- [ ] Spørsmålene samler ikke inn personopplysninger bevisst
- [ ] Fritekstfelt har veiledningstekst om å unngå personopplysninger
- [ ] URL-er og pathname du samler inn inneholder ikke sensitive parametere (fødselsnummer, tokens osv.)
- [ ] Svaralternativer avslører ikke sensitiv informasjon om brukeren
- [ ] Du har testet surveyen i dev-miljø

## Brukerstøtte

Trenger du hjelp?

- **Slack**: [#lumi](https://nav-it.slack.com/archives/C0AG2FKSSMD) — spørsmål, feilmeldinger og forslag
- **GitHub**: [navikt/lumi](https://github.com/navikt/lumi/issues) — rapporter bugs eller be om funksjonalitet

## Se også

- [Sikkerhet & personvern](/referanse/sikkerhet) — PII-maskering, rate limiting og penetrasjonstest
- [Datakontrakt](/referanse/datakontrakt) — full spesifikasjon av hva widgeten sender
- [Tilgang](/dashboard/tilgang) — hvem som har tilgang til dashboardet
