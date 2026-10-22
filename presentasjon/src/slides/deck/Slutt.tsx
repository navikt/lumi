import type { Slide } from "../../engine";
import { cssVars } from "../../engine/css";
import { Answer, Line, LineMap, MapText, Station } from "../../map";
import "./avslutning.css";

const Y = 590;
/** The apps on the line today: seven, in two teams. */
const APPS = [200, 330, 460, 590, 720, 850, 980] as const;
/** The audience's app: the end of the line, and the core of the crystal. */
const YOURS_X = 1400;
const CORE_R = 62;
/** The planned station, a little smaller, so the gold core covers it. */
const PLANNED_R = 58;

/**
 * Light falls off away from the answer: the stations far from the crystal
 * are mixed towards the paper. Night gets a steeper fall than paper, where
 * a pale ring would vanish on white.
 */
function light(i: number) {
  const t = i / (APPS.length - 1);
  return cssVars({
    "--slutt-light": `${Math.round(35 + 65 * t)}%`,
    "--slutt-light-papir": `${Math.round(55 + 45 * t)}%`,
  });
}

/*
 * The snow crystal of the Lumi logo, drawn as the map draws: six branches
 * round a gold core. Lumi is Finnish for snow, and the gold core is the
 * answer. Each branch is an elongated hexagon along its own axis.
 */
const CRYSTAL = { inner: 132, outer: 343, bevel: 57, half: 48 } as const;

/** A point on a branch's own axis, turned to the branch's angle. */
function turn(angleDeg: number, x: number, y: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const px = YOURS_X + x * Math.cos(a) - y * Math.sin(a);
  const py = Y + x * Math.sin(a) + y * Math.cos(a);
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
    facet: `M${turn(angleDeg, inner + 22, 0)} L${turn(angleDeg, outer - 22, 0)}`,
  };
}

/** Clockwise from the top, the order the branches grow in. */
const BRANCHES = [-90, -30, 30, 90, 150, 210].map(branch);

function Slutt() {
  return (
    <div className="slide slutt">
      <h2 className="slide-title slutt__title">
        Hvilken oppgave
        <br />
        vet dere
        <br />
        minst om?
      </h2>
      <LineMap label="En linje med sju stasjoner, en for hver app som bruker Lumi i dag. Stasjonene lysner mot høyre. Så går linja stiplet videre til en tom stasjon: deres app. Til slutt når linja fram, stasjonen tennes som et gyllent svar, og snøkrystallen fra Lumi-logoen vokser fram rundt den.">
        {/* The line, in segments, so each can take the light of its station. */}
        {APPS.map((x, i) => (
          <path
            key={x}
            d={`M${i === 0 ? -20 : APPS[i - 1]} ${Y} H${x}`}
            className="map-line slutt__segment"
            style={light(Math.max(i - 1, 0))}
          />
        ))}
        <Line
          points={[
            [APPS[APPS.length - 1], Y],
            [YOURS_X - PLANNED_R, Y],
          ]}
          dashed
          from={1}
        />
        {/* Your app joins the line, the answer lights, the crystal grows. */}
        <Line
          points={[
            [APPS[APPS.length - 1], Y],
            [YOURS_X - CORE_R, Y],
          ]}
          draw
          from={3}
          className="slutt__join"
        />
        {/* The stations go over the line, so no line shows inside a ring. */}
        {APPS.map((x, i) => (
          <g key={x} className="slutt__app" style={light(i)}>
            <Station x={x} y={Y} />
          </g>
        ))}
        <g data-from={1}>
          <Station x={YOURS_X} y={Y} r={PLANNED_R} className="slutt__yours" />
          <MapText x={YOURS_X + CORE_R + 38} y={Y} size={36} weight={700}>
            deres app
          </MapText>
        </g>

        <g data-from={3} className="slutt__crystal">
          {BRANCHES.map((b, i) => (
            <g
              key={b.key}
              className="slutt__branch"
              style={cssVars({ "--i": i })}
            >
              <path d={b.outline} className="slutt__prism" />
              <path d={b.facet} className="slutt__facet" />
            </g>
          ))}
        </g>
        <Answer x={YOURS_X} y={Y} r={CORE_R} from={3} flash />
      </LineMap>

      <p className="end-at slutt__open" data-from={2}>
        Lumi er åpent for alle team i Nav.
      </p>
      <p className="end-at slutt__lead" data-from={3}>
        Lag et utkast i Surveyverksted for den oppgaven.
      </p>
      <p className="end-at slutt__links" data-from={2}>
        <a
          className="end-mono slutt__link"
          href="https://navikt.github.io/lumi/"
        >
          navikt.github.io/lumi
        </a>
        <span>#lumi på Slack</span>
      </p>
    </div>
  );
}

export const slutt: Slide = {
  id: "slutt",
  title: "Hvilken oppgave vet dere minst om?",
  steps: 3,
  notes: `Faggruppa, ordrett: «I starten ba jeg dere ha ett spørsmål i bakhodet. Her er det i praksis: hvilken oppgave vet dere minst om?» Andre rom: bare spørsmålet.

Vent tre sekunder. Klikk 1: «deres app» kommer stiplet på linja.

Klikk 2, ordrett: «Teamet lager surveyen, den bygges inn i appen, og svaret går samme vei som appens egne data, fram til dashboardet til teamet. Svarene blir på Nais. Lumi er åpent for alle team i Nav.» Så: «Navnet er finsk for snø, og på kartet er svaret det eneste som lyser.»

Klikk 3, siste setning, ordrett: «Lag et utkast i Surveyverksted for den oppgaven.» Linja når fram til appen deres, svaret tennes, og snøkrystallen fra logoen vokser fram. Vær stille etterpå, og ikke si takk.

Til chatten: «Finner dere ikke teamet deres i Surveyverksted, be en utvikler i teamet legge dere til i Nais Console.»

Stasjonene på linja er de sju appene som bruker Lumi i dag.

Faggruppa: oppgaven er spørsmål 1 i gruppene, så gå rett til gruppene.`,
  Component: Slutt,
};
