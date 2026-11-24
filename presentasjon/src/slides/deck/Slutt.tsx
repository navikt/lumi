import { type Slide, type SlideProps, useSlide } from "../../engine";
import { cssVars } from "../../engine/css";
import { Answer, LineMap } from "../../map";
import "./avslutning.css";

/*
 * The last slide, up while people ask: Lumi is open to every team, and the
 * two places to go from here, the docs and the channel on Slack. All there
 * at once. Beside it the snow crystal of the Lumi logo, with the answer
 * home in its core, as in the snow globe on the cover. When the slide
 * comes on, the answer lights, the branches grow out of it, and the answer
 * opens its eyes, once.
 */

/** The core of the crystal. */
const X = 1460;
const Y = 590;
const CORE_R = 92;

/** Where to go from here: what to do, and the address. */
const WAYS = [
  { label: "Les dokumentasjonen", at: "navikt.github.io/lumi" },
  { label: "Bli med på Slack", at: "#lumi" },
] as const;

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
  const px = X + x * Math.cos(a) - y * Math.sin(a);
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

function Slutt({ active }: SlideProps) {
  const { mode } = useSlide();
  const coming = active && mode === "stage";
  return (
    <div className="slide slutt" data-i-gang={coming ? "" : undefined}>
      <h2 className="slide-title slutt__title">
        Lumi er åpent for alle team i Nav
      </h2>
      <LineMap label="Snøkrystallen fra Lumi-logoen, med et gyllent svar med øyne i kjernen.">
        <g className="slutt__crystal">
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
        <Answer x={X} y={Y} r={CORE_R} />
        <g className="slutt__eyes">
          <ellipse cx={X - EYE.dx} cy={Y + EYE.dy} rx={EYE.rx} ry={EYE.ry} />
          <ellipse cx={X + EYE.dx} cy={Y + EYE.dy} rx={EYE.rx} ry={EYE.ry} />
        </g>
      </LineMap>

      <dl className="end-at slutt__veier">
        {WAYS.map((way) => (
          <div key={way.at} className="slutt__vei">
            <dt>{way.label}</dt>
            <dd className="end-mono">{way.at}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const slutt: Slide = {
  id: "slutt",
  title: "Lumi er åpent for alle team i Nav",
  Component: Slutt,
};
