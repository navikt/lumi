import type { Slide, SlideProps } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import { Line, LineMap, MapText, Station } from "../../map";
import { RouteProgress } from "./RouteProgress";
import "./verksted.css";

/**
 * «Hva vil dere finne ut?» in Surveyverksted, as a line with one station per
 * setup (verbatim from the menu). On the first click the other setups leave,
 * the chosen one rises to the top, and its line carries on through the
 * questions the user gets, with the follow-up on a branch. The questions are
 * the defaults in `createTopTasksSurveyDocument` (packages/lumi-survey).
 */
const LINE_X = 160;
const LABEL_X = LINE_X + 22 + 30;
const FIRST_Y = 380;
const GAP = 104;
const rowY = (index: number) => FIRST_Y + index * GAP;
const LAST_Y = rowY(4);

const CHOICES = [
  "Hvordan opplevde brukeren tjenesten?",
  "Hva kom brukeren for å gjøre?",
  "Lyktes brukeren med en kjent oppgave?",
  "Hvilke oppgaver er viktigst?",
  "Noe annet",
] as const;
const CHOSEN = 2;
/** How far the chosen setup rises: to the first row. */
const RISE = rowY(CHOSEN) - FIRST_Y;

/**
 * The questions of «Lyktes brukeren med en kjent oppgave?», each with a note
 * under it, so the rows are further apart than the menu's.
 */
const QUESTION_GAP = 128;
const TASK_Y = FIRST_Y + QUESTION_GAP;
const SUCCESS_Y = TASK_Y + QUESTION_GAP;
const BRANCH_X = LINE_X + 96;
const BLOCKER_Y = SUCCESS_Y + 40 + (BRANCH_X - LINE_X) + 28;
const NOTE_GAP = 44;

function HvaVilDereVite({ step }: SlideProps) {
  const chosen = step >= 1;
  return (
    <div
      className={cx("slide", "finne-ut", chosen && "finne-ut--valgt")}
      style={cssVars({ "--finne-ut-rise": `${-RISE}px` })}
    >
      <p className="finne-ut__kicker">Surveyverksted</p>
      <h2 className="finne-ut__title">Hva vil dere finne ut?</h2>

      <LineMap label="Menyen «Hva vil dere finne ut?» i Surveyverksted, med fem valg: Hvordan opplevde brukeren tjenesten? Hva kom brukeren for å gjøre? Lyktes brukeren med en kjent oppgave? Hvilke oppgaver er viktigst? Noe annet. Med valget Lyktes brukeren med en kjent oppgave? får brukeren spørsmålene «Hva prøvde du å gjøre i dag?», «Klarte du det?» med Ja, Delvis eller Nei, og «Hva hindret deg?» bare ved Delvis eller Nei.">
        {/* The menu. It leaves with the other setups. */}
        <g className="finne-ut__leaves">
          <Line
            points={[
              [LINE_X, FIRST_Y],
              [LINE_X, LAST_Y],
            ]}
          />
          {CHOICES.map((choice, index) =>
            index === CHOSEN ? null : (
              <g key={choice}>
                <Station x={LINE_X} y={rowY(index)} />
                <MapText x={LABEL_X} y={rowY(index)} size={44} weight={700}>
                  {choice}
                </MapText>
              </g>
            ),
          )}
        </g>

        {/* The questions, on the chosen setup's line. */}
        <g className="finne-ut__questions" data-from={1}>
          <Line
            points={[
              [LINE_X, FIRST_Y],
              [LINE_X, SUCCESS_Y + 40],
              [BRANCH_X, SUCCESS_Y + 40 + (BRANCH_X - LINE_X)],
              [BRANCH_X, BLOCKER_Y],
            ]}
            radius={28}
          />
          <Station x={LINE_X} y={TASK_Y} />
          <MapText x={LABEL_X} y={TASK_Y - 18} size={44} weight={700}>
            «Hva prøvde du å gjøre i dag?»
          </MapText>
          <MapText
            x={LABEL_X}
            y={TASK_Y + NOTE_GAP - 14}
            size={32}
            weight={600}
            muted
          >
            et valg blant oppgavene dere legger inn
          </MapText>
          <Station x={LINE_X} y={SUCCESS_Y} />
          <MapText x={LABEL_X} y={SUCCESS_Y - 18} size={44} weight={700}>
            «Klarte du det?»
          </MapText>
          <MapText
            x={LABEL_X}
            y={SUCCESS_Y + NOTE_GAP - 14}
            size={32}
            weight={600}
            muted
          >
            Ja, Delvis eller Nei
          </MapText>
          <Station x={BRANCH_X} y={BLOCKER_Y} />
          <MapText x={BRANCH_X + 52} y={BLOCKER_Y - 18} size={44} weight={700}>
            «Hva hindret deg?»
          </MapText>
          <MapText
            x={BRANCH_X + 52}
            y={BLOCKER_Y + NOTE_GAP - 14}
            size={32}
            weight={600}
            muted
          >
            bare ved Delvis eller Nei
          </MapText>
        </g>

        {/* The chosen setup rises to the top of the line. */}
        <g className="finne-ut__chosen">
          <Station x={LINE_X} y={rowY(CHOSEN)} />
          <MapText x={LABEL_X} y={rowY(CHOSEN)} size={44} weight={800}>
            {CHOICES[CHOSEN]}
          </MapText>
        </g>
      </LineMap>

      <p className="finne-ut__dashboard" data-from={2}>
        Dashboardet viser hvor mange som klarte hver oppgave, og hva som hindret
        dem.
      </p>
      <RouteProgress at={0} />
    </div>
  );
}

export const hvaVilDereVite: Slide = {
  id: "hva-vil-dere-vite",
  title: "Hva vil dere finne ut?",
  steps: 2,
  notes: `Fra start: «Først velger teamet hva det vil finne ut. Det er fem valg i Surveyverksted.»
Spør salen: «Hvilket av de fem har dere på bordet? Skriv 1 til 5 i chatten, ovenfra.» Les opp noen svar.

Klikk 1: «Velger dere «Lyktes brukeren med en kjent oppgave?», får brukeren disse spørsmålene.» Først hva hen prøvde å gjøre, valgt fra oppgavene teamet legger inn. Så om hen klarte det. «Hva hindret deg?» kommer bare når svaret er Delvis eller Nei. Velger brukeren «Noe annet», kommer «Beskriv hva du prøvde å gjøre» først.

Klikk 2: dashboardet viser hvor mange som klarte hver oppgave, og hva som hindret dem.

De andre valgene, hvis noen spør:
«Hvordan opplevde brukeren tjenesten?»: vurderingen over tid, et kort per spørsmål og fritekstsvarene.
«Hva kom brukeren for å gjøre?»: oppgavene som går igjen, med eksempler fra brukerne, om de fikk det til og hva som hindret dem.
«Hvilke oppgaver er viktigst?»: hvilke oppgaver som får flest stemmer, og antall svar over tid.
«Noe annet»: et kort per spørsmål med fordelingen av svarene og ord som går igjen i fritekstsvarene.`,
  Component: HvaVilDereVite,
};
