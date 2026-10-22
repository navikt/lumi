import type { SurveyDocumentV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import type { CSSProperties } from "react";
import { LiveSurvey } from "../../components/LiveSurvey";
import { type Slide, type SlideProps, useRenderMode } from "../../engine";
import "./sporsmal.css";

/** One question per widget, so each type is seen on its own. */
function single(question: SurveyQuestionV1): SurveyDocumentV1 {
  return {
    authoringSchemaVersion: 1,
    type: question.type === "rating" ? "rating" : "custom",
    pages: [{ id: question.id, questions: [question] }],
  };
}

/** The ratings come first, the other types on the next step. */
type Group = "ratings" | "others";

interface Kind {
  id: string;
  label: string;
  note?: string;
  /** The NPS panel is 32rem wide, the others 24rem. */
  wide?: boolean;
  /** The open panel's height in CSS px, measured on the stage. */
  height: number;
  survey: SurveyDocumentV1;
}

// Defined once, outside the component: a new object restarts the widget.
const RATINGS: readonly Kind[] = [
  {
    id: "emoji",
    label: "Emoji",
    note: "1 til 5",
    height: 238,
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
    height: 210,
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
    note: "1 til 5",
    height: 238,
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
    note: "0 til 10",
    wide: true,
    height: 222,
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
    height: 286,
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
    height: 286,
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
    note: "standard 1000 tegn, opptil 2000",
    height: 366,
    survey: single({
      id: "fritekst",
      type: "text",
      prompt: "Hva kan vi gjøre bedre?",
    }),
  },
];

const VIEWPORT = { width: 1280, height: 800 };

/*
 * The widget sizes itself in CSS px: the panel is 24rem wide (NPS 32rem)
 * and docks 16 px from the lower right corner of its frame. Each frame is
 * as tall as its panel, plus a little room, so the panels in a row line up
 * at the top. The frames have no surface, so the panels stand on the stage.
 */
const PANEL_WIDTH = 384;
const WIDE_PANEL_WIDTH = 512;
const DOCK_OFFSET = 16;
const ROOM = 4;

/** A widget's place: the panel's upper left corner, in stage px. */
interface Place {
  x: number;
  y: number;
}

interface Layout {
  scale: number;
  places: Record<string, Place>;
}

/*
 * On the stage each group has the page to itself, and the question text
 * is about 25 px. The panels are 538 px wide (NPS 717) with 41 px between
 * them, from margin to margin. The other types start higher, so the free
 * text note ends above y 800 where it passes x 1520, clear of the Teams
 * corner.
 */
const STAGE: Layout = {
  scale: 1.4,
  places: {
    emoji: { x: 112, y: 196 },
    tommel: { x: 691, y: 196 },
    stjerner: { x: 1270, y: 196 },
    nps: { x: 112, y: 640 },
    "ett-valg": { x: 112, y: 170 },
    "flere-valg": { x: 691, y: 170 },
    fritekst: { x: 1270, y: 170 },
  },
};

/** In print all seven share the page: the ratings on the first row. */
const PRINT: Layout = {
  scale: 0.8,
  places: {
    emoji: { x: 112, y: 196 },
    tommel: { x: 467, y: 196 },
    stjerner: { x: 822, y: 196 },
    nps: { x: 1177, y: 196 },
    "ett-valg": { x: 112, y: 600 },
    "flere-valg": { x: 467, y: 600 },
    fritekst: { x: 822, y: 600 },
  },
};

function panelWidth(kind: Kind) {
  return kind.wide ? WIDE_PANEL_WIDTH : PANEL_WIDTH;
}

function frameStyle(kind: Kind, { scale, places }: Layout): CSSProperties {
  const { x, y } = places[kind.id];
  const pad = DOCK_OFFSET * scale;
  return {
    left: x - pad,
    top: y - pad - ROOM * scale,
    width: (panelWidth(kind) + DOCK_OFFSET * 2) * scale,
    height: (kind.height + DOCK_OFFSET * 2 + ROOM) * scale,
  };
}

/** The caption: under the panel, on its left edge. */
function captionStyle(kind: Kind, { scale, places }: Layout): CSSProperties {
  const { x, y } = places[kind.id];
  return {
    left: x,
    top: y + kind.height * scale + 18,
    width: panelWidth(kind) * scale,
  };
}

function KindFigure({ kind, layout }: { kind: Kind; layout: Layout }) {
  return (
    <figure className="sporsmal__kind">
      <div className="sporsmal__frame" style={frameStyle(kind, layout)} inert>
        <LiveSurvey
          survey={kind.survey}
          surveyId={`sporsmal-${kind.id}`}
          scale={layout.scale}
          viewport={VIEWPORT}
          label={`Widgeten med et spørsmål av typen ${kind.label}`}
          className="sporsmal__survey"
        />
      </div>
      <figcaption
        className="sporsmal__caption"
        style={captionStyle(kind, layout)}
      >
        <span className="sporsmal__label">{kind.label}</span>
        {kind.note && <span className="sporsmal__note">{kind.note}</span>}
      </figcaption>
    </figure>
  );
}

/** One group on the stage. It fades in on its own step and out on the next. */
function KindGroup({
  kinds,
  shown,
}: {
  kinds: readonly Kind[];
  shown: boolean;
}) {
  return (
    <div
      className="sporsmal__group"
      data-reveal=""
      data-revealed={shown ? "" : undefined}
    >
      {kinds.map((kind) => (
        <KindFigure key={kind.id} kind={kind} layout={STAGE} />
      ))}
    </div>
  );
}

const GROUPS: Record<Group, readonly Kind[]> = {
  ratings: RATINGS,
  others: OTHERS,
};

function Sporsmalstyper({ step }: SlideProps) {
  const mode = useRenderMode();
  return (
    <div className="slide">
      <h2 className="sporsmal__title">Dere velger hvordan brukerne svarer</h2>
      {mode === "print" ? (
        <div className="sporsmal__group">
          {[...RATINGS, ...OTHERS].map((kind) => (
            <KindFigure key={kind.id} kind={kind} layout={PRINT} />
          ))}
        </div>
      ) : (
        <>
          <KindGroup kinds={GROUPS.ratings} shown={step === 0} />
          <KindGroup kinds={GROUPS.others} shown={step >= 1} />
        </>
      )}
    </div>
  );
}

export const sporsmalstyper: Slide = {
  id: "sporsmalstyper",
  title: "Dere velger hvordan brukerne svarer",
  steps: 1,
  notes: `Alle sju er den ekte widgeten, med ett spørsmål hver. Spørsmålene er bare eksempler: teksten, alternativene og etikettene skriver dere selv.

Fra start: vurdering i fire varianter. Emoji fra 1 til 5, tommel opp eller ned, stjerner fra 1 til 5 og NPS fra 0 til 10.

Klikk 1: enkeltvalg, flervalg og fritekst. Flervalg med avkryssing, eller som søkbar liste når det er mange alternativer. Fritekst har 1000 tegn som standard, og opptil 2000.

Sider: ett spørsmål per side, eller flere sammen. Valgfri velkomstside og takkeside.

Betinget visning, ordrett: «Et spørsmål kan vises bare etter et bestemt svar.» For eksempel «Hva manglet?» etter «Nei».

Fagsystemer: tommel eller enkeltvalg rett etter en fullført oppgave er ofte nok. Spør om løsningen. En survey i et fagsystem skal ikke vurdere arbeidet til saksbehandleren.`,
  Component: Sporsmalstyper,
};
