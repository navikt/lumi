import type { CSSProperties } from "react";
import apen from "../../assets/skjermbilder/dinesykmeldte-apen.webp";
import fritekst from "../../assets/skjermbilder/dinesykmeldte-fritekst.webp";
import lukket from "../../assets/skjermbilder/dinesykmeldte-lukket.webp";
import type { Slide, SlideProps } from "../../engine";
import { LineMap, MapText, roundedPath } from "../../map";
import { type Boks, type Peker, PekerLinje, Ramme } from "./SporsmalPeker";
import "./sporsmal.css";

/*
 * The reminder survey in Dine sykmeldte, as the users see it, from the
 * public demo with a test person. The screenshots are 1280 × 800 CSS px in
 * 2×. First the whole app as it is, not dimmed, with a ring in Lumi's blue
 * round the button that is the survey. Then the camera moves in on the
 * lower right corner while the button opens into the widget. On the free
 * text page one thing is pointed at, in the same blue: the notice about
 * personal data, which the next slide picks up.
 */

const SHOT = { width: 2560, height: 1600 } as const;

/** A point on the stage. */
interface Punkt {
  x: number;
  y: number;
}

/**
 * The app's lower right corner on the stage. The camera zooms in on it, and
 * moves a little left as it goes in, so the widget lands in the middle.
 */
const WIDE_CORNER: Punkt = { x: 1392, y: 990 };
const CLOSE_CORNER: Punkt = { x: 1320, y: 990 };

/** Step 0: the whole app, one CSS px per stage px. Then the widget, larger. */
const WIDE = 0.5;
const CLOSE = 0.78;

/** A rectangle in the pixels of the screenshot, with its corner radius. */
interface Flate extends Boks {
  radius: number;
}

/** Measured in the screenshots: the closed button and the two open panels. */
const BUTTON: Flate = { x: 2066, y: 1448, width: 416, height: 104, radius: 52 };
const PANEL: Flate = { x: 1714, y: 612, width: 768, height: 941, radius: 16 };
const PANEL_TEXT: Flate = { ...PANEL, y: 732, height: 821 };
const NOTICE: Boks = { x: 1748, y: 1210, width: 699, height: 179 };

/** Where a point in the screenshot lands on the stage, close up. */
function close(x: number, y: number): [number, number] {
  return [
    Math.round(CLOSE_CORNER.x - (SHOT.width - x) * CLOSE),
    Math.round(CLOSE_CORNER.y - (SHOT.height - y) * CLOSE),
  ];
}

/** Where a point in the screenshot lands on the stage, with the whole app. */
function wide(x: number, y: number): [number, number] {
  return [
    Math.round(WIDE_CORNER.x - (SHOT.width - x) * WIDE),
    Math.round(WIDE_CORNER.y - (SHOT.height - y) * WIDE),
  ];
}

/** A box in the screenshot, on the stage close up, grown by `grow` px. */
function onStage(box: Boks, grow = 0): Boks {
  const [x, y] = close(box.x, box.y);
  return {
    x: x - grow,
    y: y - grow,
    width: Math.round(box.width * CLOSE) + grow * 2,
    height: Math.round(box.height * CLOSE) + grow * 2,
  };
}

/**
 * What the stage shows: the zoom about the corner, and the window onto the
 * screenshot, which ends at the corner.
 */
interface View {
  scale: number;
  corner: Punkt;
  left: number;
  top: number;
}

/** The camera: the screenshot scaled about the corner. */
function camera({ scale, corner }: View): CSSProperties {
  const x = corner.x - SHOT.width * scale;
  const y = corner.y - SHOT.height * scale;
  return { transform: `translate(${x}px, ${y}px) scale(${scale})` };
}

function clipFor({ corner, left, top }: View): CSSProperties {
  return {
    clipPath: `inset(${top}px ${1920 - corner.x}px ${1080 - corner.y}px ${left}px round 12px)`,
  };
}

/** The same rectangle as a box, for the edge drawn on paper. */
function edgeFor({ corner, left, top }: View): CSSProperties {
  return { left, top, width: corner.x - left, height: corner.y - top };
}

/**
 * Close up, the window keeps a strip of the page left of and above the
 * panel, so the widget is still seen sitting in the app.
 */
const [PANEL_LEFT, PANEL_TOP] = close(PANEL.x, PANEL.y);
const WIDE_VIEW: View = {
  scale: WIDE,
  corner: WIDE_CORNER,
  left: WIDE_CORNER.x - SHOT.width * WIDE,
  top: WIDE_CORNER.y - SHOT.height * WIDE,
};
const CLOSE_VIEW: View = {
  scale: CLOSE,
  corner: CLOSE_CORNER,
  left: PANEL_LEFT - 44,
  top: PANEL_TOP - 20,
};

/** Shows one part of another screenshot over the closed page: the open panel. */
function lit(box: Flate): CSSProperties {
  const right = SHOT.width - box.x - box.width;
  const bottom = SHOT.height - box.y - box.height;
  return {
    clipPath: `inset(${box.y}px ${right}px ${bottom}px ${box.x}px round ${box.radius}px)`,
  };
}

/*
 * With the whole app, a ring round the button, which is the survey before
 * it opens. Its name stands right of the app, above the Teams corner: the
 * line goes out from the ring and turns up to it, as on the map.
 */
const [BUTTON_X, BUTTON_Y] = wide(BUTTON.x, BUTTON.y);
const RING_GROW = 10;
const BUTTON_RING: Boks = {
  x: BUTTON_X - RING_GROW,
  y: BUTTON_Y - RING_GROW,
  width: BUTTON.width * WIDE + RING_GROW * 2,
  height: BUTTON.height * WIDE + RING_GROW * 2,
};
const RING_MID_Y = BUTTON_RING.y + BUTTON_RING.height / 2;
const BEND_X = WIDE_CORNER.x + 36;
const SURVEY_LABEL_Y = 760;
const SURVEY_LINE = roundedPath(
  [
    [BUTTON_RING.x + BUTTON_RING.width, RING_MID_Y],
    [BEND_X, RING_MID_Y],
    [BEND_X, SURVEY_LABEL_Y],
  ],
  24,
);

/*
 * The notice gets Lumi's blue frame, as on «Hva kan dere endre i
 * widgeten?», and its name starts right of the app. The ring sits high on
 * the frame, so the name ends above the Teams corner.
 */
const NOTICE_FRAME = onStage(NOTICE, 9);
const NOTICE_POINTER: Peker = {
  at: [NOTICE_FRAME.x + NOTICE_FRAME.width, close(0, 1262)[1]],
  label: "Varselet",
  note: "om personopplysninger",
};
const LABEL_X = CLOSE_CORNER.x + 48;

/** Shown on its own step only. */
function only(step: number, shown: number) {
  return {
    "data-reveal": "",
    "data-revealed": step === shown ? "" : undefined,
  };
}

function IAppen({ step, active }: SlideProps) {
  const near = step >= 1;
  const view = near ? CLOSE_VIEW : WIDE_VIEW;
  // The ring draws itself when the slide is presented, not while it waits.
  const ring = step === 0 && active;
  return (
    <div className="slide iappen" data-near={near ? "" : undefined}>
      <h2 className="iappen__title">Slik ser surveyen ut i Dine sykmeldte</h2>
      <div className="iappen__window" style={clipFor(view)}>
        <div className="iappen__camera" style={camera(view)}>
          <img className="iappen__shot" src={lukket} alt="" aria-hidden />
          {/* The panel opens out of the button: the light grows from it. */}
          <img
            className="iappen__shot iappen__shot--apen"
            src={apen}
            alt="Surveyen er åpnet: Hvor nyttig er tilbudet om påminnelse på e-post for deg? Svaralternativene Veldig nyttig, Ganske nyttig, Lite nyttig, Ikke nyttig og Vet ikke, og knappen Neste."
            style={lit(step === 0 ? BUTTON : PANEL)}
            {...only(step, 1)}
          />
          <img
            className="iappen__shot"
            src={fritekst}
            alt="Neste side: Vil du fortelle oss mer? (valgfritt), et tekstfelt med 500 tegn igjen, varselet Ikke skriv inn navn eller andre personopplysninger, og knappene Tilbake og Send."
            style={lit(PANEL_TEXT)}
            {...only(step, 2)}
          />
          {/* On top, so the panel grows out from under the button. */}
          <img
            className="iappen__shot iappen__shot--knapp"
            src={lukket}
            alt="Siden for en sykmelding i Dine sykmeldte, med tilbudet Start oppfølging tidlig. Nede til høyre knappen Gi tilbakemelding."
            style={lit(BUTTON)}
            {...only(step, 0)}
          />
        </div>
      </div>
      <div className="iappen__edge" style={edgeFor(view)} />
      <LineMap
        className="iappen__labels"
        label="Knappen Gi tilbakemelding har en blå ring og heter Surveyen. Når surveyen er åpnet og brukeren har trykket Neste, står varselet om personopplysninger under tekstfeltet, med en blå ramme."
      >
        <Ramme
          boks={BUTTON_RING}
          on={ring}
          radius={BUTTON_RING.height / 2}
          start={300}
        />
        <g
          className="peker peker--lumi"
          data-reveal=""
          data-revealed={ring ? "" : undefined}
        >
          <path d={SURVEY_LINE} className="peker__casing" />
          <path d={SURVEY_LINE} className="peker__line" />
          <MapText
            x={BEND_X + 26}
            y={SURVEY_LABEL_Y}
            size={44}
            weight={800}
            className="peker__label"
          >
            Surveyen
          </MapText>
        </g>
        <Ramme boks={NOTICE_FRAME} on={step === 2} radius={20} start={350} />
        <g {...only(step, 2)}>
          <PekerLinje
            peker={NOTICE_POINTER}
            side="right"
            labelX={LABEL_X}
            size={44}
            weight={800}
            tone="lumi"
          />
        </g>
      </LineMap>
      <p className="iappen__source">
        Ute siden 15. oktober. Bildene er fra demoen, med en testperson.
      </p>
    </div>
  );
}

export const iAppen: Slide = {
  id: "i-appen",
  title: "Slik ser surveyen ut i Dine sykmeldte",
  steps: 2,
  Component: IAppen,
};
