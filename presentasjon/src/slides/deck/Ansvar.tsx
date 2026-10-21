import type { CSSProperties } from "react";
import type { Slide } from "../../engine";
import { Line, LineMap, Station } from "../../map";
import "./avslutning.css";

/** The seam, where the team's part meets Team eSyfo's. */
const SEAM_Y = 600;
const COLUMNS = [460, 920, 1380] as const;
const RING = 22;
const GAP = 28;

// Stage pixels from the bottom edge, so labels above the seam can sit on it.
const STAGE_HEIGHT = 1080;
const ABOVE_SEAM = STAGE_HEIGHT - (SEAM_Y - RING - GAP);
const FAR_ROW = ABOVE_SEAM + 128;
const BELOW_SEAM = SEAM_Y + RING + GAP;

function above(column: number, bottom: number): CSSProperties {
  return { left: COLUMNS[column], bottom };
}

function below(column: number): CSSProperties {
  return { left: COLUMNS[column], top: BELOW_SEAM };
}

function Ansvar() {
  return (
    <div className="slide">
      <h2 className="slide-title">Dette gjør dere, dette gjør vi</h2>
      <LineMap label="En linje deler sliden i to. Over linja står det teamet deres gjør: hva dere spør om, koden i appen, fylle ut egen E726 og vurdere om dere trenger PVK, informere brukerne, og lese og slette svar med personopplysninger. Under linja står det Team eSyfo gjør: drifter Surveyverksted, Lumi API og dashboardet, godkjenner appene som sender svar og sletter svar etter 12 måneder.">
        <Line
          points={[
            [-20, SEAM_Y],
            [1940, SEAM_Y],
          ]}
        />
        {COLUMNS.map((x) => (
          <Station key={x} x={x + RING} y={SEAM_Y} />
        ))}
      </LineMap>

      <p
        className="end-at ansvar__side"
        style={{ left: 112, bottom: ABOVE_SEAM }}
      >
        Teamet deres
      </p>
      <p className="end-at ansvar__side" style={{ left: 112, top: BELOW_SEAM }}>
        Team eSyfo
      </p>

      {/* The team's part. The row on the seam pairs with Team eSyfo's. */}
      <p
        className="end-at end-label ansvar__part"
        data-from={1}
        style={above(0, FAR_ROW)}
      >
        Fylle ut egen E726
        <br />
        og vurdere om dere
        <br />
        trenger PVK
      </p>
      <p
        className="end-at end-label ansvar__part"
        data-from={1}
        style={above(1, FAR_ROW)}
      >
        Informere brukerne
      </p>
      <p
        className="end-at end-label ansvar__part"
        data-from={1}
        style={above(0, ABOVE_SEAM)}
      >
        Hva dere spør om
      </p>
      <p
        className="end-at end-label ansvar__part"
        data-from={1}
        style={above(1, ABOVE_SEAM)}
      >
        Koden i appen
      </p>
      <p
        className="end-at end-label ansvar__part"
        data-from={1}
        style={above(2, ABOVE_SEAM)}
      >
        Lese og slette svar
        <br />
        med personopplysninger
      </p>

      {/* Team eSyfo's part. */}
      <p
        className="end-at end-label ansvar__part"
        data-from={2}
        style={below(0)}
      >
        Drifter Surveyverksted,
        <br />
        Lumi API og dashboardet
      </p>
      <p
        className="end-at end-label ansvar__part"
        data-from={2}
        style={below(1)}
      >
        Godkjenner appene
        <br />
        som sender svar
      </p>
      <p
        className="end-at end-label ansvar__part"
        data-from={2}
        style={below(2)}
      >
        Sletter svar etter
        <br />
        12 måneder
      </p>
      <p className="end-at slide-lead ansvar__sla" data-from={2}>
        Ingen SLA. Spør i #lumi på Slack.
      </p>
    </div>
  );
}

export const ansvar: Slide = {
  id: "ansvar",
  title: "Dette gjør dere, dette gjør vi",
  steps: 2,
  notes: `Ordrett inn: «Hvis teamet deres vil prøve, er arbeidet delt slik: noe gjør dere, og noe gjør vi.»

Klikk 1, over linja: Nav er behandlingsansvarlig, og teamet har ansvaret for surveyen og svarene på vegne av Nav.

Klikk 2, under linja: Team eSyfo drifter Lumi og godkjenner appene som får sende svar.

Si ulempene selv: endringer krever ny appversjon, appen trenger en backend som veksler token, og det er ingen SLA.

Krav: appen må bruke React og Aksel og ha en backend som veksler token.`,
  Component: Ansvar,
};
