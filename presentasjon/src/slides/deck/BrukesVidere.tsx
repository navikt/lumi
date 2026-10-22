import type { Slide } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import "./bevis.css";

/*
 * A monument: what every team can take out today, the export formats from
 * the dashboard. Under it two short lines, as in the key of a line map:
 * solid for what is built, dashed for what is on the way. All of it ends
 * left of x 1520, clear of the Teams corner.
 */
const KEY_FROM = 112;
const RING_R = 22;
/* Three whole dashes (30, gap 24) end at the ring's left edge. */
const KEY_TO = KEY_FROM + 138 + RING_R;
/* The solid line's round cap reaches the margin, like the dashes. */
const CAP = 7;
const LABEL_X = KEY_TO + RING_R + 30;
const STORY_Y = 776;
const BIGQUERY_Y = 868;

function BrukesVidere() {
  return (
    <div className="slide eksport">
      <h2 className="eksport__title">Svarene kan tas ut til analyse</h2>
      <p className="eksport__formats">
        CSV, Excel
        <br />
        og JSON
      </p>
      <p className="eksport__where">Eksport fra dashboardet</p>
      <LineMap label="Under eksporten to linjer. Heltrukket: iSyfos datafortelling, som finnes. Stiplet: BigQuery i teamets eget prosjekt, som er på vei, en pilot i eSyfo og iSyfo uten fritekst.">
        <Line
          points={[
            [KEY_FROM + CAP, STORY_Y],
            [KEY_TO, STORY_Y],
          ]}
        />
        <Station x={KEY_TO} y={STORY_Y} r={RING_R} />
        <MapText x={LABEL_X} y={STORY_Y + 2} size={36} weight={700}>
          iSyfos datafortelling
        </MapText>

        <g data-from={1}>
          <Line
            points={[
              [KEY_FROM, BIGQUERY_Y],
              [KEY_TO, BIGQUERY_Y],
            ]}
            dashed
          />
          <Station x={KEY_TO} y={BIGQUERY_Y} r={RING_R} />
          <MapText x={LABEL_X} y={BIGQUERY_Y + 2} size={36} weight={700}>
            På vei: BigQuery i teamets eget prosjekt
          </MapText>
          <MapText x={LABEL_X} y={BIGQUERY_Y + 48} size={32} weight={600} muted>
            pilot i eSyfo og iSyfo, uten fritekst
          </MapText>
        </g>
      </LineMap>
    </div>
  );
}

export const brukesVidere: Slide = {
  id: "brukes-videre",
  title: "Svarene kan tas ut til analyse",
  steps: 1,
  // In faggruppa the export is one sentence on «Dere ser bare svarene …».
  rooms: ["frontend", "produktledere"],
  notes: `Eksport finnes: CSV, Excel og JSON fra dashboardet, til samme formål som surveyen.

iSyfo bruker svarene sine i en datafortelling.

Klikk 1, stiplet: eksport til BigQuery i teamets eget prosjekt er på vei. Det er en pilot i eSyfo og iSyfo, og fritekst er stengt.

Sletting i Lumi gjelder ikke filer dere har lastet ned. Dem sletter dere selv.

Før kjøring: sjekk status på BigQuery-eksporten.`,
  Component: BrukesVidere,
};
