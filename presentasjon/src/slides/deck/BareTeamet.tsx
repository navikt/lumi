import oversikt from "../../assets/skjermbilder/dashboard-oversikt.webp";
import tilbakemeldinger from "../../assets/skjermbilder/dashboard-tilbakemeldinger.webp";
import type { Slide, SlideProps } from "../../engine";
import { Line, LineMap, Station } from "../../map";
import { RouteProgress } from "./RouteProgress";
import { type Box, Callout, FRAME, type Shot, ShotFrame } from "./SammeUtkast";
import "./verksted.css";

/** Three answers in the list, and the delete button on the third. */
const LIST: Box = { x: 1913, y: 802, width: 1113, height: 638 };
const DELETE: Box = { x: 2889, y: 1289, width: 26, height: 34 };

/* Cut close, so the UI text is at least 22 px on the stage. */
const SHOTS: readonly Shot[] = [
  {
    from: 0,
    src: oversikt,
    alt: "Dashboardet for en vurderingssurvey: valg av app, survey og periode, og 62 tilbakemeldinger.",
    crop: { x: 160, y: 124, width: 1302, height: 746 },
  },
  {
    from: 2,
    src: tilbakemeldinger,
    alt: "Tilbakemeldinger: tre svar fra appen syfo-oppfolgingsplan-frontend. Hvert svar har en knapp for å kopiere og en for å slette.",
    crop: LIST,
    mark: DELETE,
  },
];

/** Nais Console joins the frame on its right edge, like a station on a line. */
const NAIS_Y = 470;
const NAIS_X = FRAME.x + FRAME.width + 48 + 22;

function BareTeamet({ step }: SlideProps) {
  return (
    <div className="slide">
      <h2 className="slide-title">Dere ser bare svarene til teamet deres</h2>
      <ShotFrame shots={SHOTS} />
      <LineMap label="Nais Console er koblet til dashboardet og avgjør hvem som får tilgang.">
        <g data-from={1}>
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
        shown={step >= 2}
        crop={LIST}
        mark={DELETE}
        name="Slett tilbakemelding"
      />
      <p className="slide-text shot-text bare-teamet__text" data-from={1}>
        Lumi spør Nais Console hvilke team dere er medlem av.
      </p>
      <RouteProgress at={5} />
    </div>
  );
}

export const bareTeamet: Slide = {
  id: "bare-teamet",
  title: "Dere ser bare svarene til teamet deres",
  steps: 2,
  notes: `Fra start: dashboardet, med testdata.

Klikk 1: Nais Console bestemmer. Lumi spør Nais Console hvilke team dere er medlem av. Endringer i medlemskap virker innen ti minutter.

Klikk 2: Tilbakemeldinger. Hvert svar har en sletteknapp, så teamet kan slette svar med personopplysninger.

Gjelder dashboardet. Lumi lagrer ikke hvem som svarte, heller ikke Nav-identen. I små grupper kan app og tidspunkt likevel røpe hvem som svarte. Team eSyfo drifter databasen. iSyfo leser i dag gjennom en egen analyserolle, som etter planen skal bort når BigQuery-eksporten er på plass.`,
  Component: BareTeamet,
};
