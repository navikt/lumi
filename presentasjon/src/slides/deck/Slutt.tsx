import type { Slide } from "../../engine";
import { Answer, Line, LineMap, MapText, Station } from "../../map";
import "./avslutning.css";

const Y = 440;
/** The apps on the line today: seven, in two teams. */
const APPS = [200, 420, 640, 860, 1080, 1300, 1520] as const;
const SPUR_X = 1190;
const YOURS_Y = 630;
const YOURS_R = 40;

/*
 * The snow crystal of the Lumi logo, drawn as the map draws: six branches
 * round a gold core. Lumi is Finnish for snow, and the gold core is the
 * answer. Each branch is an elongated hexagon along its own axis.
 */
const CRYSTAL = { inner: 60, outer: 156, bevel: 26, half: 22 } as const;

/** A point on a branch's own axis, turned to the branch's angle. */
function turn(angleDeg: number, x: number, y: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const px = SPUR_X + x * Math.cos(a) - y * Math.sin(a);
  const py = YOURS_Y + x * Math.sin(a) + y * Math.cos(a);
  return `${px.toFixed(1)},${py.toFixed(1)}`;
}

function branch(angleDeg: number) {
  const { inner, outer, bevel, half } = CRYSTAL;
  const outline: readonly [number, number][] = [
    [inner, 0],
    [inner + bevel, half],
    [outer - bevel, half],
    [outer, 0],
    [outer - bevel, -half],
    [inner + bevel, -half],
  ];
  return {
    key: angleDeg,
    outline: `M${outline.map(([x, y]) => turn(angleDeg, x, y)).join(" L")} Z`,
    // The facet along the middle, as in the logo's prisms.
    facet: `M${turn(angleDeg, inner + 10, 0)} L${turn(angleDeg, outer - 10, 0)}`,
  };
}

const BRANCHES = [-90, -30, 30, 90, 150, 210].map(branch);

function Slutt() {
  return (
    <div className="slide">
      <h2 className="slide-title">Hvilken oppgave vet dere minst om?</h2>
      <LineMap label="Linja med sju stasjoner, en for hver app som bruker Lumi i dag. Fra linja henger en stiplet gren ned til en tom, stiplet stasjon: deres app. Til slutt tennes stasjonen som et gyllent svar, med snøkrystallen fra Lumi-logoen rundt.">
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
            className="slutt__yours"
          />
          <MapText
            x={SPUR_X + YOURS_R + 28}
            y={YOURS_Y}
            size={36}
            weight={700}
            className="slutt__yours-label"
          >
            deres app
          </MapText>
        </g>
        <g data-from={3} className="slutt__crystal">
          {BRANCHES.map((b) => (
            <g key={b.key}>
              <path d={b.outline} pathLength={1} className="slutt__branch" />
              <path d={b.facet} pathLength={1} className="slutt__facet" />
            </g>
          ))}
        </g>
        <Answer x={SPUR_X} y={YOURS_Y} r={46} from={3} />
      </LineMap>
      <div className="end-at slutt__action" data-from={2}>
        <p className="slutt__open">Lumi er åpent for alle team i Nav.</p>
        <p className="slide-lead slutt__lead">
          Lag et utkast i Surveyverksted for den oppgaven.
        </p>
        <p className="slutt__links">
          <a
            className="end-mono slutt__link"
            href="https://navikt.github.io/lumi/"
          >
            navikt.github.io/lumi
          </a>
          <span>#lumi på Slack</span>
        </p>
      </div>
    </div>
  );
}

export const slutt: Slide = {
  id: "slutt",
  title: "Hvilken oppgave vet dere minst om?",
  steps: 3,
  notes: `Pause etter spørsmålet.

Klikk 1: «deres app». Klikk 2: oppgaven og lenkene.

Før siste setning: «Kort sagt: teamet lager surveyen, den bygges inn i appen, og svaret går samme vei som appens egne data, fram til dashboardet til teamet. Svarene blir på Nais.»

«Lumi er åpent for alle team i Nav. Finner du ikke teamet ditt i Surveyverksted, be en utvikler legge deg til i teamet i Nais Console.»

Klikk 3, siste setning, ordrett: «Lag et utkast i Surveyverksted for den oppgaven.» Stasjonen tennes som et svar, og snøkrystallen fra logoen tegnes rundt.

Vil du si noe om navnet: «Lumi er finsk for snø, derav krystallen. Det ligner lumen, latin for lys. Det passer: på kartet er svaret det eneste som lyser.»

Stasjonene på linja er de sju appene som bruker Lumi i dag.

Faggruppa: det er spørsmål 1 i gruppene, så rett til gruppene.`,
  Component: Slutt,
};
