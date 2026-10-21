import type { Slide } from "../../engine";
import { Answer, LineMap, MapText } from "../../map";
import "./bevis.css";

/**
 * Every dot is a hundred answers, rounded: 29 853 is 299 dots and 1 092 is
 * 11. A block holds a hundred dots, ten by ten.
 */
const TEAM_ESYFO_BLOCKS = [100, 100, 99] as const;
const MODIA_BLOCKS = [11] as const;

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
const LEGEND_Y = DOTS_BOTTOM + 58;

interface Dot {
  x: number;
  y: number;
}

const blockWidth = (count: number) => Math.ceil(count / ROWS) * PITCH;

/** Blocks side by side, each filled column by column from the bottom. */
function layoutDots(left: number, blocks: readonly number[]): Dot[] {
  const dots: Dot[] = [];
  let blockX = left;
  for (const count of blocks) {
    for (let i = 0; i < count; i++) {
      dots.push({
        x: blockX + Math.floor(i / ROWS) * PITCH + PITCH / 2,
        y: DOTS_BOTTOM - (i % ROWS) * PITCH - PITCH / 2,
      });
    }
    blockX += blockWidth(count) + BLOCK_GAP;
  }
  return dots;
}

const groupWidth = (blocks: readonly number[]) =>
  blocks.reduce((sum, count) => sum + blockWidth(count), 0) +
  BLOCK_GAP * (blocks.length - 1);

const MODIA_X = LEFT + groupWidth(TEAM_ESYFO_BLOCKS) + GROUP_GAP;
const TEAM_ESYFO_DOTS = layoutDots(LEFT, TEAM_ESYFO_BLOCKS);
const MODIA_DOTS = layoutDots(MODIA_X, MODIA_BLOCKS);

function Dots({ dots }: { dots: readonly Dot[] }) {
  return (
    <g>
      {dots.map((dot) => (
        <Answer
          key={`${dot.x},${dot.y}`}
          x={dot.x}
          y={dot.y}
          r={DOT_R}
          className="tallet__dot"
        />
      ))}
    </g>
  );
}

function Tallet() {
  return (
    <div className="slide">
      <h2 className="slide-title tallet__title">30&#8239;945 svar</h2>
      <p className="slide-text tallet__period">
        1. januar – 21. oktober 2026. Sju apper i to team.
      </p>
      <LineMap label="Rutediagram der hver prikk er 100 svar. Team eSyfo: 299 prikker, 29 853 svar i seks apper. iSyfo i Modia: 11 prikker, 1 092 svar fra veiledere i Modia.">
        <g data-from={1}>
          <MapText x={LEFT} y={LABEL_Y} size={36} weight={800}>
            Team eSyfo
          </MapText>
          <MapText x={LEFT} y={NOTE_Y} size={30} weight={500} muted>
            29 853 svar i seks apper
          </MapText>
          <Dots dots={TEAM_ESYFO_DOTS} />
        </g>
        <g data-from={1}>
          <Answer
            x={LEFT + PITCH / 2}
            y={LEGEND_Y}
            r={DOT_R}
            className="tallet__dot"
          />
          <MapText
            x={LEFT + PITCH + 14}
            y={LEGEND_Y + 2}
            size={30}
            weight={600}
          >
            = 100 svar
          </MapText>
        </g>
        <g data-from={2}>
          <MapText x={MODIA_X} y={LABEL_Y} size={36} weight={800}>
            iSyfo i Modia
          </MapText>
          <MapText x={MODIA_X} y={NOTE_Y} size={30} weight={500} muted>
            1 092 svar fra veiledere i Modia
          </MapText>
          <Dots dots={MODIA_DOTS} />
        </g>
      </LineMap>
    </div>
  );
}

export const tallet: Slide = {
  id: "tallet",
  title: "30 945 svar",
  steps: 2,
  notes: `Ordrett inn: «Det var hvordan det virker. Så til hvor mye det er i bruk.»

Tallene er fra prod-dashboardet 21. oktober 2026. Hver prikk er 100 svar.

Elleve prikker: veiledere i Modia. Detaljer: spør iSyfo.

Spør noen om appene i team-esyfo: bro-frontend, dialogmote-frontend, dinesykmeldte, narmesteleder-frontend, oppfolgingsplan-frontend og syfo-oppfolgingsplan-frontend.

Før kjøring: bekreft at bryteren «Arkiverte» var på da tallene ble hentet. Uten den er svar på arkiverte surveyer ikke med.`,
  Component: Tallet,
};
