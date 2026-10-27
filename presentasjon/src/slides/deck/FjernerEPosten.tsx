import { useId } from "react";
import shot from "../../assets/skjermbilder/dashboard-maskert.webp";
import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import { useBuildMotion } from "./bevisMotion";
import "./premiss.css";

/*
 * The answer from mer-enn-vi-spor-om, as the team sees it: a row in the mock
 * dashboard (test data), opened, in light mode. The text is set into a row
 * Lumi had already redacted, so the tag «Redigert» is the dashboard's own.
 * The still is 1146 × 372 CSS px of the dashboard at 1180 px wide, in 3×,
 * and the window shows it 1680 px wide: the UI text is about 26 px on the
 * stage.
 *
 * Each click dims the window, all but what the speaker points at, and a
 * magnifying glass shows the words in the answer at 1.6×, about 42 px. It
 * reads the answer: click 1 the phone number Lumi removed, click 2 the
 * e-mail address, both in Lumi's blue, and it leaves a blue ring on what it
 * has shown. Click 3, the honest limit: it travels to the name, which is
 * still there, in orange, and a green ring goes round the button the team
 * deletes the answer with.
 */

const WINDOW = { width: 1680, height: 545 } as const;

/** A mark round a word or a control, in stage px from the window's corner. */
interface Mark {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Measured in the dashboard, times 1680 / 1146. */
const PHONE: Mark = { x: 802, y: 471, width: 220, height: 37 };
const EMAIL: Mark = { x: 1166, y: 471, width: 200, height: 37 };
const REDIGERT: Mark = { x: 426, y: 95, width: 124, height: 35 };
const NAME: Mark = { x: 330, y: 471, width: 168, height: 37 };
const DELETE: Mark = { x: 1615, y: 56, width: 35, height: 35 };

/** The light reaches a little past what it marks. */
const PAD = { x: 10, y: 6 } as const;

type Step = 1 | 2 | 3;
const STEPS: readonly Step[] = [1, 2, 3];

/** What each step lights. The rest of the window is dimmed. */
const LIT: Record<Step, readonly Mark[]> = {
  1: [PHONE, REDIGERT],
  2: [PHONE, EMAIL, REDIGERT],
  3: [PHONE, EMAIL, REDIGERT, NAME, DELETE],
};

/**
 * The rings, in the colour of who acts, from the step they are drawn on.
 * The glass leaves a blue ring on what it has shown.
 */
const RINGS = [
  { from: 1, mark: REDIGERT, tone: "lumi" },
  { from: 2, mark: PHONE, tone: "lumi" },
  { from: 3, mark: EMAIL, tone: "lumi" },
  { from: 3, mark: DELETE, tone: "team" },
] as const;

/** Where the glass lies on each step. */
const LENS_AT: Record<Step, Mark> = { 1: PHONE, 2: EMAIL, 3: NAME };

/** The glass: its radius, and how much it enlarges. */
const GLASS = 200;
const ZOOM = 1.6;

const centre = (mark: Mark) => ({
  x: mark.x + mark.width / 2,
  y: mark.y + mark.height / 2,
});

const clampStep = (step: number): Step =>
  step >= 3 ? 3 : step <= 1 ? 1 : (step as Step);

/** Shown on its own step only. */
function only(step: number, shown: number) {
  return {
    "data-reveal": "",
    "data-revealed": step === shown ? "" : undefined,
  };
}

/** Shown from a step on. */
function from(step: number, first: number) {
  return {
    "data-reveal": "",
    "data-revealed": step >= first ? "" : undefined,
  };
}

function Lens({ step }: { step: number }) {
  const at = centre(LENS_AT[clampStep(step)]);
  return (
    <div
      className={cx(
        "fjerner__lens",
        step >= 1 && "fjerner__lens--on",
        step >= 3 && "fjerner__lens--name",
        step === 1 && "fjerner__lens--first",
      )}
      style={{ transform: `translate(${at.x - GLASS}px, ${at.y - GLASS}px)` }}
      aria-hidden="true"
    >
      <span className="fjerner__lens-body">
        <span className="fjerner__lens-handle" />
        <span className="fjerner__lens-glass">
          <span
            className="fjerner__lens-world"
            style={{
              ...cssVars({ "--zoom": ZOOM }),
              transform: `translate(${GLASS - at.x * ZOOM}px, ${GLASS - at.y * ZOOM}px)`,
            }}
          >
            <img
              className="fjerner__lens-shot"
              src={shot}
              alt=""
              width={WINDOW.width * ZOOM}
              height={WINDOW.height * ZOOM}
            />
          </span>
        </span>
        <span className="fjerner__lens-rim" />
      </span>
    </div>
  );
}

function FjernerEPosten({ step, active }: SlideProps) {
  // A mask id per instance: the overview and the print view show the slide twice.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const motion = useBuildMotion(step, active);
  return (
    <div className="slide fjerner" data-motion={motion ? "" : undefined}>
      <h2 className="fjerner__title">
        Lumi fjerner telefonnummer og e-post før svaret lagres
      </h2>
      <div className="fjerner__window">
        <img
          className="fjerner__shot"
          src={shot}
          width={WINDOW.width}
          height={WINDOW.height}
          alt="Skjermbilde fra dashboardet med testdata. Tilbakemeldingen er åpnet: vurderingen 1 av 5, og svaret på «Hva kan vi gjøre bedre?»: «Lederen min, Kari Nordmann, svarer ikke. Ring henne på [TELEFON FJERNET] eller skriv til [E-POST FJERNET]». Raden er merket Redigert og har en knapp for å slette svaret."
        />
        <svg
          className="fjerner__marks"
          viewBox={`0 0 ${WINDOW.width} ${WINDOW.height}`}
          aria-hidden="true"
        >
          <defs>
            {STEPS.map((at) => (
              <mask key={at} id={`${id}-${at}`}>
                <rect
                  width={WINDOW.width}
                  height={WINDOW.height}
                  fill="white"
                />
                {LIT[at].map((mark) => (
                  <rect
                    key={`${mark.x} ${mark.y}`}
                    x={mark.x - PAD.x}
                    y={mark.y - PAD.y}
                    width={mark.width + PAD.x * 2}
                    height={mark.height + PAD.y * 2}
                    rx={10}
                    fill="black"
                  />
                ))}
              </mask>
            ))}
          </defs>
          {STEPS.map((at) => (
            <rect
              key={at}
              className="fjerner__dim"
              width={WINDOW.width}
              height={WINDOW.height}
              mask={`url(#${id}-${at})`}
              {...only(step, at)}
            />
          ))}
          {RINGS.map(({ from: first, mark, tone }) => (
            <g
              key={`${mark.x} ${mark.y}`}
              className={`fjerner__ring fjerner__ring--${tone}`}
              style={cssVars({
                "--ring-delay": first === 1 ? "420ms" : "360ms",
              })}
              {...from(step, first)}
            >
              {["halo", "line"].map((part) => (
                <rect
                  key={part}
                  className={`fjerner__ring-${part}`}
                  x={mark.x - PAD.x - 4}
                  y={mark.y - PAD.y - 4}
                  width={mark.width + PAD.x * 2 + 8}
                  height={mark.height + PAD.y * 2 + 8}
                  rx={14}
                  pathLength={1}
                />
              ))}
            </g>
          ))}
        </svg>
        <Lens step={step} />
      </div>
      <p className="fjerner__caption" data-from={3}>
        Navnet står igjen, men dere kan slette svaret.
      </p>
      <Tag kind="screenshot" className="fjerner__tag" />
    </div>
  );
}

export const fjernerEPosten: Slide = {
  id: "fjerner-e-posten",
  title: "Lumi fjerner telefonnummer og e-post før svaret lagres",
  steps: 3,
  Component: FjernerEPosten,
};
