import type { Slide, SlideProps } from "../../engine";
import { cx } from "../../engine/css";
import { Line, LineMap, MapText } from "../../map";
import { useBuildMotion } from "./bevisMotion";
import "./bevis.css";

/*
 * Before the data: what the team was doing. Step 0 is the old plan, a thin
 * sheet. Click 1: the new plan comes along the arrow, a solid sheet, thin
 * for what was and black for what is. Click 2: one question bubble with two
 * tails comes down on both plans, since the same questions were asked in
 * both. The goal stands in the title. No numbers here: they come on the
 * next slide.
 */

const SHEET = { width: 240, height: 300, fold: 56 } as const;
const SHEET_Y = 590;
const OLD_X = 300;
const NEW_X = 1000;
const LABEL_Y = SHEET_Y + SHEET.height + 52;

const BUBBLE = { x: 112, y: 326, width: 1188, height: 200 } as const;
const TAIL = 30;

const QUESTIONS = [
  { who: "Ledere", question: "«Hvordan var det å bruke oppfølgingsplanen?»" },
  { who: "Sykmeldte", question: "«Er oppfølgingsplanen til hjelp for deg?»" },
] as const;

/** A sheet with its top corner folded down, and lines of text on it. */
function Sheet({ x, kind }: { x: number; kind: "old" | "new" }) {
  const { width: w, height: h, fold } = SHEET;
  const y = SHEET_Y;
  const lines = [0, 1, 2, 3, 4];
  return (
    <g className={`opp-intro__sheet opp-intro__sheet--${kind}`}>
      <path
        className="opp-intro__paper"
        d={`M${x} ${y} H${x + w - fold} L${x + w} ${y + fold} V${y + h} H${x} Z`}
      />
      <path
        className="opp-intro__fold"
        d={`M${x + w - fold} ${y} V${y + fold} H${x + w} Z`}
      />
      {lines.map((i) => (
        <line
          key={i}
          className="opp-intro__line"
          x1={x + 40}
          x2={x + w - (i === lines.length - 1 ? 110 : 40)}
          y1={y + 104 + i * 40}
          y2={y + 104 + i * 40}
        />
      ))}
    </g>
  );
}

/**
 * The bubble's tail, down to the top of a sheet: a fill that covers the
 * bubble's edge where the tail leaves it, and the two sides as a line.
 */
function Tail({ sheetX }: { sheetX: number }) {
  const cx = sheetX + SHEET.width / 2 - 20;
  const top = BUBBLE.y + BUBBLE.height;
  const tip = SHEET_Y - 22;
  return (
    <>
      <path
        className="opp-intro__tail-fill"
        d={`M${cx - TAIL} ${top - 10} L${cx} ${tip} L${cx + TAIL} ${top - 10} Z`}
      />
      <path
        className="opp-intro__tail-edge"
        d={`M${cx - TAIL} ${top} L${cx} ${tip} L${cx + TAIL} ${top}`}
      />
    </>
  );
}

function OppfolgingsplanenIntro({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div
      className={cx("slide opp-intro", step >= 1 && "opp-intro--new")}
      data-motion={motion ? "" : undefined}
    >
      <h2 className="slide-title">
        Den nye oppfølgingsplanen skulle ikke bli dårligere
      </h2>
      <LineMap label="Den gamle oppfølgingsplanen, så en pil til den nye. Samme spørsmål ble stilt i begge planene: til ledere «Hvordan var det å bruke oppfølgingsplanen?», og til sykmeldte «Er oppfølgingsplanen til hjelp for deg?». Den gamle planen ble målt fra oktober 2025 til mars 2026, den nye fra februar til august 2026.">
        <Sheet x={OLD_X} kind="old" />
        <MapText
          x={OLD_X + SHEET.width / 2}
          y={LABEL_Y}
          anchor="middle"
          size={44}
          weight={500}
          muted
        >
          Gammel plan
        </MapText>
        <MapText
          x={OLD_X + SHEET.width / 2}
          y={LABEL_Y + 48}
          anchor="middle"
          size={32}
          weight={500}
          muted
        >
          oktober 2025 til mars 2026
        </MapText>

        <g className="opp-intro__arrive" data-from={1}>
          <Line
            points={[
              [OLD_X + SHEET.width + 50, SHEET_Y + SHEET.height / 2],
              [NEW_X - 50, SHEET_Y + SHEET.height / 2],
            ]}
            arrow
            draw
            from={1}
            className="opp-intro__arrow"
          />
          <g className="opp-intro__new">
            <Sheet x={NEW_X} kind="new" />
            <MapText
              x={NEW_X + SHEET.width / 2}
              y={LABEL_Y}
              anchor="middle"
              size={44}
              weight={800}
            >
              Ny plan
            </MapText>
            <MapText
              x={NEW_X + SHEET.width / 2}
              y={LABEL_Y + 48}
              anchor="middle"
              size={32}
              weight={500}
              muted
            >
              februar til august 2026
            </MapText>
          </g>
        </g>

        <g className="opp-intro__bubble" data-from={2}>
          <rect
            className="opp-intro__box"
            x={BUBBLE.x}
            y={BUBBLE.y}
            width={BUBBLE.width}
            height={BUBBLE.height}
            rx={36}
          />
          <Tail sheetX={OLD_X} />
          <Tail sheetX={NEW_X} />
          {QUESTIONS.map((row, i) => (
            <g key={row.who}>
              <MapText
                x={BUBBLE.x + 44}
                y={BUBBLE.y + 66 + i * 68}
                size={40}
                weight={800}
              >
                {row.who}
              </MapText>
              <MapText
                x={BUBBLE.x + 290}
                y={BUBBLE.y + 66 + i * 68}
                size={40}
                weight={500}
              >
                {row.question}
              </MapText>
            </g>
          ))}
        </g>
      </LineMap>
    </div>
  );
}

export const oppfolgingsplanenIntro: Slide = {
  id: "oppfolgingsplanen-intro",
  title: "Den nye oppfølgingsplanen skulle ikke bli dårligere",
  steps: 2,
  Component: OppfolgingsplanenIntro,
};
