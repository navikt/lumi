import type { Slide, SlideProps } from "../../engine";
import { cx } from "../../engine/css";
import {
  Line,
  LineMap,
  MapText,
  type Point,
  roundedPath,
  Station,
} from "../../map";
import { useBuildMotion } from "./bevisMotion";
import "./delene.css";

/*
 * The parts of Lumi, right after «Hva er Lumi?», as a map in two lanes:
 * the Lumi dashboard on top, with Surveyverksted and the dashboard, and
 * the team's app below, with the widget and the app's backend. Lumi API is
 * on the way between them, outside both. The three parts the team uses are
 * filled discs, numbered in the order of the story: Surveyverksted, the
 * widget and the dashboard. The two in between are small and dim. Click 1:
 * the survey goes from Surveyverksted into the app, in the team's green.
 * Click 2: a user answers in the widget. Click 3: the answer goes through
 * the app's backend and Lumi API to the dashboard, on Lumi's blue line.
 * The answer is in one place at a time, beside the part it is at. It only
 * moves when the slide is built click by click: without motion, on paper,
 * in thumbnails and when the slide is opened at a later step, each step
 * shows its end at once.
 */

const TOP_Y = 400;
const BOTTOM_Y = 640;
const PART_X = 580;
const DASHBOARD_X = 1100;
const BACKEND_X = 1150;
const TURN_X = 1650;
const API_Y = (TOP_Y + BOTTOM_Y) / 2;
const ROUTE_RADIUS = 48;
const LANE_X = 112;
const LANE_WIDTH = 1288;

/*
 * The map is drawn a little larger than its own coordinates, and lower, so
 * it stands midway between the title and the foot of the slide, with its
 * left edge where it was. The lanes then end at x 1516 and y 920, left of
 * the Teams corner, and the way round by Lumi API turns above it.
 */
const MAP_SCALE = 1.09;
const MAP_SHIFT = {
  x: Math.round(LANE_X * (1 - MAP_SCALE)),
  y: 59,
} as const;

const SURVEY: readonly Point[] = [
  [PART_X, TOP_Y],
  [PART_X, BOTTOM_Y],
];
const ROUTE: readonly Point[] = [
  [PART_X, BOTTOM_Y],
  [TURN_X, BOTTOM_Y],
  [TURN_X, TOP_Y],
  [DASHBOARD_X, TOP_Y],
];

/** The three parts are numbered discs, a little larger than a station. */
const PART_R = 30;
/**
 * The answer stands beside a part, on the line, so the part's number
 * still shows: right of the widget, and right of the dashboard.
 */
const BESIDE = 74;
const ANSWER_ROUTE: readonly Point[] = [
  [PART_X + BESIDE, BOTTOM_Y],
  [TURN_X, BOTTOM_Y],
  [TURN_X, TOP_Y],
  [DASHBOARD_X + BESIDE, TOP_Y],
];

/** The lanes: each a zone, named at its left end. */
const LANES = [
  { label: "Lumi-dashboardet", y: 232, height: 228, lineY: TOP_Y },
  { label: "Appen deres", y: 580, height: 210, lineY: BOTTOM_Y },
] as const;

/**
 * One of the three parts the team uses: a filled station with its number,
 * in the order of the story.
 */
function Del({
  number,
  x,
  y,
  side,
  label,
  note,
}: {
  number: number;
  x: number;
  y: number;
  side: "above" | "below";
  label: string;
  note: string;
}) {
  return (
    <g className="delene__del">
      <Station x={x} y={y} r={PART_R} side={side} label={label} note={note} />
      <text
        x={x}
        y={y + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        className="map-label delene__nummer"
      >
        {number}
      </text>
    </g>
  );
}

/**
 * An answer: the gold disc with eyes, as in the snow globe. The inner group
 * carries no position, so it can grow in from its own centre.
 */
function Svar({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="delene__svar">
        <circle r={30} className="delene__gull" />
        <ellipse cx={-4} cy={-5} rx={4} ry={6} className="delene__oye" />
        <ellipse cx={13} cy={-5} rx={4} ry={6} className="delene__oye" />
      </g>
    </g>
  );
}

function Delene({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div
      className={cx("slide", "delene", step >= 3 && "delene--sendt")}
      data-motion={motion ? "" : undefined}
    >
      <h2 className="slide-title delene__title">
        Dere bruker tre av delene i Lumi
      </h2>
      <LineMap label="Kart over delene i Lumi. Øverst Lumi-dashboardet, med Surveyverksted, der dere lager surveyen, og dashboardet, der dere leser svarene. Nederst appen deres, med widgeten, der brukerne svarer, og appens backend. Utvikleren legger surveyen fra Surveyverksted inn i appen. Svaret går fra widgeten gjennom appens backend og Lumi API til dashboardet.">
        <g
          transform={`translate(${MAP_SHIFT.x} ${MAP_SHIFT.y}) scale(${MAP_SCALE})`}
        >
          {LANES.map((lane) => (
            <g key={lane.label}>
              <rect
                x={LANE_X}
                y={lane.y}
                width={LANE_WIDTH}
                height={lane.height}
                rx={12}
                className="map-zone__area map-zone__area--neutral"
              />
              <MapText
                x={LANE_X + 36}
                y={lane.lineY}
                size={32}
                weight={600}
                muted
              >
                {lane.label}
              </MapText>
            </g>
          ))}

          {/* The ways, dim from the start, and drawn in colour on the clicks. */}
          <Line points={SURVEY} dim />
          <Line points={ROUTE} radius={ROUTE_RADIUS} dim />
          <Line points={SURVEY} draw from={1} className="delene__kode" />
          <Line
            points={ROUTE}
            radius={ROUTE_RADIUS}
            draw
            from={3}
            className="delene__rute"
          />

          <Del
            number={1}
            x={PART_X}
            y={TOP_Y}
            side="above"
            label="Surveyverksted"
            note="dere lager surveyen"
          />
          <Del
            number={3}
            x={DASHBOARD_X}
            y={TOP_Y}
            side="above"
            label="Dashboardet"
            note="dere leser svarene"
          />
          <Station
            x={TURN_X}
            y={API_Y}
            r={18}
            side="left"
            label="Lumi API"
            dim
          />
          <Del
            number={2}
            x={PART_X}
            y={BOTTOM_Y}
            side="below"
            label="Widgeten"
            note="brukerne svarer"
          />
          <Station
            x={BACKEND_X}
            y={BOTTOM_Y}
            r={18}
            side="below"
            label="Appens backend"
            dim
          />

          {/* Click 2: the answer, in the widget. It leaves on click 3. */}
          <g className="delene__ved-widgeten" data-from={2}>
            <Svar x={PART_X + BESIDE} y={BOTTOM_Y} />
          </g>
          <g className="delene__landet" data-from={3}>
            <Svar x={DASHBOARD_X + BESIDE} y={TOP_Y} />
          </g>
          <g
            className="delene__reiser"
            style={{
              offsetPath: `path("${roundedPath(ANSWER_ROUTE, ROUTE_RADIUS)}")`,
            }}
            data-from={3}
          >
            <Svar />
          </g>
        </g>
      </LineMap>
    </div>
  );
}

export const delene: Slide = {
  id: "delene",
  title: "Dere bruker tre av delene i Lumi",
  steps: 3,
  Component: Delene,
};
