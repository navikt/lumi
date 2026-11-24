import { type Slide, type SlideProps, useSlide } from "../../engine";
import { Line, LineBadge, LineMap, MapText, Station } from "../../map";
import "./tanstack.css";

/*
 * For Frontend forum, where most build with Next.js, and many in the room
 * are designers: why the dashboard is built with TanStack Start, in one
 * picture and without code. Next.js is a ring line, dimmed, where every
 * stop is one of its own modules, next/…: an ecosystem of its own. TanStack
 * Start is a line in Lumi's blue that runs on out of the map, with stops
 * the web itself names: Request, Response and fetch, which the dashboard's
 * server code uses as they are. The speaker gives the other reasons; there
 * is no lead. All there at once, without clicks. While the slide is up, a
 * train goes round and round the ring, and one runs out along the Start
 * line.
 */

/** The map sits midway between the title and the foot of the slide. */
const RING = { x: 470, y: 620, r: 150 } as const;
/** Every stop on the ring is Next.js's own. */
const NEXT_STOPS = [
  { angle: -90, label: "next/link" },
  { angle: -30, label: "next/image" },
  { angle: 30, label: "next/font" },
  { angle: 90, label: "next/headers" },
  { angle: 150, label: "next/cache" },
  { angle: 210, label: "next/server" },
] as const;

const LINE_Y = RING.y;
/** The line starts under its badge, so it has no loose end to the left. */
const BADGE_X = 1070;
/** The two captions share a baseline, under the ring and under the line. */
const CAPTION_Y = RING.y + RING.r + 116;
const START_STOPS = [
  { x: 1360, label: "Request" },
  { x: 1560, label: "Response" },
  { x: 1760, label: "fetch" },
] as const;

/** Round the ring clockwise from the top, and out along the Start line. */
const RING_PATH = `M${RING.x} ${RING.y - RING.r} A${RING.r} ${RING.r} 0 1 1 ${RING.x} ${RING.y + RING.r} A${RING.r} ${RING.r} 0 1 1 ${RING.x} ${RING.y - RING.r}`;

/** A stop on the ring, and where its name goes, outside the ring. */
function onRing(angle: number, out: number) {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  return {
    x: RING.x + (RING.r + out) * cos,
    y: RING.y + (RING.r + out) * Math.sin(radians),
    anchor:
      cos > 0.3
        ? ("start" as const)
        : cos < -0.3
          ? ("end" as const)
          : ("middle" as const),
  };
}

function TanstackStart({ active }: SlideProps) {
  const { mode } = useSlide();
  const running = active && mode === "stage";
  return (
    <div className="slide tanstack" data-i-gang={running ? "" : undefined}>
      <h2 className="tanstack__title">
        Vi bygde dashboardet med TanStack Start
      </h2>

      <LineMap
        label={`To linjer. Next.js er en ringlinje, et eget økosystem, der alle stasjonene er Next.js sine egne: ${NEXT_STOPS.map((stop) => stop.label).join(", ")}. TanStack Start er en linje som går videre ut av kartet, med stasjonene ${START_STOPS.map((stop) => stop.label).join(", ")}: webens egne deler.`}
      >
        {/* Next.js: round and round, every stop its own. */}
        <circle
          cx={RING.x}
          cy={RING.y}
          r={RING.r}
          className="map-line tanstack__ring"
        />
        {NEXT_STOPS.map((stop) => {
          const at = onRing(stop.angle, 0);
          const name = onRing(stop.angle, 40);
          return (
            <g key={stop.label} className="tanstack__next-stopp">
              <circle cx={at.x} cy={at.y} r={14} />
              <MapText
                x={name.x}
                y={name.y}
                anchor={name.anchor}
                size={28}
                mono
                className="tanstack__navn"
              >
                {stop.label}
              </MapText>
            </g>
          );
        })}
        <g
          className="tanstack__tog tanstack__tog--ring"
          style={{ offsetPath: `path("${RING_PATH}")` }}
        >
          <circle r={11} />
        </g>
        <LineBadge
          x={RING.x}
          y={RING.y}
          text="Next.js"
          width={190}
          className="tanstack__badge--next"
        />
        <MapText
          x={RING.x}
          y={CAPTION_Y}
          anchor="middle"
          size={40}
          weight={800}
        >
          Et eget økosystem
        </MapText>

        {/* TanStack Start: on out of the map, with the web's own names. */}
        <Line
          points={[
            [BADGE_X, LINE_Y],
            [1920, LINE_Y],
          ]}
          className="tanstack__start-linje"
        />
        <g
          className="tanstack__tog tanstack__tog--ut"
          style={{ offsetPath: `path("M${BADGE_X + 160} ${LINE_Y} H1960")` }}
        >
          <circle r={11} />
        </g>
        <LineBadge
          x={BADGE_X}
          y={LINE_Y}
          text="TanStack Start"
          width={320}
          className="tanstack__badge--start"
        />
        {START_STOPS.map((stop) => (
          <g key={stop.label}>
            <Station
              x={stop.x}
              y={LINE_Y}
              className="tanstack__stasjon--start"
            />
            <MapText
              x={stop.x}
              y={LINE_Y - 58}
              anchor="middle"
              size={34}
              mono
              className="tanstack__navn"
            >
              {stop.label}
            </MapText>
          </g>
        ))}
        <MapText x={BADGE_X - 160} y={CAPTION_Y} size={40} weight={800}>
          Bruker webens egne deler
        </MapText>
      </LineMap>
    </div>
  );
}

export const tanstackStart: Slide = {
  id: "tanstack-start",
  title: "Vi bygde dashboardet med TanStack Start",
  rooms: ["frontend"],
  Component: TanstackStart,
};
