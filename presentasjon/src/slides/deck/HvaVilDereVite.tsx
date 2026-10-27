import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import {
  Line,
  LineMap,
  MapText,
  type Point,
  roundedPath,
  Station,
} from "../../map";
import "./verksted.css";

/**
 * «Hva vil dere finne ut?» in Surveyverksted, as a line with one numbered
 * stop per setup (verbatim from the menu), so the room can answer with a
 * number. On the first click the other setups fall away, and the first one,
 * the one used in production, turns the team's green and is marked as an
 * example. Its line carries on through the questions the user gets: the
 * rating, and the optional follow-up. On the second click an answer leaves
 * the end of the survey and draws Lumi's blue line to the dashboard. The
 * questions are the ones Surveyverksted starts the setup with
 * (`surveyTemplates.rating` in apps/lumi-dashboard).
 */
const LINE_X = 160;
const DISC_R = 30;
const LABEL_X = LINE_X + DISC_R + 32;
const FIRST_Y = 384;
const GAP = 104;
const rowY = (index: number) => FIRST_Y + index * GAP;

const CHOICES = [
  "Hvordan opplevde brukeren tjenesten?",
  "Hva kom brukeren for å gjøre?",
  "Lyktes brukeren med en kjent oppgave?",
  "Hvilke oppgaver er viktigst?",
  "Noe annet",
] as const;
const CHOSEN = 0;

/** The questions, each with a note under it, under the chosen setup. */
const QUESTION_GAP = 150;
const RATING_Y = FIRST_Y + QUESTION_GAP;
const FOLLOW_UP_Y = RATING_Y + QUESTION_GAP;
const END_Y = FOLLOW_UP_Y + 104;
const NOTE_GAP = 44;
const QUESTIONS = [
  {
    y: RATING_Y,
    prompt: "«Hvordan opplevde du tjenesten?»",
    note: "emoji fra 1 til 5",
  },
  {
    y: FOLLOW_UP_Y,
    prompt: "«Hva kan vi gjøre bedre?»",
    note: "valgfritt, med fritekst",
  },
] as const;

/** The answer's way from the end of the survey to the dashboard. */
const DASH_X = 1180;
const DASH_Y = 600;
const ROUTE: readonly Point[] = [
  [LINE_X, END_Y],
  [DASH_X, END_Y],
  [DASH_X, DASH_Y],
];
const ROUTE_RADIUS = 48;

/**
 * An answer from a user: the gold disc with eyes, as in the snow globe. It
 * looks ahead, to the right, where it is going.
 */
function Svar({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={26} className="finne-ut__gull" />
      <ellipse cx={-3} cy={-4} rx={3.6} ry={5.2} className="finne-ut__oye" />
      <ellipse cx={12} cy={-4} rx={3.6} ry={5.2} className="finne-ut__oye" />
    </g>
  );
}

function HvaVilDereVite({ step }: SlideProps) {
  const chosen = step >= 1;
  return (
    <div className={cx("slide", "finne-ut", chosen && "finne-ut--valgt")}>
      <h2 className="finne-ut__title">Hva vil dere finne ut?</h2>
      <p className="finne-ut__hvor">Det første dere velger i Surveyverksted</p>

      <LineMap label="Menyen «Hva vil dere finne ut?» i Surveyverksted, med fem nummererte valg: 1 Hvordan opplevde brukeren tjenesten? 2 Hva kom brukeren for å gjøre? 3 Lyktes brukeren med en kjent oppgave? 4 Hvilke oppgaver er viktigst? 5 Noe annet. Et eksempel, valg 1: brukeren får spørsmålet «Hvordan opplevde du tjenesten?» med emoji fra 1 til 5, og så det valgfrie spørsmålet «Hva kan vi gjøre bedre?» med fritekst. Fra slutten går svaret til dashboardet, som viser vurderingen over tid og fritekstsvarene.">
        {/* The menu line. It leaves with the other setups. */}
        <g className="finne-ut__bort" style={cssVars({ "--rad": 0 })}>
          <Line
            points={[
              [LINE_X, FIRST_Y],
              [LINE_X, rowY(CHOICES.length - 1)],
            ]}
          />
        </g>

        {/* The questions, on the chosen setup's line. */}
        <g className="finne-ut__questions" data-from={1}>
          <Line
            points={[
              [LINE_X, FIRST_Y],
              [LINE_X, END_Y],
            ]}
            draw
            from={1}
            className="finne-ut__sporsmalslinje"
          />
          {QUESTIONS.map((question, index) => (
            <g
              key={question.prompt}
              className="finne-ut__sporsmal"
              style={cssVars({ "--rad": index })}
              data-from={1}
            >
              <Station x={LINE_X} y={question.y} />
              <MapText x={LABEL_X} y={question.y - 18} size={44} weight={700}>
                {question.prompt}
              </MapText>
              <MapText
                x={LABEL_X}
                y={question.y + NOTE_GAP - 14}
                size={32}
                weight={600}
                muted
              >
                {question.note}
              </MapText>
            </g>
          ))}
        </g>

        {/* The other setups fall away. */}
        {CHOICES.map((choice, index) =>
          index === CHOSEN ? null : (
            <g
              key={choice}
              className="finne-ut__bort"
              style={cssVars({ "--rad": index })}
            >
              <circle
                cx={LINE_X}
                cy={rowY(index)}
                r={DISC_R}
                className="finne-ut__skive"
              />
              <MapText
                x={LINE_X}
                y={rowY(index) + 2}
                anchor="middle"
                size={36}
                weight={800}
                className="finne-ut__tall"
              >
                {index + 1}
              </MapText>
              <MapText x={LABEL_X} y={rowY(index)} size={44} weight={700}>
                {choice}
              </MapText>
            </g>
          ),
        )}

        {/* The chosen setup stays at the top of the line, in green. */}
        <g className="finne-ut__chosen">
          <circle
            cx={LINE_X}
            cy={rowY(CHOSEN)}
            r={DISC_R}
            className="finne-ut__skive finne-ut__skive--valgt"
          />
          <MapText
            x={LINE_X}
            y={rowY(CHOSEN) + 2}
            anchor="middle"
            size={36}
            weight={800}
            className="finne-ut__tall finne-ut__tall--valgt"
          >
            {CHOSEN + 1}
          </MapText>
          <MapText
            x={LABEL_X}
            y={rowY(CHOSEN)}
            size={44}
            weight={800}
            className="finne-ut__valgt-tekst"
          >
            {CHOICES[CHOSEN]}
          </MapText>
        </g>

        {/* Click 2: an answer draws Lumi's line to the dashboard. */}
        <Line
          points={ROUTE}
          radius={ROUTE_RADIUS}
          draw
          from={2}
          className="finne-ut__rute"
        />
        <g className="finne-ut__dashboard" data-from={2}>
          <circle cx={DASH_X} cy={DASH_Y} r={30} className="finne-ut__mal" />
          <g className="finne-ut__landet">
            <Svar x={DASH_X} y={DASH_Y} />
          </g>
          <g className="finne-ut__dashtekst">
            <MapText
              x={DASH_X + 64}
              y={DASH_Y - 50}
              size={44}
              weight={800}
              className="finne-ut__dashnavn"
            >
              Dashboardet viser
            </MapText>
            {["vurderingen over tid", "og fritekstsvarene"].map((line, row) => (
              <MapText
                key={line}
                x={DASH_X + 64}
                y={DASH_Y + 2 + row * 50}
                size={40}
                weight={600}
              >
                {line}
              </MapText>
            ))}
          </g>
        </g>
        <g
          className="finne-ut__reiser"
          style={{ offsetPath: `path("${roundedPath(ROUTE, ROUTE_RADIUS)}")` }}
          data-from={2}
        >
          <Svar />
        </g>
      </LineMap>

      {/* The chosen setup is an example: the one used in production. */}
      <div className="finne-ut__eksempel" data-from={1}>
        <Tag kind="example" />
      </div>
    </div>
  );
}

export const hvaVilDereVite: Slide = {
  id: "hva-vil-dere-vite",
  title: "Hva vil dere finne ut?",
  steps: 2,
  Component: HvaVilDereVite,
};
