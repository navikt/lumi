---
title: "ADR 0001: Flytmodell — `visibleIf` som kanonisk, `logic` som escape hatch"
status: Foreslått
date: 2026-06-24
---

# ADR 0001: Flytmodell for surveys — `visibleIf` som kanonisk modell, `logic` som escape hatch

- **Status:** Foreslått
- **Dato:** 2026-06-24
- **Berører:** #332 (fikset), #333 (AND/OR), #336 (flere spørsmål per steg), #338 (Survey Builder UI)

## Kontekst

`@navikt/lumi-survey` har i dag **to** mekanismer for betinget flyt, dokumentert som to separate guider:

| Mekanisme | Guide | Hva den gjør |
| :-- | :-- | :-- |
| `visibleIf` | `betinget-synlighet.md` | Deklarativ synlighet: «er dette spørsmålet med i det aktive settet?» |
| `logic` | `branching.md` | Imperativ flytkontroll: `JUMP_TO` / `SKIP` / `SUBMIT` etter at et spørsmål er besvart |

De deler samme `LogicCondition`-type (operatorer, `questionId`, `METADATA`), men har **to separate evaluatorer**:

- `evaluateVisibility(condition, answers, metadata)` — tar hele svar-mappet, slår opp `answers[condition.questionId]`. Korrekt kryss-spørsmål-støtte, med tester.
- `evaluateBranching(...)` / `evaluateCondition(...)` — fikk historisk bare `currentAnswer` og **ignorerte `condition.questionId`**. Kryss-spørsmål var stille ødelagt (#332).

### Hvorfor dette er et problem nå

1. **Stille divergens.** Den ene evaluatoren ble vedlikeholdt, den andre råtnet. #332 var symptomet: en regel som rutet på et tidligere svar matchet feil regel, og knappen viste «Send» der den skulle vist «Neste». Dokumentasjonen hedger til og med selv (`branching.md` linje 64: «for `logic` evalueres betingelsen *vanligvis* mot det gjeldende spørsmålets svar») — «vanligvis» er smell-en.
2. **Overlappende mental modell.** De fleste flytbehov kan uttrykkes på *begge* måter. En forfatter må lære «når bruker jeg hva?». Det er nettopp det som lurte utvikleren i #332 — hans behov («vis siste spørsmål hvis *ett av to* svar er "Nei"») er egentlig et `visibleIf`-case; han grep til `logic` fordi `visibleIf` ikke støtter OR ennå (#333).
3. **Kommende oppgaver tvinger en avgjørelse:**
   - **#338 (Survey Builder UI):** designere bygger surveys i et UI og får en kodesnutt. To overlappende flytmodeller betyr at byggeren må forklare og generere *begge* — dobbelt så forvirrende UX.
   - **#333 (AND/OR):** hvis betingelseslaget er delt, implementeres AND/OR **én gang** og begge mekanismene arver det. Implementeres det per-mekanisme, dobles arbeidet.

### Hva `logic` faktisk kan som `visibleIf` ikke kan

Bare **ekte ikke-lineære hopp** (`JUMP_TO` til et vilkårlig mål, særlig bakover).

- `SKIP` = «skjul neste» → uttrykkbart med `visibleIf`.
- `SUBMIT`-tidlig = «ingen synlige spørsmål etter dette» → uttrykkbart med `visibleIf` (skjul de etterfølgende).
- `JUMP_TO` framover-som-hopper-over = uttrykkbart med `visibleIf` på de oversprungne.

For en **mikro-feedback-widget** med korte skjemaer er ekte vilkårlige hopp sjeldne.

### Bindinger vi ikke kan ignorere

- `logic` er **dokumentert offentlig** og brukes av konsumenter (bl.a. teamet i #332, live i NAV nå).
- `createTopTasksSurvey` (førsteparts-preset, `topTasks`-surveytypen) **bruker `logic` under panseret** (`SKIP` + `SUBMIT`). Å fjerne `logic` krever migrering av denne.

Konklusjon: vi kan ikke rive ut `logic`. Men vi kan slutte å behandle den som en likestilt modell.

## Beslutning

1. **Ett betingelseslag.** Leaf-betingelsen (`questionId`, operatorer, `METADATA`) er det *eneste* betingelsesspråket, og begge evaluatorene resolver leaf-svar identisk via det delte laget (`isLeafCondition` / `getLeafConditions`). #332-fiksen tok første steg: `evaluateBranching` tar nå `answers` og speiler `evaluateVisibility`. **Levert i #333:** any/all-grupper ble lagt på `visibleIf` via en egen vid type (`VisibleIfCondition`), mens `LogicCondition` forble leaf-only og `logic` avviser grupper. Full evaluator-unifisering er bevisst utsatt (se Oppfølging).

2. **`visibleIf` er den kanoniske flytmodellen.** Den mentale modellen vi dokumenterer, anbefaler og bygger Survey Builder (#338) rundt er: *ordnet liste → filtrer på synlighet → gå gjennom de synlige i rekkefølge → send inn når ingen flere er synlige.* Builder-UI-en eksponerer dette som standard.

3. **`logic` degraderes til en escape hatch for ekte ikke-lineær kontroll** (primært `JUMP_TO`). Den forblir støttet og fungerende (den har live konsumenter), men:
   - dokumenteres som «avansert», ikke som en sidestilt førstevalgs-modell,
   - utvides ikke med ny funksjonalitet utover det delte betingelseslaget,
   - eksponeres i builder-UI-en (#338) kun bak en «avansert»-luke, ikke i hovedflyten.

4. **Migrer førstepartsbruk vekk fra `logic` der det er triviell-ekvivalent.** Når #333 (OR) lander, skriv om `createTopTasksSurvey` sine `SKIP`/`SUBMIT`-regler til `visibleIf` der oppførselen er identisk. Mål: redusere førsteparts-avhengigheten av `logic` mot null.

5. **Revurder full deprecation av `logic` etter #333 + #338**, basert på faktisk konsumentbruk. Hvis ekte `JUMP_TO`-bruk forblir nær null, kan `logic` deprecates med en migreringsguide. Denne ADR-en *forplikter ikke* til full fjerning — den setter retningen.

## Konsekvenser

**Positivt**
- Én mental modell for forfattere og for builder-UI-en (#338).
- AND/OR (#333) bygger på det delte leaf-laget; gruppene ble lagt på `visibleIf` (via `VisibleIfCondition`), ikke på `logic`.
- Ingen brudd: `logic` fortsetter å virke for eksisterende konsumenter og `createTopTasksSurvey`.
- Divergens-bugen (#332-klassen) forhindres ved at de to evaluatorene nå deler resolusjonslogikk.

**Negativt / kostnad**
- Krever å holde to evaluatorer i synk inntil (eventuell) deprecation — vi aksepterer dette mot å holde `logic` fungerende.
- Omskriving av `createTopTasksSurvey` (punkt 4) er reelt arbeid, gated på #333.
- `branching.md` må oppdateres: posisjoner `logic` som avansert, og klargjør linje 64 (kryss-spørsmål via `questionId` fungerer nå også i `logic` etter #332).

## Vurderte alternativer

- **A. Status quo (behold begge likestilt).** Forkastet: viderefører den overlappende modellen rett inn i Survey Builder (#338) og dobler #333-arbeidet.
- **B. Full deprecation av `logic` nå.** Forkastet (for tidlig): bryter live konsumenter og `createTopTasksSurvey`, og vi har ikke bekreftet at ingen trenger ekte `JUMP_TO`. Holdes åpen som mulig endestasjon (punkt 5).
- **C. (valgt) Kanonisk `visibleIf` + `logic` som escape hatch + delt betingelseslag.** Pragmatisk: ingen brudd, én modell utad, #333 én gang, klar retning for #338.

## Oppfølging

- [x] #333: implementer AND/OR i `visibleIf` (levert: `any`/`all`-grupper i
  `visibleIf`; `logic` snevret til leaf. Evaluator-unifisering bevisst utsatt —
  operator-divergensen lever videre, men kun i den utfasede `logic`-mekanismen.)
- [ ] Oppdater `docs/guider/branching.md` (avansert-posisjonering + linje 64-klargjøring).
- [ ] #338: bygg builder rundt synlighetsmodellen; `logic` bak «avansert»-luke.
- [ ] Etter #333: migrer `createTopTasksSurvey` `SKIP`/`SUBMIT` → `visibleIf`.
- [ ] Etter #333+#338: revurder full deprecation av `logic`.
