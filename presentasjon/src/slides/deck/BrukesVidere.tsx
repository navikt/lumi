import type { Slide } from "../../engine";
import { Answer, Line, LineMap, MapText, Station } from "../../map";
import "./bevis.css";

/** The answers in Lumi: the station every line leaves from. */
const HUB_X = 560;
const HUB_Y = 540;
const HUB_R = 60;

/** Where the lines bend out of the hub, and where they end. */
const BEND_X = HUB_X + 220;
const END_X = 1140;
const EXPORT_Y = HUB_Y - 220;
const BIGQUERY_Y = HUB_Y + 220;

const LEGEND_Y = 936;

function BrukesVidere() {
  return (
    <div className="slide">
      <h2 className="slide-title">Svarene kan brukes videre</h2>
      <LineMap label="Linjekart med stasjonen «Svarene i Lumi». To heltrukne linjer, som finnes i dag, går til eksport som CSV, Excel og JSON og til iSyfos datafortelling. En stiplet linje, som er på vei, går til BigQuery i teamets eget prosjekt: en pilot i eSyfo og iSyfo, uten fritekst.">
        {/* What exists today */}
        <g data-from={1}>
          <Line
            points={[
              [HUB_X, HUB_Y],
              [BEND_X, EXPORT_Y],
              [END_X, EXPORT_Y],
            ]}
            radius={64}
          />
          <Station
            x={END_X}
            y={EXPORT_Y}
            label="Eksport"
            note="CSV, Excel og JSON"
          />
        </g>
        <g data-from={1}>
          <Line
            points={[
              [HUB_X, HUB_Y],
              [END_X, HUB_Y],
            ]}
          />
          <Station x={END_X} y={HUB_Y} label="iSyfos datafortelling" />
        </g>

        {/* On the way */}
        <g data-from={2}>
          <Line
            points={[
              [HUB_X, HUB_Y],
              [BEND_X, BIGQUERY_Y],
              [END_X, BIGQUERY_Y],
            ]}
            radius={64}
            dashed
          />
          <Station
            x={END_X}
            y={BIGQUERY_Y}
            label="BigQuery i teamets eget prosjekt"
            note="pilot i eSyfo og iSyfo, uten fritekst"
          />
        </g>

        <Answer x={HUB_X} y={HUB_Y} r={HUB_R} />
        <Station
          x={HUB_X}
          y={HUB_Y}
          r={HUB_R}
          side="left"
          label="Svarene i Lumi"
          className="map-station--label-only"
        />

        {/*
          Legend, as on a transit map. The round caps of the solid sample
          reach the margin; the dashed sample holds three whole dashes.
        */}
        <Line
          points={[
            [119, LEGEND_Y],
            [243, LEGEND_Y],
          ]}
        />
        <MapText x={278} y={LEGEND_Y + 2} size={30} weight={600}>
          finnes
        </MapText>
        <Line
          points={[
            [440, LEGEND_Y],
            [578, LEGEND_Y],
          ]}
          dashed
        />
        <MapText x={606} y={LEGEND_Y + 2} size={30} weight={600}>
          på vei
        </MapText>
      </LineMap>
    </div>
  );
}

export const brukesVidere: Slide = {
  id: "brukes-videre",
  title: "Svarene kan brukes videre",
  steps: 2,
  notes: `Eksport finnes: CSV, Excel og JSON fra dashboardet.

iSyfo publiserer en datafortelling med svarene i dag.

Stiplet, på vei: eksport til BigQuery i teamets eget prosjekt. Pilot i eSyfo og iSyfo, og fritekst er stengt.

Før kjøring: sjekk status på BigQuery-eksporten.`,
  Component: BrukesVidere,
};
