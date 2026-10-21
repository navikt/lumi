import type { Slide } from "../../engine";
import { Answer, Line, LineMap, Station } from "../../map";
import "./deck.css";

const Y = 600;
const XS = [180, 500, 820, 1140, 1460, 1780] as const;

function SvaretsVei() {
  return (
    <div className="slide">
      <h2 className="slide-title">Svarets vei</h2>
      <LineMap label="Linjekart med seks stasjoner: teamet lager surveyen, utvikleren legger den inn i appen, brukeren svarer, appens backend, Lumi API og teamet som leser svarene.">
        <Line
          points={[
            [XS[0], Y],
            [XS[5], Y],
          ]}
        />
        <Station
          x={XS[0]}
          y={Y}
          side="above"
          label="Teamet lager"
          note="Surveyverksted"
          from={1}
        />
        <Station
          x={XS[1]}
          y={Y}
          side="below"
          label="Utvikleren legger inn"
          note="koden i appen"
          from={1}
        />
        <g data-from={1}>
          <Answer x={XS[2]} y={Y} r={44} />
        </g>
        <Station
          x={XS[2]}
          y={Y}
          r={44}
          side="above"
          label="Brukeren svarer"
          note="widgeten"
          from={1}
          className="map-station--label-only"
        />
        <Station
          x={XS[3]}
          y={Y}
          side="below"
          label="Appens backend"
          note="veksler token"
          from={2}
        />
        <Station
          x={XS[4]}
          y={Y}
          side="above"
          label="Lumi API"
          note="lagrer på Nais"
          from={2}
        />
        <Station
          x={XS[5]}
          y={Y}
          side="below"
          label="Teamet leser"
          note="dashboardet"
          from={2}
        />
      </LineMap>
    </div>
  );
}

export const svaretsVei: Slide = {
  id: "svarets-vei",
  title: "Svarets vei",
  steps: 2,
  notes: `Ordrett inn: «Nå følger vi ett svar hele veien, fra teamet lager surveyen til teamet leser svaret.»

Fire stasjoner er teamets, én er brukerens, én er vår.`,
  Component: SvaretsVei,
};
