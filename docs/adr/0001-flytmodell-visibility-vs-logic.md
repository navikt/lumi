---
title: "ADR 0001: Flytmodell — `visibleIf` som kanonisk, `logic` som escape hatch"
status: Akseptert
date: 2026-06-24
---

# ADR 0001: Flytmodell for surveys — `visibleIf` som kanonisk modell, `logic` som escape hatch

- **Status:** Akseptert
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
- `createTopTasksSurvey` (førsteparts-preset, `topTasks`-surveytypen) var den
  siste førstepartsbruken av `logic`. Den er migrert til `visibleIf` i #359;
  verdi-operatorene aktiverer fortsatt implisitt steg-modus under `"auto"`.

Konklusjon: vi kan ikke rive ut `logic`. Men vi kan slutte å behandle den som en likestilt modell.

## Beslutning

1. **Ett betingelseslag.** Leaf-betingelsen (`questionId`, operatorer, `METADATA`) er det *eneste* betingelsesspråket, og begge evaluatorene resolver leaf-svar identisk via det delte laget (`isLeafCondition` / `getLeafConditions`). #332-fiksen tok første steg: `evaluateBranching` tar nå `answers` og speiler `evaluateVisibility`. **Levert i #333:** any/all-grupper ble lagt på `visibleIf` via en egen vid type (`VisibleIfCondition`), mens `LogicCondition` forble leaf-only og `logic` avviser grupper. Full evaluator-unifisering er bevisst utsatt (se Oppfølging).

2. **`visibleIf` er den kanoniske flytmodellen.** Den mentale modellen vi dokumenterer, anbefaler og har bygget Surveyverksted (#338) rundt er: *ordnet liste → filtrer på synlighet → gå gjennom de synlige i rekkefølge → send inn når ingen flere er synlige.* Surveyverksted eksponerer dette som standard.

3. **`logic` degraderes til en legacy escape hatch for ekte ikke-lineær kontroll** (primært `JUMP_TO`). Den forblir støttet og fungerende for eksisterende flat config (den har live konsumenter), men:
   - dokumenteres som «avansert», ikke som en sidestilt førstevalgs-modell,
   - utvides ikke med ny funksjonalitet utover det delte betingelseslaget,
   - eksponeres ikke i den nye page-baserte authoringmodellen eller builder-UI-en (#338), se ADR 0003.

4. **Migrer førstepartsbruk vekk fra `logic` der det er triviell-ekvivalent.**
   Levert i #359: `createTopTasksSurvey` uttrykker nå `otherTask` og `blocker`
   med `visibleIf`. Førsteparts-avhengigheten av `logic` er dermed null.

5. **Dokumenter `logic` som eldre kompatibilitetsstøtte etter #333 + #338.** Mekanismen fjernes fra hoveddokumentasjonen, men beholdes i runtime for eksisterende konsumenter. Full API-deprecation vurderes først i en senere, versjonert beslutning.

## Konsekvenser

**Positivt**
- Én mental modell for forfattere og for builder-UI-en (#338).
- AND/OR (#333) bygger på det delte leaf-laget; gruppene ble lagt på `visibleIf` (via `VisibleIfCondition`), ikke på `logic`.
- Ingen brudd: `logic` fortsetter å virke for eksisterende konsumenter;
  `createTopTasksSurvey` beholder samme standardflyt via `visibleIf`.
- Divergens-bugen (#332-klassen) forhindres ved at de to evaluatorene nå deler resolusjonslogikk.

**Negativt / kostnad**
- Krever å holde to evaluatorer i synk inntil (eventuell) deprecation — vi aksepterer dette mot å holde `logic` fungerende.
- Automatisk layout må skille verdi-baserte synlighetsgrener fra `EXISTS`-basert
  progressiv avdekking; bare førstnevnte aktiverer steg-modus.
- `branching.md` beholdes som en kort, ikke-søkbar kompatibilitetsside. Nye guider bruker bare `visibleIf`.

## Vurderte alternativer

- **A. Status quo (behold begge likestilt).** Forkastet: viderefører den overlappende modellen rett inn i Survey Builder (#338) og dobler #333-arbeidet.
- **B. Full deprecation av `logic` nå.** Forkastet (for tidlig): bryter live konsumenter, og vi har ikke bekreftet at ingen trenger ekte `JUMP_TO`. Holdes åpen som mulig endestasjon (punkt 5).
- **C. (valgt) Kanonisk `visibleIf` + `logic` som escape hatch + delt betingelseslag.** Pragmatisk: ingen brudd, én modell utad, #333 én gang, klar retning for #338.

## Oppfølging

- [x] #333: implementer AND/OR i `visibleIf` (levert: `any`/`all`-grupper i
  `visibleIf`; `logic` snevret til leaf. Evaluator-unifisering bevisst utsatt —
  operator-divergensen lever videre, men kun i den utfasede `logic`-mekanismen.)
- [x] Erstatt `docs/guider/branching.md` med en ikke-søkbar kompatibilitetsside og samle migreringsråd på én side.
- [x] #338: bygg Surveyverksted rundt den sidebaserte synlighetsmodellen i ADR 0003; ikke generer `logic`.
- [x] #359: migrer `createTopTasksSurvey` `SKIP`/`SUBMIT` → `visibleIf`, og la
  verdi-baserte `visibleIf`-grener aktivere steg-modus under `"auto"`.
- [x] Etter #333+#338: fjern `logic` fra anbefalt dokumentasjon, men behold runtime-støtten i 2.x. Full API-deprecation krever en egen beslutning.
