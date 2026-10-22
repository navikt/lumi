---
title: Les resultatene
---

# Les resultatene

Velg en survey i filterlinjen for å se analysen for oppsettet dere valgte i Surveyverksted. Med **Alle surveys** i surveylisten viser **Dashboard** en samlet oversikt over svarene til teamet.

Dette får dere for hver type:

- [Vurdering og Custom](#vurdering-og-custom): fordelingen av svarene og utviklingen over tid, og dere kan [sammenligne to perioder](#sammenlign)
- [Top Tasks](#top-tasks): hvor mange som lyktes med hver oppgave, og hva som hindret dem
- [Discovery](#discovery): hva brukerne kom for å gjøre, med egne ord
- [Task Priority](#task-priority): hvilke oppgaver som får flest stemmer

## Oversikten over alle surveyer {#oversikt}

Oversikten har tre kort øverst: **Periode**, **Tilbakemeldinger** og **Med tekst**. Under dem står grafen **Antall tilbakemeldinger**, og nederst fordelingen per app, enhet og surveytype. Med en app valgt gjelder tallene bare den appen.

Hver dag i grafen **Antall tilbakemeldinger** lenker til **Tilbakemeldinger** med svarene fra den dagen, og det samme gjør de andre grafene med antall svar per dag.

## Når én survey er valgt {#en-survey}

Med **Alle surveys** viser dashboardet bare oversikten, også når alle svarene kommer fra samme type survey. Velger dere én survey, bytter visningen til analysen for typen, og typen står som en merkelapp ved siden av overskriften **Dashboard**. Dashboardet bruker andre navn på typene enn Surveyverksted:

| Merkelapp i dashboardet | Valg i Surveyverksted |
| :--- | :--- |
| **Vurdering** | **Hvordan opplevde brukeren tjenesten?** |
| **Top Tasks** | **Lyktes brukeren med en kjent oppgave?** |
| **Discovery** | **Hva kom brukeren for å gjøre?** |
| **Task Priority** | **Hvilke oppgaver er viktigst?** |
| **Custom** | **Noe annet** |

Hvilket oppsett som passer til hva, står i [Velg hva dere vil måle](/guider/surveytyper).

Alle visningene har kortet **Enheter**. **Segmentering** kommer i tillegg når appen sender med segmenteringstags. Et klikk på en verdi i et av kortene filtrerer hele visningen på den, se [Filtrering](/dashboard/filtrering#hvor).

I **Top Tasks**, **Discovery** og **Task Priority** ligger kortet **Utvikling over tid** nederst. Der velger dere et vurderings- eller valgspørsmål under **Spørsmål** og ser svarene per **Dag**, **Uke** eller **Måned**.

## Vurdering og Custom {#vurdering-og-custom}

**Vurdering** og **Custom** har samme visning. Øverst ligger **Periode** sammen med bryteren **Sammenlign med forrige periode**.

Kortet **Tilbakemeldinger** viser antall innsendinger i perioden. En **Vurdering**-survey med ett vurderingsspørsmål får et kort til, og en graf som viser vurderingen over tid:

| Skala i surveyen | Kort | Slik regnes tallet |
| :--- | :--- | :--- |
| Emoji eller stjerner | **Snitt vurdering** | Gjennomsnittet på skalaen fra 1 til 5 |
| Tommel opp eller ned | **Positiv rate** | Andelen som svarte tommel opp |
| NPS | **NPS** | Andelen som svarte 9 eller 10, minus andelen som svarte 0 til 6. Tallet går fra −100 til +100 |

I grafen kan dere legge inn en markør for en dato, for eksempel dagen en endring ble satt i produksjon. Velg **Markør**, fyll inn **Dato** og **Tittel**, og velg **Opprett markør**. Markøren vises i grafen og i listen **Markører**.

### Statistikk per felt

Under **Statistikk per felt** har hvert spørsmål sitt eget kort. Vurderings- og valgspørsmål viser hvordan svarene fordeler seg. Velg et svaralternativ for å filtrere hele visningen på det. Fritekstspørsmål viser **Uttrykk som går igjen** eller **Hyppigste ord**, og **Siste svar**.

Velg **Se utvikling** i et kort for å se svarene på spørsmålet over tid. Under **Tidsintervall** velger dere **Dag**, **Uke** eller **Måned**. For valgspørsmål velger dere også om grafen skal vise **Andel** eller **Antall**. Når brukeren kan velge flere alternativer, kan andelene til sammen bli over 100 prosent.

### Sammenligne to perioder {#sammenlign}

Slå på **Sammenlign med forrige periode** for å sammenligne den valgte perioden med perioden like før. Begge periodene får de samme filtrene. Kortene øverst viser da **Endring**, og kortene under **Statistikk per felt** får kolonnene **Valgt**, **Før** og Endring. Endringer i andeler står i prosentpoeng (pp).

Perioden før har like mange dager og slutter dagen før den valgte perioden starter. Ved hele kalendermåneder eller et helt kalenderår valgt med **Egendefinert periode** sammenligner dashboardet med like mange måneder før, eller med året før. Under bryteren står datoene dashboardet sammenligner med.

Er periodene ulike lange, for eksempel februar mot januar, sier dashboardet fra. Da kan antall svar ikke sammenlignes direkte. Sluttdatoen kan ikke være senere enn i dag. Når dagen i dag er med, står det **Inkluderer i dag · foreløpig sammenligning**, fordi dagen ikke er over.

## Top Tasks {#top-tasks}

I en Top Tasks-survey velger brukeren en oppgave fra listen og svarer på om hen fikk den gjort. Standardsvarene er «Ja», «Delvis» og «Nei». Ved andre svar enn «Ja» kan surveyen spørre hva som hindret hen.

### Kortene øverst

| Kort | Slik regnes tallet |
| :--- | :--- |
| **Antall svar** | Alle innsendinger med en valgt oppgave |
| **Suksessrate** | Andelen av alle svarene der brukeren svarte «Ja» |
| **Ikke fullført** | Andelen av alle svarene der brukeren svarte «Delvis» eller «Nei». Tallet er 100 minus **Suksessrate** |

Finnes det ingen svar, viser **Suksessrate** og **Ikke fullført** en strek (–).

Grafen **Suksessrate over tid** viser andelen «Ja» per dag.

### Oppgavekvadranten

I **Oppgavekvadrant** er hver oppgave et punkt. Den vannrette aksen viser **Volum (antall svar)**, og den loddrette viser **Suksessrate**. Stiplede linjer går ved 50 svar og 70 prosent og deler diagrammet i fire felt. Musepekeren over et punkt viser hvilket felt oppgaven er i:

| Felt | Antall svar | Suksessrate |
| :--- | :--- | :--- |
| **KRISE** | 50 eller flere | Under 70 prosent |
| **OVERVÅK** | Under 50 | Under 70 prosent |
| **BRA** | 50 eller flere | 70 prosent eller mer |
| **LAV PRIORITET** | Under 50 | 70 prosent eller mer |

Klikk på et punkt for å filtrere hele dashboardet på den oppgaven. Klikk på det samme punktet igjen for å fjerne filteret.

### Tabellen over oppgavene

Tabellen har én rad per oppgave. Oppgavene med mange svar og lav suksessrate står øverst.

| Kolonne | Innhold |
| :--- | :--- |
| **Oppgave** | Oppgaven slik den står i surveyen |
| **Suksessrate** | Andelen «Ja» for oppgaven |
| **Svar** | Alle svarene på oppgaven |
| **Ja** | Antall «Ja» |
| **Delvis** | Antall «Delvis» |
| **Nei** | Antall «Nei» |

Kolonnene **Delvis** og **Nei** vises ikke på smale skjermer.

Har teamet skrevet om teksten på en oppgave, viser tabellen den nyeste teksten. Svarene telles på oppgavens ID, se [Survey-identitet og endringer](/guider/survey-identitet).

### Hindringene

**Det som hindrer brukerne** bygger på fritekstsvarene om hva som hindret brukeren. Under **Hindringer som går igjen** står uttrykk som finnes i minst to svar. Hvert uttrykk lenker til svarene det kommer fra under **Tilbakemeldinger**. **Eksempler fra brukerne** viser noen av svarene. Har dere valgt en oppgave i oppgavekvadranten, viser seksjonen bare hindringene for den oppgaven.

Under **Egne hindringstemaer** kan dere lage temaer med **Nytt tema**. Et tema samler svarene som inneholder nøkkelordene dere velger, og ett svar kan høre til flere temaer. Svar som ikke passer i noe tema, står under **Uten tema**.

## Discovery {#discovery}

I en Discovery-survey skriver brukeren med egne ord hva hen kom for å gjøre, og svarer på om hen fikk det gjort.

Visningen har kortene **Periode**, **Tilbakemeldinger** og **Tekstsvar**, og grafen **Antall svar over tid**. **Det brukerne prøver å gjøre** viser **Oppgaver som går igjen**: uttrykk som finnes i minst to svar, med lenke til svarene. **Eksempler fra brukerne** viser enkeltsvar. De kan vise om brukeren kom i mål (**Ja**, **Delvis** eller **Nei**) og hva som hindret hen.

Under **Egne oppgavetemaer** lager dere temaer med **Nytt tema**. Svar som ikke treffer noen av temaene, samles under **Uten tema**.

Discovery har ingen egen oversikt over hindringene. Dere leser dem i eksemplene og under **Tilbakemeldinger**.

## Task Priority {#task-priority}

I en Task Priority-survey velger brukeren de oppgavene som er viktigst for hen. Hver valgt oppgave er én stemme, så én bruker kan gi flere stemmer.

| Kort | Innhold |
| :--- | :--- |
| **Antall svar** | Antall innsendinger |
| **Long Neck** | Hvor mange av de øverste oppgavene som til sammen har minst 80 prosent av stemmene |
| **Top 5 dekning** | Andelen av stemmene som de fem øverste oppgavene har til sammen |

Listen **Task Priority - "Long Neck"** viser de 15 oppgavene med flest stemmer, med antall stemmer og andel av alle stemmene. En linje i listen viser hvor Long Neck slutter. Under listen står det hvor mange oppgaver til som har fått stemmer, hvis det er flere enn 15.

Grafen **Antall svar over tid** viser antall svar per dag. Et svar med tre valgte oppgaver telles én gang.

## Små utvalg {#sma-utvalg}

**Det brukerne prøver å gjøre** i Discovery og **Det som hindrer brukerne** i Top Tasks har en merkelapp som viser hvor mange svar analysen bygger på:

| Merkelapp | Antall svar |
| :--- | :--- |
| **Få svar** | Under 30 |
| **Noen svar** | 30–100 |
| **Mange svar** | Over 100 |

For hindringene telles bare svarene der brukeren har skrevet en hindring.

Med **Få svar** viser dashboardet først de fem siste svarene under **Svarene så langt**, og uttrykkene står under **Tidlige mønstre**. Les de enkelte svarene før dere trekker konklusjoner. Et uttrykk som finnes i to av 15 svar, sier lite om hva de fleste brukerne opplever.

Resten av dashboardet viser tall uansett hvor få svar det er, også når det bare er ett. Med ti svar flytter ett enkelt svar en andel med ti prosentpoeng. Sjekk derfor **Antall svar** eller **Tilbakemeldinger** før dere tolker en andel eller en endring. I oppgavekvadranten havner alle oppgaver med under 50 svar til venstre for den stiplede linjen.

## Når perioden har for mange svar {#for-mange-svar}

Har perioden for mange svar, står varselet **Perioden har for mange svar** der analysen skulle vært. Det gjelder analysene i **Top Tasks**, **Discovery** og **Task Priority**, **Det som hindrer brukerne** og **Segmentering** med en valgt oppgave. Lumi regner dem ut fra hvert enkelt svar, og grensen er 10 000 svar. Den er lavere når svarene er store, for eksempel når spørsmålene har mange svaralternativer.

**Vis de siste 30 dagene i perioden** setter perioden til de siste 30 dagene av perioden dere hadde valgt. Er perioden 30 dager eller kortere, heter knappen **Vis de siste 7 dagene i perioden**. Er den sju dager eller kortere, er det ingen knapp. Et filter på enhet gjør også utvalget mindre.

I **Discovery** og **Task Priority** vises **Antall svar over tid**, **Enheter** og **Segmentering** selv om analysen mangler. I **Top Tasks** vises **Enheter**, og **Segmentering** når dere ikke har valgt en oppgave.

Grensen gjelder også **Tilbakemeldinger** og **Eksporter** når dere filtrerer på oppgave, tema eller uttrykk. Lumi bruker de filtrene etter at svarene i perioden er hentet. Velg en kortere periode, eller fjern filteret.

## Les og slett enkeltsvar {#tilbakemeldinger}

Under **Tilbakemeldinger** i menyen leser dere svarene ett og ett. Filtrene fra **Dashboard** følger med. Tabellen har kolonnene **Dato**, **Tilbakemelding** og **App** og viser 20 svar per side. På mobil vises svarene som kort, og **Vis mer** åpner hele svaret.

Klikk på en rad for å åpne svaret. Da ser dere:

- **Svar**, med alle svarene i innsendingen
- **Tags**, der dere legger til tags med **Legg til tag**
- **Kontekst**, med **Side**, **Enhet**, **Viewport** og **Skjermoppløsning**
- **Segment** og **Metadata** når appen har sendt med slike verdier
- svarets ID og survey-ID nederst

Merkelappen **Redigert** betyr at Lumi har maskert tekst som så ut som personopplysninger, se [PII-maskering](/referanse/sikkerhet#pii-maskering). Tags dere legger til, kan dere filtrere på, se [Tags](/dashboard/filtrering#tags).

### Slett ett svar

1. Klikk på søppelbøtta i raden.
2. Velg **Slett** i dialogen **Slett tilbakemelding**.

### Slett alle svarene på en survey

1. Velg surveyen i filterlinjen.
2. Velg **Slett alle svar** over tabellen.
3. Kryss av for **Ja, slett permanent alle … svar**, og velg **Slett … svar permanent**.

Alle svarene på surveyen slettes, også svarene som filtrene eller perioden skjuler. Markørene slettes også, men surveydefinisjonen blir liggende. Slettingen stopper ikke nye svar, så fjern widgeten fra appen hvis dere ikke vil ha flere.

Alle i teamet kan slette svar, og slettingen kan ikke angres. Svarene slettes fra databasen med en gang, men kan ligge i sikkerhetskopiene en stund, se [Lagringstid og sletting](/referanse/sikkerhet#lagringstid).

## Arkiverte surveyer {#arkiverte}

En arkivert survey skjules i dashboardet for hele teamet. Ingen svar slettes, og appen kan fortsatt sende inn svar.

Slik arkiverer dere en survey:

1. Velg surveyen i filterlinjen under **Tilbakemeldinger**.
2. Velg **Arkiver** over tabellen.
3. Velg **Arkiver survey** i dialogen.

Når teamet har minst én arkivert survey, kommer bryteren **Arkiverte** i filterlinjen, med antallet i parentes. Med bryteren av er svarene på arkiverte surveyer ikke med noe sted, heller ikke i oversikten eller i eksporten. Med bryteren på kommer de arkiverte surveyene i en egen gruppe Arkiverte i surveylisten, og svarene deres blir med på **Dashboard**, **Tilbakemeldinger** og **Eksporter**. Slår dere av bryteren mens en arkivert survey er valgt, går listen tilbake til **Alle surveys**.

For å hente en arkivert survey tilbake slår dere på **Arkiverte**, velger surveyen og velger **Gjenopprett** over tabellen. En arkivert survey som fortsatt får svar, er merket **Mottar fortsatt innsendinger** i linjen over tabellen.
