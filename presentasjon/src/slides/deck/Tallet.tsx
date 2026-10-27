import type { Slide, SlideProps } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import { Answer, LineMap, MapText } from "../../map";
import { useBuildMotion } from "./bevisMotion";
import "./bevis.css";

/**
 * Every dot is a hundred answers, rounded: 29 853 is 299 dots and 1 092 is
 * 11. A block holds a hundred dots, ten by ten, counted column by column
 * from the bottom. Modia's eleven stand in one row, level with the top row.
 */
const TEAM_ESYFO_BLOCKS = [100, 100, 99] as const;
const MODIA_COUNT = 11;

const PITCH = 34;
const ROWS = 10;
const DOT_R = 12.5;
const BLOCK_GAP = 24;
const GROUP_GAP = 120;
const LEFT = 112;
const LABEL_Y = 454;
const NOTE_Y = LABEL_Y + 44;
const DOTS_TOP = 532;
const DOTS_BOTTOM = DOTS_TOP + ROWS * PITCH;
const TOP_ROW_Y = DOTS_TOP + PITCH / 2;
const LEGEND_Y = DOTS_BOTTOM + 58;
/** The pen ring round Modia's row stands this far off the dots. */
const RING_PAD = 12;

interface Dot {
  x: number;
  y: number;
  /** Place in the counting order, for the light-up. */
  n: number;
  block: number;
}

const blockWidth = (count: number) => Math.ceil(count / ROWS) * PITCH;

/** Blocks side by side, each filled column by column from the bottom. */
function layoutBlocks(left: number, blocks: readonly number[]): Dot[] {
  const dots: Dot[] = [];
  let blockX = left;
  blocks.forEach((count, block) => {
    for (let i = 0; i < count; i++) {
      dots.push({
        x: blockX + Math.floor(i / ROWS) * PITCH + PITCH / 2,
        y: DOTS_BOTTOM - (i % ROWS) * PITCH - PITCH / 2,
        n: dots.length,
        block,
      });
    }
    blockX += blockWidth(count) + BLOCK_GAP;
  });
  return dots;
}

/** One row, from the left. */
function layoutRow(left: number, count: number): Dot[] {
  return Array.from({ length: count }, (_, n) => ({
    x: left + n * PITCH + PITCH / 2,
    y: TOP_ROW_Y,
    n,
    block: 0,
  }));
}

const TEAM_ESYFO_WIDTH =
  TEAM_ESYFO_BLOCKS.reduce((sum, count) => sum + blockWidth(count), 0) +
  BLOCK_GAP * (TEAM_ESYFO_BLOCKS.length - 1);
const MODIA_X = LEFT + TEAM_ESYFO_WIDTH + GROUP_GAP;
const TEAM_ESYFO_DOTS = layoutBlocks(LEFT, TEAM_ESYFO_BLOCKS);
const MODIA_DOTS = layoutRow(MODIA_X, MODIA_COUNT);

function Dots({ dots }: { dots: readonly Dot[] }) {
  return dots.map((dot) => (
    <Answer
      key={`${dot.x},${dot.y}`}
      x={dot.x}
      y={dot.y}
      r={DOT_R}
      className="tallet__dot"
      style={cssVars({ "--n": dot.n, "--block": dot.block })}
    />
  ));
}

function Tallet({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div
      className={cx("slide tallet", step === 0 && "tallet--alone")}
      data-motion={motion ? "" : undefined}
    >
      <h2 className="tallet__number">30&#8239;945 svar</h2>
      <p className="tallet__period" data-from={1}>
        Fra 1. januar til 21. oktober 2026 i sju apper i to team.
      </p>
      <LineMap label="Prikkdiagram der hver prikk er 100 svar. Team eSyfo: 299 prikker, 29 853 svar i seks apper. iSyfo i Modia: 11 prikker på én rad, 1 092 svar fra veiledere i Modia.">
        <g className="tallet__labels" data-from={1}>
          <MapText x={LEFT} y={LABEL_Y} size={36} weight={800}>
            Team eSyfo
          </MapText>
          <MapText x={LEFT} y={NOTE_Y} size={32} weight={500} muted>
            29 853 svar i seks apper
          </MapText>
        </g>
        <g className="tallet__unit-label" data-from={1}>
          <MapText
            x={LEFT + PITCH + 14}
            y={LEGEND_Y + 2}
            size={32}
            weight={600}
          >
            = 100 svar
          </MapText>
        </g>
        {/* The pen goes round Modia's eleven once they are in. */}
        <g className="tallet__ring" data-from={2}>
          <rect
            x={MODIA_X - RING_PAD}
            y={TOP_ROW_Y - PITCH / 2 - RING_PAD}
            width={MODIA_COUNT * PITCH + RING_PAD * 2}
            height={PITCH + RING_PAD * 2}
            rx={PITCH / 2 + RING_PAD}
            pathLength={1}
          />
        </g>
        <g className="tallet__modia-labels" data-from={2}>
          <MapText x={MODIA_X} y={LABEL_Y} size={36} weight={800}>
            iSyfo i Modia
          </MapText>
          <MapText x={MODIA_X} y={NOTE_Y} size={32} weight={500} muted>
            1 092 svar fra veiledere i Modia
          </MapText>
        </g>
        {/* One glow for all the dots, not one per dot. */}
        <g className="tallet__glow">
          <g className="tallet__unit" data-from={1}>
            <Answer
              x={LEFT + PITCH / 2}
              y={LEGEND_Y}
              r={DOT_R}
              className="tallet__dot"
            />
          </g>
          <g className="tallet__field" data-from={1}>
            <Dots dots={TEAM_ESYFO_DOTS} />
          </g>
          <g className="tallet__modia" data-from={2}>
            <Dots dots={MODIA_DOTS} />
          </g>
        </g>
      </LineMap>
    </div>
  );
}

export const tallet: Slide = {
  id: "tallet",
  title: "30 945 svar",
  steps: 2,
  Component: Tallet,
};
