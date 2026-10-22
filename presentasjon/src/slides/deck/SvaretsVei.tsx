import type { Slide, SlideProps } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import { Answer, Line, LineMap, MapText, Station } from "../../map";
import "./deck.css";

const Y = 600;
/*
 * Spread so the widest text at each end, «Surveyverksted» (262 px) and
 * «Teamet leser» (252 px), ends at the page margin.
 */
const XS = [244, 531, 818, 1105, 1392, 1679] as const;
/** From one station to the next: the answer rides three of them. */
const STEP = XS[1] - XS[0];
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

/** When the answer reaches the stations ahead, in ms into the ride. */
const ARRIVALS = [450, 1150, 1850] as const;

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
  from?: number;
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

/**
 * The answer's way as one line from edge to edge. Behind the answer and where
 * it stands, the line is lit. Ahead, where it has not been, it is dim. On the
 * last step the answer rides on to the team and lights the line behind it.
 */
function SvaretsVei({ step }: SlideProps) {
  const rides = step >= 2;
  return (
    <div className="slide">
      <h2 className="kart-vei__title">Svarets vei</h2>
      <LineMap label="Linjekart med seks stasjoner, fra venstre mot høyre. Svaret starter hos brukeren og reiser til teamet som leser det. Teamet lager: Surveyverksted. Utvikleren legger inn: koden i appen. Brukeren svarer: widgeten. Appens backend: sender svaret videre. Lumi API: lagrer på Nais. Teamet leser: dashboardet.">
        <Line
          points={[
            [-20, Y],
            [XS[2], Y],
          ]}
        />
        <Line
          points={[
            [XS[2], Y],
            [1940, Y],
          ]}
          dim
        />
        <Line
          points={[
            [XS[2], Y],
            [XS[5], Y],
          ]}
          draw
          from={2}
          className="kart-vei__lit"
        />

        <Station x={XS[0]} y={Y} />
        <StationText
          x={XS[0]}
          label="Teamet lager"
          note="Surveyverksted"
          above
        />
        <Station x={XS[1]} y={Y} />
        <StationText
          x={XS[1]}
          label="Utvikleren legger inn"
          note="koden i appen"
        />
        <Station x={XS[2]} y={Y} />
        <StationText x={XS[2]} label="Brukeren svarer" note="widgeten" above />

        {/* Ahead of the answer: dim rings, lit as the answer reaches them. */}
        {([3, 4, 5] as const).map((index, i) => (
          <g key={index}>
            <Station x={XS[index]} y={Y} dim from={1} />
            <g
              className="kart-vei__ring"
              data-from={2}
              style={cssVars({ "--kart-ankomst": `${ARRIVALS[i]}ms` })}
            >
              <Station x={XS[index]} y={Y} />
            </g>
          </g>
        ))}
        <StationText
          x={XS[3]}
          label="Appens backend"
          note="sender svaret videre"
          from={1}
        />
        <StationText
          x={XS[4]}
          label="Lumi API"
          note="lagrer på Nais"
          above
          from={1}
        />
        <StationText
          x={XS[5]}
          label="Teamet leser"
          note="dashboardet"
          from={1}
        />

        <Answer
          x={XS[2]}
          y={Y}
          r={DISC_R}
          className={cx("kart-vei__answer", rides && "kart-vei__answer--rides")}
          style={cssVars({ "--kart-steg": `${STEP}px` })}
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

Fra start: teamet lager surveyen i Surveyverksted, utvikleren legger koden inn i appen, og brukeren svarer i widgeten. I et fagsystem er det saksbehandleren som svarer.

Klikk 1: resten av veien. Appens backend sender svaret videre med brukerens innlogging, Lumi API lagrer svaret på Nais, og teamet leser det i dashboardet. Fire stasjoner er teamets, én er brukerens, én er vår.

Klikk 2: svaret reiser videre og stopper på hver stasjon. Vent til det står hos teamet.

Ut: «Første stasjon er teamet. Tenk på én oppgave i tjenesten deres som dere vet lite om.»`,
  Component: SvaretsVei,
};
