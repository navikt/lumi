import type { SurveyDocumentV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import { LiveSurvey } from "../../components/LiveSurvey";
import type { Slide } from "../../engine";
import "./sporsmal.css";

/** One question per widget, so each type is seen on its own. */
function single(question: SurveyQuestionV1): SurveyDocumentV1 {
  return {
    authoringSchemaVersion: 1,
    type: question.type === "rating" ? "rating" : "custom",
    pages: [{ id: question.id, questions: [question] }],
  };
}

interface Kind {
  id: string;
  label: string;
  note?: string;
  survey: SurveyDocumentV1;
}

// Defined once, outside the component: a new object restarts the widget.
const KINDS: readonly Kind[] = [
  {
    id: "emoji",
    label: "Emoji",
    note: "1–5",
    survey: single({
      id: "emoji",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan var det å bruke løsningen?",
    }),
  },
  {
    id: "tommel",
    label: "Tommel",
    note: "opp eller ned",
    survey: single({
      id: "tommel",
      type: "rating",
      variant: "thumbs",
      prompt: "Fant du det du lette etter?",
    }),
  },
  {
    id: "stjerner",
    label: "Stjerner",
    note: "1–5",
    survey: single({
      id: "stjerner",
      type: "rating",
      variant: "stars",
      prompt: "Hvor fornøyd er du med oversikten?",
    }),
  },
  {
    id: "nps",
    label: "NPS",
    note: "0–10",
    survey: single({
      id: "nps",
      type: "rating",
      variant: "nps",
      prompt: "Hvor sannsynlig er det at du anbefaler tjenesten?",
      lowLabel: "Lite sannsynlig",
      highLabel: "Svært sannsynlig",
    }),
  },
  {
    id: "ett-valg",
    label: "Enkeltvalg",
    survey: single({
      id: "ett-valg",
      type: "singleChoice",
      prompt: "Hva kom du for å gjøre?",
      required: true,
      options: [
        { value: "status", label: "Sjekke status" },
        { value: "sende", label: "Sende dokumentasjon" },
        { value: "annet", label: "Noe annet" },
      ],
    }),
  },
  {
    id: "flere-valg",
    label: "Flervalg",
    note: "avkryssing eller søk",
    survey: single({
      id: "flere-valg",
      type: "multiChoice",
      variant: "checkbox",
      prompt: "Hva brukte du i dag?",
      required: true,
      options: [
        { value: "oversikten", label: "Oversikten" },
        { value: "sok", label: "Søket" },
        { value: "meldinger", label: "Meldinger" },
      ],
    }),
  },
  {
    id: "fritekst",
    label: "Fritekst",
    note: "opptil 2000 tegn",
    survey: single({
      id: "fritekst",
      type: "text",
      prompt: "Hva kan vi gjøre bedre?",
    }),
  },
];

function Sporsmalstyper() {
  return (
    <div className="slide">
      <h2 className="slide-title">Spørsmålene dere kan bruke</h2>
      <div className="sporsmal__grid">
        {KINDS.map((kind) => (
          <figure key={kind.id} className="sporsmal__kind">
            <div className="sporsmal__frame" inert>
              <LiveSurvey
                survey={kind.survey}
                surveyId={`sporsmal-${kind.id}`}
                scale={0.75}
                viewport={{ width: 1280, height: 800 }}
                label={`Widgeten med et spørsmål av typen ${kind.label}`}
                className="sporsmal__survey"
              />
            </div>
            <figcaption className="sporsmal__caption">
              <span className="sporsmal__label">{kind.label}</span>
              {kind.note && <span className="sporsmal__note">{kind.note}</span>}
            </figcaption>
          </figure>
        ))}
        <p className="sporsmal__visible-if">
          Et spørsmål kan vises bare etter et bestemt svar.
        </p>
      </div>
    </div>
  );
}

export const sporsmalstyper: Slide = {
  id: "sporsmalstyper",
  title: "Spørsmålene dere kan bruke",
  notes: `Alle sju er den ekte widgeten, med ett spørsmål hver.

Vurdering i fire varianter: emoji 1–5, tommel, stjerner, NPS 0–10. Fritekst, enkeltvalg og flervalg, med avkryssing eller søkbar liste når det er mange alternativer.

Sider: ett spørsmål per side, eller flere sammen. Valgfri velkomstside og takkeside.

Betinget visning: et spørsmål vises bare når et annet svar passer, for eksempel «Hva manglet?» etter «Nei».

Fagsystemer: tommel eller enkeltvalg rett etter en fullført oppgave er ofte nok.`,
  Component: Sporsmalstyper,
};
