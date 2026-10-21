import type { CSSProperties } from "react";
import type { Slide } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import "./avslutning.css";

/*
 * Two lines side by side through the answer's life, as two routes in one
 * corridor: the team's above, Team eSyfo's below. A station on a line is
 * a duty; the phases run between the lines.
 */
const TEAM_Y = 470;
const ESYFO_Y = 700;
const PHASE_Y = (TEAM_Y + ESYFO_Y) / 2;
const LINE_START = 430;
const LINE_END = 1820;
const PHASES = [
  { x: 560, name: "lage" },
  { x: 850, name: "bygge inn" },
  { x: 1140, name: "svare" },
  { x: 1430, name: "lagre" },
  { x: 1720, name: "lese" },
] as const;

/** One duty per phase and line, or none. */
const TEAM: readonly (string | null)[] = [
  "Hva dere spør om, ikke navn eller fødselsnummer",
  "Koden i appen og backenden som veksler token",
  "Informere brukerne",
  "Egen kopi av E726, og vurdere PVK",
  "Lese og slette svar med personopplysninger",
];

const ESYFO: readonly (string | null)[] = [
  "Drifter Surveyverksted",
  "Gir appen tilgang til Lumi API",
  null,
  "Maskerer og sletter etter 12 måneder",
  "Drifter dashboardet",
];

function at(x: number, y: number, below: boolean): CSSProperties {
  return below ? { left: x, top: y } : { left: x, bottom: 1080 - y };
}

function Ansvar() {
  return (
    <div className="slide">
      <h2 className="slide-title">Dette gjør dere, dette gjør vi</h2>
      <p className="ansvar__nav">Nav er behandlingsansvarlig.</p>
      <LineMap label="To linjer gjennom svarets liv: lage, bygge inn, svare, lagre og lese. Teamet deres: hva dere spør om, ikke navn eller fødselsnummer. Koden i appen og backenden som veksler token. Informere brukerne. Egen kopi av E726, og vurdere PVK. Lese og slette svar med personopplysninger. Team eSyfo: drifter Surveyverksted, gir appen tilgang til Lumi API, maskerer og sletter svar etter 12 måneder, og drifter dashboardet. Ingen SLA.">
        <MapText x={112} y={TEAM_Y} size={44} weight={800}>
          Teamet deres
        </MapText>
        <MapText x={112} y={ESYFO_Y} size={44} weight={800}>
          Team eSyfo
        </MapText>
        <Line
          points={[
            [LINE_START, TEAM_Y],
            [LINE_END, TEAM_Y],
          ]}
        />
        <Line
          points={[
            [LINE_START, ESYFO_Y],
            [LINE_END, ESYFO_Y],
          ]}
        />
        {PHASES.map((phase) => (
          <MapText
            key={phase.name}
            x={phase.x}
            y={PHASE_Y}
            anchor="middle"
            size={32}
            weight={600}
            muted
          >
            {phase.name}
          </MapText>
        ))}
        {PHASES.map((phase, i) =>
          TEAM[i] ? (
            <Station
              key={`team-${phase.name}`}
              x={phase.x}
              y={TEAM_Y}
              from={1}
            />
          ) : null,
        )}
        {PHASES.map((phase, i) =>
          ESYFO[i] ? (
            <Station
              key={`esyfo-${phase.name}`}
              x={phase.x}
              y={ESYFO_Y}
              from={2}
            />
          ) : null,
        )}
      </LineMap>

      {PHASES.map((phase, i) =>
        TEAM[i] ? (
          <p
            key={`team-${phase.name}`}
            className="end-at ansvar__duty"
            data-from={1}
            style={at(phase.x, TEAM_Y - 44, false)}
          >
            {TEAM[i]}
          </p>
        ) : null,
      )}
      {PHASES.map((phase, i) =>
        ESYFO[i] ? (
          <p
            key={`esyfo-${phase.name}`}
            className="end-at ansvar__duty"
            data-from={2}
            style={at(phase.x, ESYFO_Y + 44, true)}
          >
            {ESYFO[i]}
          </p>
        ) : null,
      )}

      <div className="end-at ansvar__bottom" data-from={2}>
        <p>
          Ingen SLA. Er Lumi nede, får brukeren en feilmelding, og appen virker
          som før.
        </p>
        <p className="ansvar__ask">Spør i #lumi på Slack.</p>
      </div>
    </div>
  );
}

export const ansvar: Slide = {
  id: "ansvar",
  title: "Dette gjør dere, dette gjør vi",
  steps: 2,
  notes: `Ordrett inn: «Hvis teamet deres vil prøve, er arbeidet delt slik: noe gjør dere, og noe gjør vi.»

Nav er behandlingsansvarlig, og teamet har ansvaret for surveyen og svarene på vegne av Nav.

Klikk 1, teamet deres: hva dere spør om. Ikke be om navn eller fødselsnummer, og ikke rekrutter til brukertester. Koden i appen og en backend som veksler token. Informer brukerne. I fagsystemer er brukerne kolleger: si fra før dere spør. Egen kopi av etterlevelsesmalen E726, og vurder om dere trenger en personvernkonsekvensvurdering (PVK). Les og slett svar med personopplysninger.

Klikk 2, Team eSyfo: drifter Surveyverksted, Lumi API og dashboardet, og gir appen tilgang til Lumi API. Vi går ikke gjennom E726 eller PVK-en deres. Lumi API maskerer kjente mønstre og sletter svar automatisk etter 12 måneder. Slettingen gjelder Lumis database. Filer dere har lastet ned, sletter dere selv.

SLA er en avtale om oppetid. Den finnes ikke. Er Lumi nede, får brukeren en feilmelding, og appen virker som før.

Vil dere slutte med Lumi: surveyen ligger i koden deres, og svarene kan lastes ned.

Si ulempene selv: endringer krever ny versjon av appen, og appen trenger en backend som veksler token.`,
  Component: Ansvar,
};
