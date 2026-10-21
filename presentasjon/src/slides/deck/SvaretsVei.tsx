import type { Slide } from "../../engine";
import { Answer, Line, LineMap, MapText, Station } from "../../map";
import "./deck.css";

const Y = 600;
/*
 * Spread so the widest text at each end, «Surveyverksted» (262 px) and
 * «Teamet leser» (252 px), ends at the page margin.
 */
const XS = [244, 531, 818, 1105, 1392, 1679] as const;
/** The answer disc at «Brukeren svarer». */
const DISC_R = 44;
const RING_R = 22;
const LABEL_GAP = 28;
/* The slide has room, so its labels and notes are larger than on other maps. */
const LABEL_SIZE = 42;
const NOTE_SIZE = 36;
/** From the middle of a label to the middle of its note. */
const NOTE_GAP = 48;
/*
 * Every label above the line hangs at the same height, clear of the answer
 * disc. Labels below the line hang from the rings the same way.
 */
const ABOVE_Y = Y - DISC_R - LABEL_GAP - LABEL_SIZE / 2;
const BELOW_Y = Y + RING_R + LABEL_GAP + LABEL_SIZE / 2;

/** A station's label and note, above the line or below it. */
function StationText({
  x,
  label,
  note,
  above = false,
  from,
}: {
  x: number;
  label: string;
  note: string;
  above?: boolean;
  from: number;
}) {
  const labelY = above ? ABOVE_Y : BELOW_Y;
  const noteY = above ? labelY - NOTE_GAP : labelY + NOTE_GAP;
  return (
    <g data-from={from}>
      <MapText
        x={x}
        y={noteY}
        anchor="middle"
        size={NOTE_SIZE}
        weight={600}
        muted
      >
        {note}
      </MapText>
      <MapText x={x} y={labelY} anchor="middle" size={LABEL_SIZE} weight={700}>
        {label}
      </MapText>
    </g>
  );
}

function SvaretsVei() {
  return (
    <div className="slide">
      <h2 className="slide-title">Svarets vei</h2>
      <LineMap label="Linjekart med seks stasjoner, fra venstre mot høyre. Teamet lager: Surveyverksted. Utvikleren legger inn: koden i appen. Brukeren svarer: widgeten. Appens backend: veksler token. Lumi API: lagrer på Nais. Teamet leser: dashboardet.">
        <Line
          points={[
            [XS[0], Y],
            [XS[5], Y],
          ]}
        />
        <Station x={XS[0]} y={Y} from={1} />
        <StationText
          x={XS[0]}
          label="Teamet lager"
          note="Surveyverksted"
          above
          from={1}
        />
        <Station x={XS[1]} y={Y} from={1} />
        <StationText
          x={XS[1]}
          label="Utvikleren legger inn"
          note="koden i appen"
          from={1}
        />
        <g data-from={1}>
          <Answer x={XS[2]} y={Y} r={DISC_R} />
        </g>
        <StationText
          x={XS[2]}
          label="Brukeren svarer"
          note="widgeten"
          above
          from={1}
        />
        <Station x={XS[3]} y={Y} from={2} />
        <StationText
          x={XS[3]}
          label="Appens backend"
          note="veksler token"
          from={2}
        />
        <Station x={XS[4]} y={Y} from={2} />
        <StationText
          x={XS[4]}
          label="Lumi API"
          note="lagrer på Nais"
          above
          from={2}
        />
        <Station x={XS[5]} y={Y} from={2} />
        <StationText
          x={XS[5]}
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

Fire stasjoner er teamets, én er brukerens, én er vår. I et fagsystem er det saksbehandleren som svarer.

Ut: «Første stasjon er teamet. Tenk på én oppgave i tjenesten deres som dere vet lite om.»`,
  Component: SvaretsVei,
};
