import type { Slide } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import "./avslutning.css";

const Y = 600;
/** The main station's label is 519 px wide, so it needs room from the margin. */
const XS = [380, 960, 1540] as const;
const MAIN_R = 44;
const SMALL_R = 16;
/** As Station places a label under a ring: the ring, a gap, half a line. */
const LABEL_GAP = 28 + 22;

/** A station with its label and note under it, at the given size. */
function Stop({
  x,
  r,
  size,
  label,
  note,
  from,
}: {
  x: number;
  r: number;
  size: number;
  label: string;
  note?: string;
  from?: number;
}) {
  const labelY = Y + r + LABEL_GAP;
  return (
    <g {...(from === undefined ? {} : { "data-from": from })}>
      <Station x={x} y={Y} r={r} />
      <MapText x={x} y={labelY} anchor="middle" size={size} weight={700}>
        {label}
      </MapText>
      {note && (
        <MapText
          x={x}
          y={labelY + size + 6}
          anchor="middle"
          size={30}
          weight={500}
          muted
        >
          {note}
        </MapText>
      )}
    </g>
  );
}

function SlikVetVi() {
  return (
    <div className="slide">
      <h2 className="slide-title">
        Pentesten fant ingen høye eller kritiske funn
      </h2>
      <LineMap label="Tre kontroller på én linje: pentesten fra Team SåPe i februar 2026, med fem funn som alle er utbedret. Rundt 2 600 automatiske tester, med axe i widgeten og i e2e-testene. Provenance på npm.">
        <Line
          points={[
            [XS[0], Y],
            [XS[2], Y],
          ]}
        />
        <Stop
          x={XS[0]}
          r={MAIN_R}
          size={44}
          label="Team SåPe, februar 2026"
          note="Fem funn, alle utbedret. Før Surveyverksted."
        />
        <Stop
          x={XS[1]}
          r={SMALL_R}
          size={30}
          label="Rundt 2 600 automatiske tester"
          note="axe i widget og e2e"
          from={1}
        />
        <Stop
          x={XS[2]}
          r={SMALL_R}
          size={30}
          label="Provenance på npm"
          from={2}
        />
      </LineMap>
    </div>
  );
}

export const slikVetVi: Slide = {
  id: "slik-vet-vi",
  title: "Pentesten fant ingen høye eller kritiske funn",
  rooms: ["frontend"],
  steps: 2,
  notes: `Pentesten var før Surveyverksted. Si det før noen spør.

Fra start: Team SåPe, Navs interne team for sikkerhetstesting, testet Lumi i februar 2026 med gjennomgang av kildekoden. Fem funn, to middels og tre som bare var til informasjon. Alle var utbedret i mars 2026.

Klikk 1: Rundt 2 600 automatiske tester. axe kjører i widgeten og i e2e-testene for dashboardet.

Klikk 2: Pakken publiseres på npm med provenance, så dere kan se at den er bygd fra koden i navikt/lumi.

Ut mot kartet: «Da svarer jeg på spørsmålet fra starten. Kartet viser hvor svaret går. Det rangerer ingen.»`,
  Component: SlikVetVi,
};
