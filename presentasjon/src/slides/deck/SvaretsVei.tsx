import type { Slide } from "../../engine";
import { Answer, Line, LineMap, MapText, Station } from "../../map";
import "./deck.css";

const Y = 600;
const XS = [240, 532, 824, 1116, 1408, 1700] as const;
/** The answer disc at «Brukeren svarer». */
const DISC_R = 44;
/*
 * Every label above the line hangs at the same height, clear of the answer
 * disc, as Station places labels round a ring of that size.
 */
const ABOVE_Y = Y - DISC_R - 28 - 18;
const NOTE_GAP = 42;

/** A label and its note above the line. */
function Above({
  x,
  label,
  note,
  from,
}: {
  x: number;
  label: string;
  note: string;
  from: number;
}) {
  return (
    <g data-from={from}>
      <MapText
        x={x}
        y={ABOVE_Y - NOTE_GAP}
        anchor="middle"
        size={30}
        weight={500}
        muted
      >
        {note}
      </MapText>
      <MapText x={x} y={ABOVE_Y} anchor="middle" weight={700}>
        {label}
      </MapText>
    </g>
  );
}

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
        <Station x={XS[0]} y={Y} from={1} />
        <Above x={XS[0]} label="Teamet lager" note="Surveyverksted" from={1} />
        <Station
          x={XS[1]}
          y={Y}
          side="below"
          label="Utvikleren legger inn"
          note="koden i appen"
          from={1}
        />
        <g data-from={1}>
          <Answer x={XS[2]} y={Y} r={DISC_R} />
        </g>
        <Above x={XS[2]} label="Brukeren svarer" note="widgeten" from={1} />
        <Station
          x={XS[3]}
          y={Y}
          side="below"
          label="Appens backend"
          note="veksler token"
          from={2}
        />
        <Station x={XS[4]} y={Y} from={2} />
        <Above x={XS[4]} label="Lumi API" note="lagrer på Nais" from={2} />
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
