import type { Slide, SlideProps } from "../../engine";
import { useBuildMotion } from "./bevisMotion";
import "./avslutning.css";

/*
 * What Lumi stores, read as one label beside the answer and the person who
 * gave it. When the slide comes on, the person fades and leaves a dashed
 * outline, and the answer stays: it looks back at where the person was.
 * The label: what is stored and what is removed, in Lumi's blue, what is
 * removed framed like the masks in the stored text, and what is not
 * removed in orange, for what to know. Every value is from «Sikkerhet og
 * personvern» in the docs.
 */
const FACTS = [
  { label: "Hvor", value: "Nais" },
  { label: "Hvem ser i dashboardet", value: "Bare teamet" },
  { label: "Hvor lenge", value: "12 måneder" },
] as const;

/** Head and shoulders, the outline both the person and the gap use. */
const HEAD = { cx: 130, cy: 92, r: 62 } as const;
const SHOULDERS = "M18 318 C18 228 66 178 130 178 C194 178 242 228 242 318 Z";
/** The answer, in front of the person's shoulder, as in the snow globe. */
const ANSWER = { cx: 262, cy: 252, r: 58 } as const;

function Personvern({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div className="slide personvern" data-motion={motion ? "" : undefined}>
      <h2 className="slide-title personvern__title">
        Lumi lagrer ikke hvem som svarte
      </h2>
      <svg
        className="personvern__hvem"
        viewBox="0 0 330 330"
        role="img"
        aria-label="Et gyllent svar med øyne står igjen. Personen som ga det, er bare et stiplet omriss: den som svarte, er ikke med."
      >
        <g className="personvern__person">
          <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
          <path d={SHOULDERS} />
        </g>
        <g className="personvern__tom">
          <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
          <path d={SHOULDERS} />
        </g>
        <circle
          cx={ANSWER.cx}
          cy={ANSWER.cy}
          r={ANSWER.r}
          className="personvern__svar"
        />
        <g className="personvern__oyne">
          <ellipse cx={ANSWER.cx - 26} cy={ANSWER.cy - 10} rx="8" ry="11.5" />
          <ellipse cx={ANSWER.cx - 2} cy={ANSWER.cy - 10} rx="8" ry="11.5" />
        </g>
      </svg>
      <div className="end-at end-board personvern__label">
        <dl className="personvern__rows">
          <div className="personvern__row personvern__row--lumi">
            <dt>Lagres</dt>
            <dd>
              Svaret, teamet, appen, tidspunktet, det appen sender med,
              enhetstype, skjermstørrelse og nettleser
            </dd>
          </div>
          <div className="personvern__row personvern__row--lumi">
            <dt>Fjernes før lagring</dt>
            <dd>
              <span className="personvern__removed">
                Fødselsnummer, Nav-ident, e-post,
                <br />
                telefon-, konto- og kortnummer
              </span>
            </dd>
          </div>
          <div className="personvern__row personvern__row--varsel">
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
      </div>
      <p className="end-at personvern__obs">
        I små grupper kan konteksten røpe hvem som svarte.
      </p>
    </div>
  );
}

export const personvern: Slide = {
  id: "personvern",
  title: "Lumi lagrer ikke hvem som svarte",
  Component: Personvern,
};
