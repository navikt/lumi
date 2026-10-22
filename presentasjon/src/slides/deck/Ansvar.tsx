import type { Slide } from "../../engine";
import "./avslutning.css";

/*
 * Three sentences on a board: what the team does, what Team eSyfo does,
 * and what happens when Lumi is down. The rest is in the notes. Sources:
 * «Hva er Lumi?» and «Bruksvilkår» in the docs.
 */
const ROWS = [
  {
    name: "Dere",
    text: "Teamet deres har ansvaret for surveyen og svarene.",
    note: "Før start: lag en egen kopi av E726, og vurder om dere trenger PVK.",
  },
  {
    name: "Vi",
    text: "Team eSyfo drifter Lumi, og svarene slettes automatisk etter 12 måneder.",
  },
  {
    name: "Ingen SLA",
    text: "Er Lumi nede, får brukeren en feilmelding, og appen virker som før.",
  },
] as const;

function Ansvar() {
  return (
    <div className="slide">
      <h2 className="slide-title">Dette gjør dere, dette gjør vi</h2>
      <p className="ansvar__nav">Nav er behandlingsansvarlig.</p>
      <dl className="end-at end-board ansvar">
        {ROWS.map((row, i) => (
          <div
            key={row.name}
            className="ansvar__row"
            {...(i === 0 ? {} : { "data-from": i })}
          >
            <dt className="ansvar__name">{row.name}</dt>
            <dd className="ansvar__text">
              {row.text}
              {"note" in row && (
                <span className="ansvar__note">{row.note}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export const ansvar: Slide = {
  id: "ansvar",
  title: "Dette gjør dere, dette gjør vi",
  steps: 2,
  notes: `Tre setninger, én per rad. Ordrett inn: «Hvis teamet deres vil prøve, er arbeidet delt slik.»

Fra start: «Nav er behandlingsansvarlig, og på vegne av Nav har teamet deres ansvaret for surveyen og svarene.» Før dere starter, lager dere en egen kopi av E726 og vurderer om dere trenger en PVK. E726 er Navs mal for etterlevelse, og PVK er en personvernkonsekvensvurdering.

Klikk 1: «Team eSyfo drifter Lumi, og svarene slettes automatisk etter 12 måneder.»

Klikk 2: «Lumi har ingen SLA, altså ingen avtale om oppetid. Er Lumi nede, får brukeren en feilmelding, og appen virker som før.»

Hvis noen spør:
Dere har også ansvaret for koden i appen, backenden som veksler token, å informere brukerne og å slette svar med personopplysninger. I fagsystemer er brukerne kolleger: si fra før dere spør. Ikke be om navn eller fødselsnummer, og ikke rekrutter til brukertester.
Team eSyfo drifter Surveyverksted, Lumi API og dashboardet, og gir appen tilgang til Lumi API. Vi går ikke gjennom E726 eller PVK-en deres. Slettingen gjelder Lumis database. Filer dere har lastet ned, sletter dere selv.
Vil dere slutte med Lumi: surveyen ligger i koden deres, og svarene kan lastes ned.

Si ulempene selv: endringer krever ny versjon av appen, og appen trenger en backend som veksler token.`,
  Component: Ansvar,
};
