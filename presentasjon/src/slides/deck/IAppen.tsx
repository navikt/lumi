import type { CSSProperties } from "react";
import apen from "../../assets/skjermbilder/dinesykmeldte-apen.webp";
import fritekst from "../../assets/skjermbilder/dinesykmeldte-fritekst.webp";
import lukket from "../../assets/skjermbilder/dinesykmeldte-lukket.webp";
import type { Slide, SlideProps } from "../../engine";
import { LineMap, MapText } from "../../map";
import { type Peker, PekerLinje } from "./SporsmalPeker";
import "./sporsmal.css";

/*
 * The reminder survey in Dine sykmeldte, from the public demo with a test
 * person. The screenshots are 1280 × 800 CSS px in 2×. First the whole
 * app, then the camera moves in on the lower right corner, where the
 * widget sits. Only the widget is lit, the page round it is dimmed.
 */

const SHOT = { width: 2560, height: 1600 } as const;

/** The app's lower right corner on the stage. The camera zooms in on it. */
const CORNER = { x: 1392, y: 990 } as const;

/** Step 0: the whole app, one CSS px per stage px. Then the widget, larger. */
const WIDE = 0.5;
const CLOSE = 0.78;

/** A rectangle in the pixels of the screenshot. */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

/** Measured in the screenshots: the closed button and the two open panels. */
const BUTTON: Box = { x: 2066, y: 1448, width: 416, height: 104, radius: 52 };
const PANEL: Box = { x: 1714, y: 612, width: 768, height: 941, radius: 16 };
const PANEL_TEXT: Box = { ...PANEL, y: 732, height: 821 };

/** Where a point in the screenshot lands on the stage, close up. */
function close(x: number, y: number): [number, number] {
  return [
    Math.round(CORNER.x - (SHOT.width - x) * CLOSE),
    Math.round(CORNER.y - (SHOT.height - y) * CLOSE),
  ];
}

/** The camera: the screenshot scaled about the corner. */
function camera(scale: number): CSSProperties {
  const x = CORNER.x - SHOT.width * scale;
  const y = CORNER.y - SHOT.height * scale;
  return { transform: `translate(${x}px, ${y}px) scale(${scale})` };
}

/** The window: what the stage shows of the screenshot. It ends at the corner. */
interface Window {
  left: number;
  top: number;
}

function clipFor({ left, top }: Window): CSSProperties {
  return {
    clipPath: `inset(${top}px ${1920 - CORNER.x}px ${1080 - CORNER.y}px ${left}px round 12px)`,
  };
}

/** The same rectangle as a box, for the edge drawn on paper. */
function edgeFor({ left, top }: Window): CSSProperties {
  return { left, top, width: CORNER.x - left, height: CORNER.y - top };
}

/**
 * Close up, the window keeps a strip of the page left of and above the
 * panel, dimmed further, so the widget is still seen sitting in the app.
 */
const [PANEL_LEFT, PANEL_TOP] = close(PANEL.x, PANEL.y);
const WIDE_WINDOW: Window = {
  left: CORNER.x - SHOT.width * WIDE,
  top: CORNER.y - SHOT.height * WIDE,
};
const CLOSE_WINDOW: Window = { left: PANEL_LEFT - 44, top: PANEL_TOP - 20 };

/** Lights one part of the screenshot: the rest stays under the dimmed layer. */
function lit(box: Box): CSSProperties {
  const right = SHOT.width - box.x - box.width;
  const bottom = SHOT.height - box.y - box.height;
  return {
    clipPath: `inset(${box.y}px ${right}px ${bottom}px ${box.x}px round ${box.radius}px)`,
  };
}

/*
 * The team's names end left of the panel, Lumi's start right of the app.
 * Each pointer ends on the panel's edge, level with what it names. The
 * question is two lines: the pointer meets the middle of them.
 */
const TEAM_X = PANEL_LEFT - 100;
const LUMI_X = CORNER.x + 48;
const QUESTION_Y = 703;
const HEADER_Y = close(0, QUESTION_Y)[1] - 84;

const STEP_1: { team: readonly Peker[]; lumi: readonly Peker[] } = {
  team: [
    { at: close(PANEL.x, QUESTION_Y), label: "Spørsmålet" },
    { at: close(PANEL.x, 1151), label: "Svaralternativene" },
  ],
  lumi: [
    {
      at: close(PANEL.x + PANEL.width, QUESTION_Y),
      label: "Utseendet",
      note: "fra Aksel",
    },
  ],
};

const STEP_2: typeof STEP_1 = {
  team: [
    {
      at: close(PANEL.x, 795),
      label: "Oppfølgingsspørsmålet",
      note: "med fritekst",
    },
  ],
  lumi: [
    {
      at: [close(2447, 0)[0], close(0, 1250)[1]],
      label: "Varselet",
      note: "om personopplysninger",
    },
  ],
};

/** Shown on its own step only. */
function only(step: number, shown: number) {
  return {
    "data-reveal": "",
    "data-revealed": step === shown ? "" : undefined,
  };
}

function Pointers({ team, lumi }: typeof STEP_1) {
  return (
    <>
      {team.map((peker) => (
        <PekerLinje
          key={peker.label}
          peker={peker}
          side="left"
          labelX={TEAM_X}
          size={44}
          weight={800}
        />
      ))}
      {lumi.map((peker) => (
        <PekerLinje
          key={peker.label}
          peker={peker}
          side="right"
          labelX={LUMI_X}
          size={44}
          weight={800}
        />
      ))}
    </>
  );
}

function IAppen({ step }: SlideProps) {
  const near = step >= 1;
  const view = near ? CLOSE_WINDOW : WIDE_WINDOW;
  return (
    <div className="slide iappen" data-near={near ? "" : undefined}>
      <h2 className="iappen__title">Et eksempel fra Dine sykmeldte</h2>
      <div className="iappen__window" style={clipFor(view)}>
        <div className="iappen__camera" style={camera(near ? CLOSE : WIDE)}>
          <img className="iappen__shot" src={lukket} alt="" aria-hidden />
          <div className="iappen__dim" />
          <img
            className="iappen__shot"
            src={lukket}
            alt="Siden for en sykmelding i Dine sykmeldte, med tilbudet Start oppfølging tidlig. Nede til høyre knappen Gi tilbakemelding."
            style={lit(BUTTON)}
            {...only(step, 0)}
          />
          <img
            className="iappen__shot"
            src={apen}
            alt="Surveyen er åpnet: Hvor nyttig er tilbudet om påminnelse på e-post for deg? Svaralternativene Veldig nyttig, Ganske nyttig, Lite nyttig, Ikke nyttig og Vet ikke, og knappen Neste."
            style={lit(PANEL)}
            {...only(step, 1)}
          />
          <img
            className="iappen__shot"
            src={fritekst}
            alt="Neste side: Vil du fortelle oss mer? (valgfritt), et tekstfelt med 500 tegn igjen, varselet Ikke skriv inn navn eller andre personopplysninger, og knappene Tilbake og Send."
            style={lit(PANEL_TEXT)}
            {...only(step, 2)}
          />
        </div>
      </div>
      <div className="iappen__edge" style={edgeFor(view)} />
      <LineMap
        className="iappen__labels"
        label="Til venstre det teamet bestemte: spørsmålet, svaralternativene og et oppfølgingsspørsmål med fritekst. Til høyre det Lumi gir: utseendet fra Aksel og varselet om personopplysninger."
      >
        <g data-from={1}>
          <MapText x={TEAM_X} y={HEADER_Y} anchor="end" muted weight={700}>
            Teamet bestemte
          </MapText>
          <MapText x={LUMI_X} y={HEADER_Y} muted weight={700}>
            Lumi gir
          </MapText>
        </g>
        <g {...only(step, 1)}>
          <Pointers {...STEP_1} />
        </g>
        <g {...only(step, 2)}>
          <Pointers {...STEP_2} />
        </g>
      </LineMap>
      <p className="iappen__source">
        Ute nå. Bildene er fra demoen, med en testperson.
      </p>
    </div>
  );
}

export const iAppen: Slide = {
  id: "i-appen",
  title: "Et eksempel fra Dine sykmeldte",
  steps: 2,
  notes: `Fra start: «Dette er et eksempel på en survey som er ute nå.» Siden 15. oktober ligger den i Dine sykmeldte, appen der ledere følger opp sykmeldte. Lederen ser knappen «Gi tilbakemelding» nede til høyre, ved siden av tilbudet om påminnelse. Bildene er fra den offentlige demoen, med en testperson.

Hvis noen spør når den kommer opp: som standard åpner surveyen seg når siden lastes, nede til høyre. Lukker brukeren den, blir den knappen «Gi tilbakemelding», og den åpner seg ikke av seg selv igjen før etter 30 dager. På nav.no krever det at brukeren har samtykket. Uten samtykke starter den som knappen, slik som i demoen. Interne apper uten dekoratøren setter storageStrategy til localStorage, så åpner den seg av seg selv og husker at saksbehandleren lukket den.

Klikk 1: lederen trykker og får ett spørsmål: «Hvor nyttig er tilbudet om påminnelse på e-post for deg?» Teamet bak Dine sykmeldte laget spørsmålet og svaralternativene i Surveyverksted. Utseendet kommer fra Lumi, bygd med Aksel.

Klikk 2: etter «Neste» kommer et oppfølgingsspørsmål med fritekst, «Vil du fortelle oss mer?». Varselet om personopplysninger følger med fra Lumi. Koden er offentlig, i repoet navikt/dinesykmeldte.`,
  Component: IAppen,
};
