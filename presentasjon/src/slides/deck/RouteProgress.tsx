import { cx } from "../../engine/css";
import "./verksted.css";

/** The stations of «Svarets vei» (slide 6), in order. */
const STATIONS = [
  "Teamet lager",
  "Utvikleren legger inn",
  "Brukeren svarer",
  "Appens backend",
  "Lumi API",
  "Teamet leser",
] as const;

const SPACING = 64;
const STOP_R = 11;
const HERE_R = 18;
const PAD = HERE_R + 6;
const LINE_Y = 66;
const LABEL_GAP = 16;
const WIDTH = PAD * 2 + SPACING * (STATIONS.length - 1);
const HEIGHT = LINE_Y + HERE_R + 4;

type Anchor = "start" | "middle" | "end";

/** Labels near the ends grow inwards, so they never leave the page margin. */
function anchorFor(index: number): Anchor {
  if (index <= 1) return "start";
  if (index >= STATIONS.length - 2) return "end";
  return "middle";
}

interface RouteProgressProps {
  /** The station the slide is about: 0 is «Teamet lager», 5 is «Teamet leser». */
  at: number;
  className?: string;
}

/**
 * «You are here» on the line from slide 6, in the lower left corner. The
 * station the slide is about is filled with ink and labelled, the others are
 * small rings.
 */
export function RouteProgress({ at, className }: RouteProgressProps) {
  const here = Math.min(Math.max(Math.round(at), 0), STATIONS.length - 1);
  const x = (index: number) => PAD + index * SPACING;
  const anchor = anchorFor(here);
  const labelX =
    anchor === "start"
      ? x(here) - HERE_R
      : anchor === "end"
        ? x(here) + HERE_R
        : x(here);

  return (
    <svg
      className={cx("route-progress", className)}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label={`Svarets vei. Du er her: ${STATIONS[here]}, stasjon ${here + 1} av ${STATIONS.length}.`}
    >
      <path
        className="route-progress__line"
        d={`M${x(0)} ${LINE_Y} H${x(STATIONS.length - 1)}`}
      />
      {STATIONS.map((name, index) =>
        index === here ? null : (
          <circle
            key={name}
            cx={x(index)}
            cy={LINE_Y}
            r={STOP_R}
            className="route-progress__stop"
          />
        ),
      )}
      <circle
        cx={x(here)}
        cy={LINE_Y}
        r={HERE_R}
        className="route-progress__here"
      />
      <text
        x={labelX}
        y={LINE_Y - HERE_R - LABEL_GAP}
        textAnchor={anchor}
        className="route-progress__label"
      >
        {STATIONS[here]}
      </text>
    </svg>
  );
}
