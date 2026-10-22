import type { Slide, SlideProps } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import { Line, LineBadge, LineMap, MapText, Station } from "../../map";
import "./premiss.css";

/** The same height as the line on svarets-vei, which comes next. */
const Y = 600;
const MARGIN = 112;
const BADGE_WIDTH = 152;
const BADGE_X = MARGIN + BADGE_WIDTH / 2;
/** The first station keeps one spacing clear of Lumi's badge. */
const LINE_START = MARGIN + BADGE_WIDTH;
const SPACING = 330;
const RING_R = 32;
/** Eight dashes round the ring, so the dashed ring closes evenly. */
const RING_SEGMENT = (2 * Math.PI * RING_R) / 8;
/** The line runs from edge to edge, a little past the stage on both sides. */
const EDGE_LEFT = -20;
const EDGE_RIGHT = 1940;
/** Lumi's line draws in this long, with the travel easing. */
const DRAW_MS = 1200;
/** Where a label sits above or below its station, as on the map. */
const LABEL_ABOVE_Y = Y - RING_R - 46;
const LABEL_BELOW_Y = Y + RING_R + 50;

interface Need {
  label: string;
  side: "above" | "below";
}

const NEEDS: readonly Need[] = [
  { label: "Lik widget i alle apper", side: "above" },
  { label: "Ulike surveytyper", side: "below" },
  { label: "Analyse i dashboardet", side: "above" },
  { label: "Tilgang per team", side: "below" },
];

/** Stations at equal steps from the badge. */
function stationX(index: number): number {
  return LINE_START + SPACING * (index + 1);
}

/** `--deck-easing-travel` in theme.css. Keep the two in step. */
const TRAVEL = { x1: 0.45, y1: 0, x2: 0.15, y2: 1 } as const;

function bezier(p1: number, p2: number, s: number): number {
  const u = 1 - s;
  return 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s;
}

/** The share of the drawing time at which the line has drawn `fraction`. */
function timeAt(fraction: number): number {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    if (bezier(TRAVEL.y1, TRAVEL.y2, mid) < fraction) low = mid;
    else high = mid;
  }
  return bezier(TRAVEL.x1, TRAVEL.x2, (low + high) / 2);
}

/** A station fills, and its need lights, when Lumi's line reaches it. */
function fillDelay(index: number): string {
  const reach =
    (stationX(index) - RING_R - EDGE_LEFT) / (EDGE_RIGHT - EDGE_LEFT);
  return `${Math.round(timeAt(reach) * DRAW_MS)}ms`;
}

const EDGE_TO_EDGE = [
  [EDGE_LEFT, Y],
  [EDGE_RIGHT, Y],
] as const;

function ViTrengteMer({ step }: SlideProps) {
  return (
    <div
      className={cx("slide", step >= 1 && "trengte--built")}
      style={cssVars({ "--trengte-draw": `${DRAW_MS}ms` })}
    >
      <h2 className="slide-title trengte__title">Men vi trengte mer</h2>
      <LineMap label="Linjekart. En stiplet linje fra kant til kant, behovene våre i eSyfo, med fire stasjoner: lik widget i alle apper, ulike surveytyper, analyse i dashboardet og tilgang per team. Så kommer Lumi, januar 2026, og tegner en heltrukket linje over den.">
        {/* The needs: a line that is not built yet. */}
        <Line points={EDGE_TO_EDGE} dashed />
        <MapText x={MARGIN} y={Y - 160} size={32} weight={600} muted>
          Behovene våre i eSyfo
        </MapText>

        {/* Lumi builds it. The line draws itself under the stations. */}
        <Line points={EDGE_TO_EDGE} draw from={1} className="trengte__line" />

        <g
          className="trengte__gap"
          style={cssVars({
            "--trengte-dash": `${RING_SEGMENT * 0.6} ${RING_SEGMENT * 0.4}`,
          })}
        >
          {NEEDS.map((need, i) => (
            <Station key={need.label} x={stationX(i)} y={Y} r={RING_R} />
          ))}
        </g>

        {/* The stations fill: solid rings over the dashed ones. */}
        {NEEDS.map((need, i) => (
          <g
            key={need.label}
            className="trengte__fill"
            data-from={1}
            style={cssVars({ "--trengte-delay": fillDelay(i) })}
          >
            <Station x={stationX(i)} y={Y} r={RING_R} />
          </g>
        ))}

        <g>
          {NEEDS.map((need, i) => (
            <text
              key={need.label}
              x={stationX(i)}
              y={need.side === "above" ? LABEL_ABOVE_Y : LABEL_BELOW_Y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="trengte__need"
              style={cssVars({ "--trengte-delay": fillDelay(i) })}
            >
              {need.label}
            </text>
          ))}
        </g>

        <g data-from={1}>
          <LineBadge x={BADGE_X} y={Y} text="Lumi" width={BADGE_WIDTH} />
          <MapText x={MARGIN} y={Y + 82} weight={600} muted>
            januar 2026
          </MapText>
        </g>
      </LineMap>
    </div>
  );
}

export const viTrengteMer: Slide = {
  id: "vi-trengte-mer",
  title: "Men vi trengte mer",
  rooms: ["frontend", "produktledere"],
  steps: 1,
  notes: `Ordrett: «Det vi manglet, lagde vi selv, først som tillegg: en widget og et dashboard for analyse.»

Les opp de fire behovene våre i eSyfo. Linja er stiplet, fordi den ikke er bygd ennå.

Klikk 1: Lumi tegner linja, og stasjonene fylles. Ordrett: «I januar 2026 ble det et eget verktøy, med egen datamodell og tilgang per team.»`,
  Component: ViTrengteMer,
};
