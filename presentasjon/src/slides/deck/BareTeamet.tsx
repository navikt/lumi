import oversikt from "../../assets/skjermbilder/dashboard-oversikt.webp";
import tilbakemeldinger from "../../assets/skjermbilder/dashboard-tilbakemeldinger.webp";
import { Tag } from "../../components/Tag";
import type { Slide, SlideProps } from "../../engine";
import { Line, LineMap, Station } from "../../map";
import { RouteProgress } from "./RouteProgress";
import { Callout, FRAME, type Shot, ShotFrame } from "./SammeUtkast";
import "./verksted.css";

const SHOTS: readonly Shot[] = [
  {
    from: 0,
    src: oversikt,
    alt: "Dashboardet for en vurderingssurvey: antall tilbakemeldinger, snittvurderingen, fordelingen av vurderingene og uttrykk som går igjen i fritekstsvarene.",
    crop: { x: 128, y: 0, width: 2944, height: 1687 },
  },
  {
    from: 2,
    src: tilbakemeldinger,
    alt: "Tilbakemeldinger: en tabell med dato, tilbakemelding og app. Hvert svar har en knapp for å kopiere og en for å slette.",
    crop: { x: 130, y: 0, width: 2850, height: 1633 },
    marks: [{ x: 2889, y: 888, width: 26, height: 28 }],
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
      <div className="shot-side">
        <Tag kind="screenshot" />
        <Callout
          shown={step >= 2}
          name="Slett tilbakemelding"
          className="bare-teamet__callout"
        />
      </div>
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
