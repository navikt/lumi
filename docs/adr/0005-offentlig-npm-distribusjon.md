---
title: "ADR 0005: Lumi Survey distribueres offentlig via npmjs"
status: Akseptert
date: 2026-08-27
---

# ADR 0005: Lumi Survey distribueres offentlig via npmjs

- **Status:** Akseptert
- **Dato:** 2026-08-27
- **Berører:** #471, `@navikt/lumi-survey`

## Kontekst

`@navikt/lumi-survey` er en offentlig MIT-lisensiert widget som skal kunne tas
i bruk av team i hele Nav. GitHub Packages krever autentisering også ved lesing
av offentlige npm-pakker. Konsumenter måtte derfor konfigurere hele
`@navikt`-scopet mot GitHub Packages og håndtere et GitHub-token lokalt, i CI og
i containerbygg bare for å installere widgeten.

Scope-konfigurasjonen flytter samtidig offentlige Aksel-pakker fra npmjs til
GitHub Packages. Det gjør konsumentene avhengige av et speil de ikke ellers
trenger.

Lumi-monorepoet har et annet behov enn widgetkonsumentene. Dashboardet bruker
blant annet `@navikt/oasis` og `@navikt/pino-logger`, som ikke distribueres på
npmjs. Repoets egen GitHub Packages-konfigurasjon kan derfor ikke fjernes som
del av widgetens registerbytte.

## Beslutning

1. **npmjs er widgetens primære register.** Konsumenter installerer
   `@navikt/lumi-survey` anonymt uten `.npmrc` eller GitHub-token.
2. **GitHub Packages beholdes som kompatibilitetsspeil.** Hver release
   publiserer samme tarball og versjon til begge registre, slik at eksisterende
   konsumenter ikke må migrere samtidig.
3. **npmjs-publisering bruker trusted publishing.** GitHubs
   `id-token: write`-permission lar npm verifisere akkurat denne workflowen med
   en kortlivet identitet; ingen langlivet npm-hemmelighet lagres i repoet.
   Offentlige releaser får provenance som knytter pakken til workflowen og
   kildekoden i `navikt/lumi`. Trusted publisher bindes også til GitHub
   Actions-environmentet `npm-publish`, som bare tillater beskyttede branches.
   `main` er repoets eneste beskyttede branch. Sammen med workflowens eksplisitte
   `main`-sjekk hindrer dette at en endret kopi av workflowen publiserer fra en
   feature-branch. Hvis repoet får flere beskyttede branches, skal environmentet
   strammes inn til en eksplisitt `main`-regel.
4. **Førstegangspublisering er en kontrollert bootstrap.** npm krever at en
   pakke allerede finnes før trusted publisher kan konfigureres. En bruker som
   npm-administratorene har gitt publiseringstilgang, publiserer derfor den
   eksisterende `2.1.0`-tarballen fra GitHub Packages én gang og konfigurerer
   deretter `navikt/lumi`,
   `publish-lumi-survey.yaml` og `npm-publish` som trusted publisher. Tarballen
   bygges ikke på nytt, og digestene verifiseres i begge registre.
5. **Publisering tåler omkjøring.** npmjs publiseres før speilet. Hvis en
   versjon allerede finnes, hoppes den bare over når registerets SHA-1- og
   SHA-512-digester er identiske med den lokale tarballen. Et avvik stopper
   releasen. Release-tag opprettes først etter begge registre.
6. **Monorepoets registry-oppsett beholdes.** `.npmrc`, `READER_TOKEN` og
   tilhørende installasjonsoppsett er fortsatt nødvendig for interne
   `@navikt`-avhengigheter. Konsumentdokumentasjonen skal ikke arve dette
   interne behovet.
7. **Release-rettigheter separeres.** Pakking og preflight skjer read-only.
   npmjs-jobben får bare `id-token: write`, speiljobben får bare
   `packages: write`, og taggjobben får bare `contents: write`. Det samme
   verifiserte workflow-artefaktet brukes i begge registre.
8. **npmjs er et bevisst unntak fra Navs hovedregel.** Nav anbefaler GitHub
   Packages for interne pakker fordi npmjs ikke har SSO. Lumi Survey er derimot
   en offentlig, MIT-lisensiert konsumentpakke der anonym installasjon er et
   eksplisitt mål. Konsumenter trenger ingen npm-konto. Menneskelig tilgang til
   `@navikt` på npmjs begrenses til npm-administratorer og de få Lumi-
   maintainerne som trenger å forvalte pakkeoppsettet. Ordinær publisering skjer
   med trusted publishing, ikke med personlige eller langlivede tokens.

## Konsekvenser

### Positivt

- Nye konsumenter kan installere widgeten med en vanlig package-manager-kommando.
- Ingen npm-publiseringstoken må lagres eller roteres i GitHub.
- Provenance gjør koblingen mellom pakke, kildekode og release-workflow
  etterprøvbar.
- Eksisterende GitHub Packages-konsumenter fortsetter å fungere.
- Delvis feilslåtte releaser kan kjøres på nytt uten å overskrive eller skjule
  en versjon med annet innhold.

### Kostnad

- To registre må publiseres og overvåkes per release.
- Den første npmjs-publiseringen og trusted-publisher-oppsettet krever en
  manuell handling fra en bruker som npm-administratorene har gitt tilgang.
- npmjs mangler SSO. Medlemskap, rolleendringer og fjerning av menneskelig
  tilgang må derfor fortsatt forvaltes manuelt sammen med npm-administratorene.
- Lumi-repoet beholder GitHub Packages-autentisering selv om widgetkonsumentene
  ikke trenger den.

Denne kostnaden holdes avgrenset ved at konsumenter aldri trenger medlemskap,
at antallet maintainere holdes lavt, og at releaser ikke er avhengige av en
persons npm-token.

## Vurderte alternativer

### Kun GitHub Packages

Forkastet fordi alle konsumenter da må håndtere autentisering for en offentlig
pakke og samtidig flytte hele `@navikt`-scopet til GitHub Packages.

### Hard overgang til kun npmjs

Forkastet fordi eksisterende konsumenter kan ha låst registry-oppsett og fordi
monorepoet fortsatt trenger GitHub Packages for interne avhengigheter.

### Langlivet npm-token i GitHub Actions

Forkastet fordi trusted publishing støttes av npmjs og gir kortlivede,
workflow-avgrensede credentials og automatisk provenance.
