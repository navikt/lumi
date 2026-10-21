import markor from "../../assets/skjermbilder/dashboard-markor.webp";
import svaretFraSalen from "../../assets/skjermbilder/dashboard-svaret-fra-salen.webp";
import type { Slide, SlideProps } from "../../engine";
import { Line, LineMap, Station } from "../../map";
import { RouteProgress } from "./RouteProgress";
import { type Box, Callout, FRAME, type Shot, ShotFrame } from "./SammeUtkast";
import "./verksted.css";

/* From the dashboard in mock mode, at 2×. */
const CHART: Box = { x: 1800, y: 61, width: 1150, height: 659 };
const MARKER: Box = { x: 2014, y: 200, width: 346, height: 410 };
/*
 * The list with a test row opened. Its text is the answer from «Svar meg»,
 * as Lumi API would have stored it.
 */
const LIST: Box = { x: 240, y: 1060, width: 1800, height: 1032 };
const MASKED: Box = { x: 278, y: 1942, width: 852, height: 40 };
const DELETE: Box = { x: 1964, y: 1375, width: 36, height: 38 };

/* Cut close, so the UI text is about 22 px on the stage. */
const SHOTS: readonly Shot[] = [
  {
    from: 0,
    src: markor,
    alt: "Grafen Gjennomsnittlig vurdering i dashboardet, med en stiplet markør 13. oktober: Kortere tekst på første side.",
    crop: CHART,
    mark: MARKER,
  },
  {
    from: 2,
    src: svaretFraSalen,
    alt: "Tilbakemeldinger med ett svar åpnet. Hvordan har dagen vært så langt?, 1 av 5. Vil du fortelle mer?: Fikk ikke sendt skjemaet. Send svar til [E-POST FJERNET]. Svaret er merket Redigert, og hvert svar har en knapp for å slette.",
    crop: LIST,
    mark: MASKED,
  },
  {
    from: 3,
    src: svaretFraSalen,
    alt: "Den samme lista, med knappen for å slette svaret markert.",
    crop: LIST,
    mark: DELETE,
  },
];

/** Nais Console joins the frame on its right edge, like a station on a line. */
const NAIS_Y = 470;
const NAIS_X = FRAME.x + FRAME.width + 48 + 22;

function BareTeamet({ step }: SlideProps) {
  // The station sits where the delete callout goes on the last step.
  const naisShown = step === 1 || step === 2;
  return (
    <div className="slide">
      <h2 className="slide-title">Dere ser bare svarene til teamet deres</h2>
      <ShotFrame shots={SHOTS} step={step} />
      <LineMap label="Nais Console er koblet til dashboardet og avgjør hvem som får tilgang.">
        <g data-reveal="" data-revealed={naisShown ? "" : undefined}>
          <Line
            points={[
              [FRAME.x + FRAME.width, NAIS_Y],
              [NAIS_X, NAIS_Y],
            ]}
          />
          <Station
            x={NAIS_X}
            y={NAIS_Y}
            label="Nais Console"
            note="avgjør tilgangen"
          />
        </g>
      </LineMap>
      <Callout
        shown={step === 0}
        crop={CHART}
        mark={MARKER}
        note="Gjennomsnittlig vurdering"
        name="Markør for en endring"
      />
      <Callout
        shown={step === 2}
        crop={LIST}
        mark={MASKED}
        note="e-posten er fjernet"
        name="Svaret fra i stad"
      />
      <Callout
        shown={step === 3}
        crop={LIST}
        mark={DELETE}
        name="Slett tilbakemelding"
      />
      <RouteProgress at={5} />
    </div>
  );
}

export const bareTeamet: Slide = {
  id: "bare-teamet",
  title: "Dere ser bare svarene til teamet deres",
  steps: 3,
  notes: `Inn: «Hvem får lese svaret i dashboardet? Bare teamet deres.»

Fra start: grafen Gjennomsnittlig vurdering, med testdata. Teamet kan sette en markør den dagen en endring går i produksjon, og se kurven før og etter.

Klikk 1: Nais Console avgjør tilgangen. Lumi spør Nais Console hvilke team dere er medlem av. Endringer i medlemskap virker innen ti minutter.

Klikk 2: «Husker dere svaret fra i stad?» Lista med tilbakemeldinger, med svaret åpnet. E-postadressen er fjernet, og svaret er merket Redigert. Bildet er testdata med samme tekst.

Klikk 3: Hvert svar har en sletteknapp, så teamet kan slette svar med personopplysninger.

Gjelder dashboardet. Lumi lagrer ikke hvem som svarte, heller ikke Nav-identen. I små grupper kan app, tidspunkt, enhet og det som står i svaret likevel røpe hvem som svarte. Lederen til den som svarte, ser ikke svarene i Lumi, med mindre hen er med i teamet i Nais Console.

Svarene kan lastes ned som CSV, Excel og JSON fra dashboardet. iSyfo bruker svarene sine i en datafortelling. Detaljer: spør iSyfo.`,
  Component: BareTeamet,
};
