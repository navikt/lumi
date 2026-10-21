import type { Slide } from "../../engine";
import { Line, LineMap, Station } from "../../map";
import "./avslutning.css";

const Y = 600;
const XS = [360, 960, 1560] as const;

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
        <Station
          x={XS[0]}
          y={Y}
          side="below"
          label="Team SåPe, februar 2026"
          note="Fem funn, alle utbedret"
        />
        <Station
          x={XS[1]}
          y={Y}
          side="below"
          label="Rundt 2 600 automatiske tester"
          note="axe i widget og e2e"
          from={1}
        />
        <Station
          x={XS[2]}
          y={Y}
          side="below"
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

Klikk 2: Pakken publiseres på npm med provenance, så dere kan se at den er bygd fra koden i navikt/lumi.`,
  Component: SlikVetVi,
};
