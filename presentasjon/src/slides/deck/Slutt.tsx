import type { Slide } from "../../engine";
import { Line, LineMap, Station } from "../../map";
import "./avslutning.css";

const Y = 520;
/** The apps on the line today: seven, in two teams. */
const APPS = [200, 420, 640, 860, 1080, 1300, 1520] as const;
const SPUR_X = 1190;
const YOURS_Y = 720;
const YOURS_R = 40;

function Slutt() {
  return (
    <div className="slide">
      <h2 className="slide-title">Hvilken oppgave vet dere minst om?</h2>
      <LineMap label="Linja med sju stasjoner, en for hver app som bruker Lumi i dag. Fra linja henger en stiplet gren ned til en tom, stiplet stasjon: deres app.">
        <Line
          points={[
            [-20, Y],
            [1940, Y],
          ]}
        />
        {APPS.map((x) => (
          <Station key={x} x={x} y={Y} />
        ))}
        <g data-from={1}>
          <Line
            points={[
              [SPUR_X, Y],
              [SPUR_X, YOURS_Y - YOURS_R],
            ]}
            dashed
          />
          <Station
            x={SPUR_X}
            y={YOURS_Y}
            r={YOURS_R}
            label="deres app"
            className="slutt__yours"
          />
        </g>
      </LineMap>
      <div className="end-at slutt__action" data-from={2}>
        <p className="slutt__open">Lumi er åpent for alle team i Nav.</p>
        <p className="slide-lead slutt__lead">
          Lag et utkast i Surveyverksted for én oppgave.
        </p>
        <p className="slutt__links">
          <span className="end-mono">navikt.github.io/lumi</span>
          <span>#lumi på Slack</span>
        </p>
      </div>
    </div>
  );
}

export const slutt: Slide = {
  id: "slutt",
  title: "Hvilken oppgave vet dere minst om?",
  steps: 2,
  notes: `Pause etter spørsmålet. Så siste setning.

Siste setning, ordrett: «Lag et utkast for den oppgaven i Surveyverksted denne uka.»

Stasjonene på linja er de sju appene som bruker Lumi i dag.

Surveyverksted krever at du er med i teamet ditt i Nais Console.

Faggruppa: Det er spørsmål 1 i gruppene.
Faggruppa: rett til gruppene.`,
  Component: Slutt,
};
