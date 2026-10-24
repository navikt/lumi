import type { Slide } from "../../engine";
import "./avslutning.css";

/*
 * What Lumi stores, read as one label: what is stored, what is removed
 * (framed, like the masks in the stored text), what is not removed, and
 * three values. Every value is from «Sikkerhet og personvern» in the docs.
 */
const FACTS = [
  { label: "Hvor", value: "Nais" },
  { label: "Hvem ser i dashboardet", value: "Bare teamet" },
  { label: "Hvor lenge", value: "12 måneder" },
] as const;

function Personvern() {
  return (
    <div className="slide">
      <h2 className="slide-title personvern__title">
        Lumi lagrer ikke hvem som svarte
      </h2>
      <div className="end-at end-board personvern__label">
        <dl className="personvern__rows">
          <div className="personvern__row">
            <dt>Lagres</dt>
            <dd>
              Svaret, teamet, appen, tidspunktet, det appen sender med,
              enhetstype, skjermstørrelse og nettleser
            </dd>
          </div>
          <div className="personvern__row">
            <dt>Fjernes før lagring</dt>
            <dd>
              <span className="personvern__removed">
                Fødselsnummer, Nav-ident, e-post, telefon-, konto- og kortnummer
              </span>
            </dd>
          </div>
          <div className="personvern__row">
            <dt>Fjernes ikke</dt>
            <dd>Navn og vanlige adresser</dd>
          </div>
        </dl>
        <dl className="personvern__facts">
          {FACTS.map((fact) => (
            <div key={fact.label} className="personvern__fact">
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <p className="personvern__obs">
          I små grupper kan konteksten røpe hvem som svarte.
        </p>
      </div>
    </div>
  );
}

export const personvern: Slide = {
  id: "personvern",
  title: "Lumi lagrer ikke hvem som svarte",
  notes: `Reserve: vis den når noen spør om personvern, og lim teksten inn i chatten. Står den rett etter bare-teamet, inn: «Her ser dere hva Lumi lagrer, og hva som fjernes.»

Lumi API lagrer ikke hvem som svarte, heller ikke Nav-identen fra interne apper. Tokenet fra appens backend brukes til å sjekke at kallet kommer fra en app med tilgang. En hash av brukerens ID holdes bare i minnet, for å begrense hvor mange svar én bruker kan sende inn.

Rammen er det samme merket som rundt e-postadressen i stad: det som står i rammen, fjernes før svaret lagres. Fødselsnummer fjernes når kontrollsifrene er gyldige. Navn og vanlige adresser fjernes ikke, derfor har teamet en sletteknapp i dashboardet.

I dashboardet ser bare teamet svarene, altså medlemmene av teamet i Nais Console. Svarene slettes automatisk etter tolv måneder. Et slettet svar kan ligge i sikkerhetskopiene i opptil sju døgn.

Kilde: «Sikkerhet og personvern» i dokumentasjonen.`,
  Component: Personvern,
};
