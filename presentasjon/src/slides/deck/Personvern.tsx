import type { Slide } from "../../engine";
import "./avslutning.css";

/*
 * What Lumi stores, as one fixed label, like the privacy labels in an app
 * store. Every value is from «Sikkerhet og personvern» in the docs.
 */
const ROWS = [
  {
    label: "Lagres",
    value:
      "Svaret, teamet, appen, tidspunktet, enhetstype, skjermstørrelse og nettleser",
  },
  { label: "Lagres ikke", value: "Hvem som svarte, heller ikke Nav-identen" },
  {
    label: "Fjernes før lagring",
    value: "Fødselsnummer, Nav-ident, e-post, telefon-, konto- og kortnummer",
  },
  { label: "Fjernes ikke", value: "Navn og vanlige adresser" },
  { label: "Hvor", value: "Databasen på Nais" },
  { label: "Hvem ser", value: "I dashboardet bare teamet" },
  { label: "Hvor lenge", value: "12 måneder" },
] as const;

function Personvern() {
  return (
    <div className="slide">
      <h2 className="slide-title">Lumi lagrer svaret, ikke hvem som svarte</h2>
      <dl className="personvern__label">
        {ROWS.map((row) => (
          <div key={row.label} className="personvern__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="personvern__obs">
        I små grupper kan konteksten røpe hvem som svarte.
      </p>
    </div>
  );
}

export const personvern: Slide = {
  id: "personvern",
  title: "Lumi lagrer svaret, ikke hvem som svarte",
  notes: `Reserve. Vis den hvis noen spør om personvern, og lim teksten inn i chatten.

Kilde: «Sikkerhet og personvern» i dokumentasjonen. Fødselsnummer fjernes når kontrollsifrene er gyldige. Et slettet svar kan ligge i sikkerhetskopiene i opptil sju døgn.`,
  Component: Personvern,
};
