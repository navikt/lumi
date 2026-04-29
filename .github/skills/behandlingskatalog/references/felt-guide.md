# Felt-guide for Lumis behandling

Hvert felt i Behandlingskatalogen med ferdig tekstutkast for Lumi. Kopier inn og tilpass ved behov.

## 1. Overordnet behandlingsaktivitet

Velg fra nedtrekksmeny: **Innsiktsarbeid**

## 2. Navn

```
Innsiktsarbeid: Personvernvennlige brukerundersøkelser med Lumi
```

## 3. Formål

```
Skaffe innsikt om brukernes opplevelse av Nav-tjenester gjennom anonyme
tilbakemeldinger, for å forbedre tjenestene. Konkrete formål per undersøkelse
dokumenteres i etterlevelse E449.
```

## 4. Ytterligere beskrivelse

```
Lumi er et internt Nav-verktøy for spørreundersøkelser på interne og eksterne
flater. Personopplysninger samles ikke inn tilsiktet. Fritekst-svar gjennomgår
automatisk PII-maskering ved lagring og lesing. Svarene er anonyme — ingen
brukeridentifikator lagres.
```

## 5. Behandlingsgrunnlag

**Art. 6(1)(a) – Samtykke**

Brukeren velger selv å svare. På eksterne flater dekker Nav-dekoratørens cookie-banner kategorien «surveys». På interne flater er deltakelse frivillig.

## 6. Er behandlingen innført?

**Ja**

## 7. Gyldighetsperiode

Startdato: datoen Lumi ble tatt i bruk i produksjon.
Sluttdato: `31.12.9999` (løpende).

## 8. Personkategorier

- **Besøkende** — brukere som svarer på undersøkelser
- **Ansatte i NAV** — dashboard-brukere som leser og administrerer svar

## 9. Organisering

- Avdeling: **Avdeling for digitalisering**
- Team: **Team eSyfo**

## 10. Felles behandlingsansvarlig

**Nei**

## 11. System

**Lumi** (allerede registrert i katalogen)

## 12. Helautomatisk behandling

**Nei** — ingen beslutninger fattes automatisk basert på svarene.

## 13. Profilering

**Nei** — svar brukes til aggregert innsikt, ikke profilering av enkeltpersoner.

## 14. KI-systemer benyttes

**Nei**

## 15. Personopplysninger gjenbrukes til KI

**Nei**

## 16. Databehandler benyttes

**Ja: Google Cloud Platform (GCP)**

Lumi kjører på NAIS-plattformen i GCP (region `europe-north1`). Ingen ekstern SaaS-leverandør.

## 17. Utleveres personopplysninger eksternt?

**Nei**

## 18. Overføring til tredjeland

**Nei** — alle data lagres i `europe-north1` (Finland).

## 19. Lagringsbehov

```
Omfattes ikke av Navs bevarings- og kassasjonsvedtak. Ingen automatisk
slettejobb. Manuell sletting av enkeltsvar eller hele surveys er tilgjengelig
i Lumi-dashboardet.
```

## 20. PVK (personvernkonsekvensvurdering)

**Nei**

Begrunnelse: Ingen særlige kategorier personopplysninger behandles. Fritekst-svar gjennomgår automatisk PII-maskering. Vurderingen er dokumentert i ROS-analysen i TryggNok og pentest fra team SåPe (feb 2026, ingen høye/kritiske funn).

## 21. Status

Sett til **Ferdig dokumentert** når alle felt er fylt ut.

---

## Tips

- **Kopier tekstutkastene** direkte inn i Behandlingskatalogen og tilpass formuleringer ved behov.
- **Formål-feltet** bør være kort og peke til E449 for detaljer — unngå å gjenta alt som står i etterlevelsesdokumentasjonen.
- **Ytterligere beskrivelse** kan utdypes med tekniske detaljer om maskeringslogikken hvis ønskelig.
- Hvis Lumi får nye opplysningstyper (f.eks. nye metadata-felt), oppdater behandlingen og legg til opplysningstypen.
