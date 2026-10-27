import type { Slide } from "../../engine";
import { cssVars } from "../../engine/css";
import { Answer, Line, LineMap, Station } from "../../map";
import "./avslutning.css";

const Y = 590;
/** The apps on the line today: seven, in two teams. */
const APPS = [200, 330, 460, 590, 720, 850, 980] as const;
/** The open station at the end of the line, and the core of the crystal. */
const OPEN_X = 1460;
const CORE_R = 92;
/** The planned station, a little smaller, so the gold core covers it. */
const PLANNED_R = 86;

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
 * The snow crystal of the Lumi logo, drawn as in the snow globe: six
 * branches round a gold core. Each branch is a long six-sided prism, light
 * on its clockwise side and dark on the other, with a shine and a shadow
 * at the tip. The proportions are the globe's crystal (tip at 100), scaled
 * up, so the branches start under the core, as in the logo.
 */
const SCALE = 3.3;
const CRYSTAL = {
  inner: 27.3 * SCALE,
  bevel: 46.3 * SCALE,
  outer: 80.5 * SCALE,
  tip: 100 * SCALE,
  half: 15.1 * SCALE,
  shine: 73.2 * SCALE,
  facet: 51.2 * SCALE,
} as const;

/** A point on a branch's own axis, turned to the branch's angle. */
function turn(angleDeg: number, x: number, y: number): string {
  const a = (angleDeg * Math.PI) / 180;
  const px = OPEN_X + x * Math.cos(a) - y * Math.sin(a);
  const py = Y + x * Math.sin(a) + y * Math.cos(a);
  return `${px.toFixed(1)},${py.toFixed(1)}`;
}

function polygon(angleDeg: number, points: readonly [number, number][]) {
  return points.map(([x, y]) => turn(angleDeg, x, y)).join(" ");
}

function branch(angleDeg: number) {
  const { inner, bevel, outer, tip, half, shine, facet } = CRYSTAL;
  return {
    key: angleDeg,
    light: polygon(angleDeg, [
      [inner, 0],
      [bevel, half],
      [outer, half],
      [tip, 0],
    ]),
    dark: polygon(angleDeg, [
      [inner, 0],
      [bevel, -half],
      [outer, -half],
      [tip, 0],
    ]),
    shine: polygon(angleDeg, [
      [outer, half],
      [tip, 0],
      [shine, 0],
    ]),
    shadow: polygon(angleDeg, [
      [outer, -half],
      [tip, 0],
      [shine, 0],
    ]),
    facet: polygon(angleDeg, [
      [inner, 0],
      [bevel, half],
      [facet, 0],
    ]),
    edge: polygon(angleDeg, [
      [inner, 0],
      [bevel, half],
      [outer, half],
      [tip, 0],
      [outer, -half],
      [bevel, -half],
    ]),
  };
}

/** Clockwise from the top, the order the branches grow in. */
const BRANCHES = [-90, -30, 30, 90, 150, 210].map(branch);

/** The answer's eyes, as on the answer in the snow globe. */
const EYE = { dx: 30, dy: -16, rx: 13, ry: 19 } as const;

/** The two kinds of issue in navikt/lumi, as the repo names them. */
const ISSUE_TYPES = ["Ønske eller forslag", "Meld fra om feil"] as const;

function Slutt() {
  return (
    <div className="slide slutt">
      <h2 className="slide-title slutt__title">
        Lumi er åpent for alle team i Nav
      </h2>
      <LineMap label="En linje med sju stasjoner, en for hver app som bruker Lumi i dag. Stasjonene lysner mot høyre. Linja går stiplet videre til en stor, tom stasjon. Til slutt når linja fram, stasjonen tennes som et gyllent svar med øyne, og snøkrystallen fra Lumi-logoen vokser fram rundt det.">
        {/* The line, in segments, so each can take the light of its station. */}
        {APPS.map((x, i) => (
          <path
            key={x}
            d={`M${i === 0 ? -20 : APPS[i - 1]} ${Y} H${x}`}
            className="map-line slutt__segment"
            style={light(Math.max(i - 1, 0))}
          />
        ))}
        {/* Open for the next one: dashed, to an empty station. */}
        <Line
          points={[
            [APPS[APPS.length - 1], Y],
            [OPEN_X - PLANNED_R, Y],
          ]}
          dashed
        />
        {/* The next app joins the line, the answer lights, the crystal grows. */}
        <Line
          points={[
            [APPS[APPS.length - 1], Y],
            [OPEN_X - CORE_R, Y],
          ]}
          draw
          from={2}
          className="slutt__join"
        />
        {/* The stations go over the line, so no line shows inside a ring. */}
        {APPS.map((x, i) => (
          <g key={x} className="slutt__app" style={light(i)}>
            <Station x={x} y={Y} r={24} />
          </g>
        ))}
        <Station x={OPEN_X} y={Y} r={PLANNED_R} className="slutt__ledig" />

        <g data-from={2} className="slutt__crystal">
          {BRANCHES.map((b, i) => (
            <g
              key={b.key}
              className="slutt__branch"
              style={cssVars({ "--i": i })}
            >
              <polygon points={b.light} className="slutt__ice-light" />
              <polygon points={b.dark} className="slutt__ice-dark" />
              <polygon points={b.shine} className="slutt__ice-shine" />
              <polygon points={b.shadow} className="slutt__ice-shadow" />
              <polygon points={b.facet} className="slutt__ice-facet" />
              <polygon points={b.edge} className="slutt__ice-edge" />
            </g>
          ))}
        </g>
        <Answer x={OPEN_X} y={Y} r={CORE_R} from={2} flash />
        <g data-from={2} className="slutt__eyes">
          <ellipse
            cx={OPEN_X - EYE.dx}
            cy={Y + EYE.dy}
            rx={EYE.rx}
            ry={EYE.ry}
          />
          <ellipse
            cx={OPEN_X + EYE.dx}
            cy={Y + EYE.dy}
            rx={EYE.rx}
            ry={EYE.ry}
          />
        </g>
      </LineMap>

      {/* Where to go: the repo's two kinds of issue, and the channel. */}
      <div className="end-at slutt__kontakt" data-from={1}>
        <p className="slutt__rad">
          Forslag og feil meldes som issues i{" "}
          <span className="end-mono">navikt/lumi</span>.
        </p>
        <ul className="slutt__typer">
          {ISSUE_TYPES.map((type) => (
            <li key={type} className="slutt__type">
              {type}
            </li>
          ))}
        </ul>
        <p className="slutt__rad">Spørsmål tas i #lumi på Slack.</p>
      </div>
    </div>
  );
}

export const slutt: Slide = {
  id: "slutt",
  title: "Lumi er åpent for alle team i Nav",
  steps: 2,
  Component: Slutt,
};
