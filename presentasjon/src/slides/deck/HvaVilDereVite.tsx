import { Tag } from "../../components/Tag";
import type { Slide } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import { RouteProgress } from "./RouteProgress";
import "./verksted.css";

/** The menu «Hva vil dere finne ut?», drawn as a line with one stop per choice. */
const MENU_X = 960;
const HEADER_Y = 384;
const FIRST_Y = 468;
const ROW_GAP = 80;
const QUESTION_X = 112;
const LINE_GAP = 32;
const STOP_R = 22;
const CHOICE_X = MENU_X + STOP_R + 28;

/**
 * A decision the team has to make (made up for the slide) and the choice in
 * Surveyverksted that answers it. The choices are verbatim from the menu.
 * `width` is the question's width in Overpass 600 at 36 px, so the line
 * starts right after it.
 */
const ROUTES = [
  {
    question: "«Ble den nye innsendingen bedre?»",
    width: 588,
    choice: "Hvordan opplevde brukeren tjenesten?",
  },
  {
    question: "«Lager vi det folk kommer for?»",
    width: 526,
    choice: "Hva kom brukeren for å gjøre?",
  },
  {
    question: "«Hvilken oppgave fikser vi først?»",
    width: 558,
    choice: "Lyktes brukeren med en kjent oppgave?",
  },
  {
    question: "«Hva skal stå øverst?»",
    width: 369,
    choice: "Hvilke oppgaver er viktigst?",
  },
  {
    question: "«Vi har et annet spørsmål»",
    width: 444,
    choice: "Noe annet",
  },
] as const;

const rowY = (index: number) => FIRST_Y + index * ROW_GAP;
const LAST_Y = rowY(ROUTES.length - 1);

function HvaVilDereVite() {
  return (
    <div className="slide">
      <h2 className="slide-title">Teamet velger først hva det vil finne ut</h2>

      <LineMap label="Fem spørsmål teamet kan ha, hvert koblet med en linje til ett av de fem valgene under «Hva vil dere finne ut?» i Surveyverksted: Ble den nye innsendingen bedre? går til Hvordan opplevde brukeren tjenesten? Lager vi det folk kommer for? går til Hva kom brukeren for å gjøre? Hvilken oppgave fikser vi først? går til Lyktes brukeren med en kjent oppgave? Hva skal stå øverst? går til Hvilke oppgaver er viktigst? Vi har et annet spørsmål går til Noe annet.">
        {/*
         * The menu: a line from its name down through the five choices. It
         * comes with the questions, so no heading stands over an empty column.
         */}
        <g data-from={1}>
          <Line
            points={[
              [MENU_X, HEADER_Y],
              [MENU_X, LAST_Y],
            ]}
          />
          <Line
            points={[
              [MENU_X - 26, HEADER_Y],
              [MENU_X + 26, HEADER_Y],
            ]}
          />
          <MapText x={CHOICE_X} y={HEADER_Y - 44} size={30} weight={500} muted>
            Surveyverksted
          </MapText>
          <MapText x={CHOICE_X} y={HEADER_Y} weight={800}>
            Hva vil dere finne ut?
          </MapText>
        </g>

        {ROUTES.map((route, index) => (
          <g key={route.choice} data-from={1}>
            <Line
              points={[
                [QUESTION_X + route.width + LINE_GAP, rowY(index)],
                [MENU_X, rowY(index)],
              ]}
            />
            <MapText x={QUESTION_X} y={rowY(index)}>
              {route.question}
            </MapText>
          </g>
        ))}

        {ROUTES.map((route, index) => (
          <Station
            key={route.choice}
            x={MENU_X}
            y={rowY(index)}
            r={STOP_R}
            from={1}
          />
        ))}

        {ROUTES.map((route, index) => (
          <MapText
            key={route.choice}
            x={CHOICE_X}
            y={rowY(index)}
            weight={700}
            from={2}
          >
            {route.choice}
          </MapText>
        ))}
      </LineMap>

      <p className="finne-ut__header" data-from={1}>
        Teamet spør <Tag kind="example" />
      </p>
      <RouteProgress at={0} />
    </div>
  );
}

export const hvaVilDereVite: Slide = {
  id: "hva-vil-dere-vite",
  title: "Teamet velger først hva det vil finne ut",
  steps: 2,
  notes: `Start med spørsmålet. Først velger teamet under «Hva vil dere finne ut?» i Surveyverksted. Det er fem valg.

Klikk 1: spørsmål teamet kan ha. Eksempler.

Klikk 2: valget i Surveyverksted, ordrett fra menyen.

Valget bestemmer spørsmålene og hva dashboardet viser.

Dette viser dashboardet for hvert valg:
«Hvordan opplevde brukeren tjenesten?»: vurderingen over tid, et kort per spørsmål og fritekstsvarene. Dere kan sammenligne med forrige periode.
«Hva kom brukeren for å gjøre?»: oppgavene som går igjen, med eksempler fra brukerne, om de fikk det til og hva som hindret dem.
«Lyktes brukeren med en kjent oppgave?»: resultat og hindringer per oppgave, og suksessraten over tid.
«Hvilke oppgaver er viktigst?»: hvilke oppgaver som får flest stemmer, og antall svar over tid.
«Noe annet»: et kort per spørsmål med fordelingen av svarene og ord som går igjen i fritekstsvarene. Dere kan sammenligne med forrige periode.

Produktlederakademiet: la salen velge et av spørsmålene.`,
  Component: HvaVilDereVite,
};
