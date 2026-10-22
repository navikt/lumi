import type { Slide } from "../../engine";
import "./avslutning.css";

/*
 * Three sentences on a board: what the team does, what Lumi does, and
 * what happens when Lumi is down. The rest is in the notes. Sources:
 * «Hva er Lumi?» and «Bruksvilkår» in the docs.
 */
const ROWS = [
  {
    name: "Dere",
    text: "Teamet deres har ansvaret for surveyen og svarene.",
    note: "Før start: lag en kopi av etterlevelsesmalen E726, og vurder om dere trenger en personvernkonsekvensvurdering.",
  },
  {
    name: "Lumi",
    text: "Lumi sletter svarene automatisk etter 12 måneder.",
  },
  {
    name: "Nedetid",
    text: "Er Lumi nede, får brukeren en feilmelding, og appen virker som før.",
    note: "Lumi har ingen avtale om oppetid.",
  },
] as const;

function Ansvar() {
  return (
    <div className="slide">
      <h2 className="slide-title">Hvem gjør hva?</h2>
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
  title: "Hvem gjør hva?",
  steps: 2,
  notes: `Tre setninger, én per rad. Ordrett inn: «Hvis teamet deres vil prøve, er arbeidet delt slik.»

Fra start: «Nav er behandlingsansvarlig, og teamet deres har ansvaret for surveyen og svarene.» Før dere starter, lager dere en kopi av etterlevelsesmalen E726 og vurderer om dere trenger en personvernkonsekvensvurdering, en PVK.

Klikk 1: «Lumi sletter svarene automatisk etter tolv måneder.»

Klikk 2: «Lumi har ingen avtale om oppetid. Er Lumi nede, får brukeren en feilmelding, og appen virker som før.»

Hvis noen spør:
Dere har også ansvaret for koden i appen, backenden som veksler token, å fortelle brukerne at dere samler inn tilbakemeldinger, og å slette svar med personopplysninger. I fagsystemer er brukerne kolleger: si fra før dere spør. Ikke be om navn eller fødselsnummer, ikke rekrutter til brukertester, og ikke rett surveyer mot brukere med skjermingskode.
Vi gir appen tilgang til Lumi API, men går ikke gjennom E726 eller PVK-en deres. Slettingen gjelder Lumis database. Filer dere har lastet ned, sletter dere selv.
Vil dere slutte med Lumi, ligger surveyen i koden deres, og svarene kan lastes ned.

Si ulempene selv: endringer krever en ny versjon av appen, og appen trenger en backend som veksler token.`,
  Component: Ansvar,
};
