import type { SurveyDocumentV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import { LiveSurvey } from "../../components/LiveSurvey";
import { type Slide, type SlideProps, useRenderMode } from "../../engine";
import { cx } from "../../engine/css";
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
  /** The NPS panel is wider than the others, so it gets two columns. */
  wide?: boolean;
  survey: SurveyDocumentV1;
}

/** The ratings come first, the other types on the next step. */
type Group = "ratings" | "others";

// Defined once, outside the component: a new object restarts the widget.
const RATINGS: readonly Kind[] = [
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
      prompt: "Fant du det du trengte i saken?",
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
    wide: true,
    survey: single({
      id: "nps",
      type: "rating",
      variant: "nps",
      prompt: "Hvor sannsynlig er det at du anbefaler tjenesten?",
      lowLabel: "Lite sannsynlig",
      highLabel: "Svært sannsynlig",
    }),
  },
];

const OTHERS: readonly Kind[] = [
  {
    id: "ett-valg",
    label: "Enkeltvalg",
    survey: single({
      id: "ett-valg",
      type: "singleChoice",
      prompt: "Hva skulle du gjøre?",
      required: true,
      options: [
        { value: "referat", label: "Skrive referat" },
        { value: "oppfolging", label: "Planlegge videre oppfølging" },
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
    // «opptil 2000» stays together when the note wraps.
    note: "1000 tegn som standard, opptil\u00a02000",
    survey: single({
      id: "fritekst",
      type: "text",
      prompt: "Hva kan vi gjøre bedre?",
    }),
  },
];

const VIEWPORT = { width: 1280, height: 800 };
/** On the stage: the question text is about 22 px. */
const STAGE_SCALE = 1.1;
/** In print, all seven share the page, so the widgets are smaller. */
const PRINT_SCALE = 0.66;

function KindFigure({
  kind,
  group,
  scale,
}: {
  kind: Kind;
  group: Group;
  scale: number;
}) {
  return (
    <figure
      className={cx(
        "sporsmal__kind",
        `sporsmal__kind--${group}`,
        kind.wide && "sporsmal__kind--wide",
      )}
    >
      <div className="sporsmal__frame" inert>
        <LiveSurvey
          survey={kind.survey}
          surveyId={`sporsmal-${kind.id}`}
          scale={scale}
          viewport={VIEWPORT}
          label={`Widgeten med et spørsmål av typen ${kind.label}`}
          className="sporsmal__survey"
        />
      </div>
      <figcaption className="sporsmal__caption">
        <span className="sporsmal__label">{kind.label}</span>
        {kind.note && <span className="sporsmal__note">{kind.note}</span>}
      </figcaption>
    </figure>
  );
}

/** One group on the stage. It fades in on its own step and out on the next. */
function KindGroup({
  kinds,
  group,
  shown,
}: {
  kinds: readonly Kind[];
  group: Group;
  shown: boolean;
}) {
  return (
    <div
      className="sporsmal__group"
      data-reveal=""
      data-revealed={shown ? "" : undefined}
    >
      {kinds.map((kind) => (
        <KindFigure
          key={kind.id}
          kind={kind}
          group={group}
          scale={STAGE_SCALE}
        />
      ))}
    </div>
  );
}

function Sporsmalstyper({ step }: SlideProps) {
  const mode = useRenderMode();
  return (
    <div className="slide">
      <h2 className="slide-title">Spørsmålstypene dere kan bruke</h2>
      {mode === "print" ? (
        <div className="sporsmal__grid">
          {RATINGS.map((kind) => (
            <KindFigure
              key={kind.id}
              kind={kind}
              group="ratings"
              scale={PRINT_SCALE}
            />
          ))}
          {OTHERS.map((kind) => (
            <KindFigure
              key={kind.id}
              kind={kind}
              group="others"
              scale={PRINT_SCALE}
            />
          ))}
        </div>
      ) : (
        <>
          <KindGroup kinds={RATINGS} group="ratings" shown={step === 0} />
          <KindGroup kinds={OTHERS} group="others" shown={step >= 1} />
        </>
      )}
    </div>
  );
}

export const sporsmalstyper: Slide = {
  id: "sporsmalstyper",
  title: "Spørsmålstypene dere kan bruke",
  steps: 1,
  notes: `Alle sju er den ekte widgeten, med ett spørsmål hver. Spørsmålene er bare eksempler: teksten, alternativene og etikettene skriver dere selv.

Fra start: vurdering i fire varianter. Emoji 1–5, tommel, stjerner og NPS 0–10.

Klikk 1: enkeltvalg, flervalg og fritekst. Flervalg med avkryssing, eller som søkbar liste når det er mange alternativer. Fritekst har 1000 tegn som standard, og opptil 2000.

Sider: ett spørsmål per side, eller flere sammen. Valgfri velkomstside og takkeside.

Betinget visning, ordrett: «Et spørsmål kan vises bare etter et bestemt svar.» For eksempel «Hva manglet?» etter «Nei».

Fagsystemer: tommel eller enkeltvalg rett etter en fullført oppgave er ofte nok. Spør om løsningen, ikke om saksbehandlerens arbeid.`,
  Component: Sporsmalstyper,
};
