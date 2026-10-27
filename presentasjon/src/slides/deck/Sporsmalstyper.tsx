import type { SurveyDocumentV1, SurveyQuestionV1 } from "@navikt/lumi-survey";
import type { CSSProperties } from "react";
import emojiKort from "../../assets/skjermbilder/typer-emoji.webp";
import enkeltvalgKort from "../../assets/skjermbilder/typer-enkeltvalg.webp";
import flervalgKort from "../../assets/skjermbilder/typer-flervalg.webp";
import fritekstKort from "../../assets/skjermbilder/typer-fritekst.webp";
import npsKort from "../../assets/skjermbilder/typer-nps.webp";
import stjernerKort from "../../assets/skjermbilder/typer-stjerner.webp";
import tommelKort from "../../assets/skjermbilder/typer-tommel.webp";
import { LiveSurvey } from "../../components/LiveSurvey";
import { Tag } from "../../components/Tag";
import { type Slide, type SlideProps, useRenderMode } from "../../engine";
import { cssVars, cx } from "../../engine/css";
import { LineMap, MapText } from "../../map";
import "./sporsmal.css";

/*
 * Lumi's seven question types, two at a time: the real widget on top, and
 * under it the card the same question gets in the dashboard. The card
 * slides out from under the widget, as a receipt from a till. The cards
 * are shots of the mock dashboard with test data, 384 CSS px wide like the
 * panel. The questions in the widgets are the questions on the cards.
 */

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
  /** The NPS panel is 32rem wide, the others 24rem. */
  wide?: boolean;
  /** The open panel's height in CSS px, measured on the stage. */
  height: number;
  survey: SurveyDocumentV1;
  /** The question's card in the dashboard, in CSS px at 384 wide. */
  card: { src: string; height: number; alt: string };
}

// Defined once, outside the component: a new object restarts the widget.
const KINDS: readonly Kind[] = [
  {
    id: "emoji",
    label: "Emoji",
    note: "1 til 5",
    height: 214,
    survey: single({
      id: "emoji",
      type: "rating",
      variant: "emoji",
      prompt: "Hvor fornøyd er du?",
    }),
    card: {
      src: emojiKort,
      height: 264,
      alt: "Kortet i dashboardet: Hvor fornøyd er du?, 80 svar. Gjennomsnitt 3,7 av 5, og en stolpe for hver verdi fra 5 til 1.",
    },
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
      prompt: "Hvor fornøyd er du med denne siden?",
    }),
    card: {
      src: stjernerKort,
      height: 264,
      alt: "Kortet i dashboardet: Hvor fornøyd er du med denne siden?, 40 svar. Gjennomsnitt 4,0 av 5, og en stolpe for hver verdi fra 5 til 1.",
    },
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
      prompt: "Var denne informasjonen nyttig?",
    }),
    card: {
      src: tommelKort,
      height: 405,
      alt: "Kortet i dashboardet: Var denne informasjonen nyttig?, 50 svar. 64 prosent positive, i en ring delt i Ja, 32 svar, og Nei, 18 svar.",
    },
  },
  {
    id: "nps",
    label: "NPS",
    note: "0 til 10",
    wide: true,
    height: 246,
    survey: single({
      id: "nps",
      type: "rating",
      variant: "nps",
      prompt: "Hvor sannsynlig er det at du vil anbefale nav.no til andre?",
      lowLabel: "Svært usannsynlig",
      highLabel: "Svært sannsynlig",
    }),
    card: {
      src: npsKort,
      height: 440,
      alt: "Kortet i dashboardet: Hvor sannsynlig er det at du vil anbefale nav.no til andre?, 38 svar. NPS pluss 39, og en stolpe for hver verdi fra 10 til 0.",
    },
  },
  {
    id: "enkeltvalg",
    label: "Enkeltvalg",
    height: 238,
    survey: single({
      id: "enkeltvalg",
      type: "singleChoice",
      prompt: "Hvem svarer du som?",
      required: true,
      options: [
        { value: "privatperson", label: "Privatperson" },
        { value: "arbeidsgiver", label: "Arbeidsgiver" },
      ],
    }),
    card: {
      src: enkeltvalgKort,
      height: 182,
      alt: "Kortet i dashboardet: Hvem svarer du som?, 80 svar. Privatperson 71 prosent, Arbeidsgiver 29 prosent.",
    },
  },
  {
    id: "flervalg",
    label: "Flervalg",
    note: "avkryssing eller søk",
    height: 286,
    survey: single({
      id: "flervalg",
      type: "multiChoice",
      variant: "checkbox",
      prompt: "Hva brukte du?",
      required: true,
      options: [
        { value: "innsending", label: "Innsending" },
        { value: "arkiv", label: "Arkiv" },
        { value: "kalkulator", label: "Kalkulator" },
      ],
    }),
    card: {
      src: flervalgKort,
      height: 250,
      alt: "Kortet i dashboardet: Hva brukte du?, 80 svar, flere svar mulig. Innsending 73 prosent, Arkiv 61 prosent, Kalkulator 21 prosent.",
    },
  },
  {
    id: "fritekst",
    label: "Fritekst",
    // The speaker says the standard, 1000.
    note: "opptil 2000 tegn",
    height: 366,
    survey: single({
      id: "fritekst",
      type: "text",
      prompt: "Kommentar",
    }),
    card: {
      src: fritekstKort,
      height: 598,
      alt: "Kortet i dashboardet: Kommentar, 77 tekstsvar. Uttrykk som går igjen, øverst endelig en løsning og grensesnitt som var lett, med fire svar hver. Under står de siste svarene, som «Intuitivt grensesnitt som var lett å navigere.»",
    },
  },
];

const BY_ID = Object.fromEntries(KINDS.map((kind) => [kind.id, kind]));

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
/** Between a panel and its card, in stage px. */
const GAP = 44;

/**
 * One click: the kinds side by side, a widget over its card, or beside it
 * for the tall free text card. Every box is placed in stage px, and all of
 * it stays left of the Teams corner.
 */
interface Steg {
  kinds: readonly string[];
  scale: number;
  /** The panels' left edges. */
  x: readonly number[];
  /** The panels' top edge. */
  y: number;
  /** The card goes beside the widget instead of under it. */
  beside?: boolean;
  /** The NPS panel keeps its own width, and its card goes under the middle. */
  natural?: boolean;
}

const STEG: readonly Steg[] = [
  { kinds: ["emoji", "stjerner"], scale: 1.4, x: [112, 700], y: 250 },
  {
    kinds: ["tommel", "nps"],
    scale: 1.1,
    x: [112, 594],
    y: 236,
    natural: true,
  },
  { kinds: ["enkeltvalg", "flervalg"], scale: 1.35, x: [112, 680], y: 250 },
  { kinds: ["fritekst"], scale: 1.25, x: [112], y: 250, beside: true },
];

/** In print all seven share the page, in one row. */
const PRINT_SCALE = 0.58;
const PRINT_Y = 340;
const PRINT_PITCH = 243;

interface Plass {
  scale: number;
  x: number;
  y: number;
  /** Where the card's top edge lands: the same for every card in a row. */
  cardY: number;
  /** How wide the caption may grow. */
  captionWidth: number;
  beside: boolean;
  natural: boolean;
}

/**
 * The widget's own zoom: NPS is wider, so it is made as wide as its card,
 * unless the step has room for it as it is.
 */
function widgetScale(kind: Kind, scale: number, natural = false) {
  return kind.wide && !natural
    ? (scale * PANEL_WIDTH) / WIDE_PANEL_WIDTH
    : scale;
}

/** Right of this, the index has the page. */
const CONTENT_END = 1420;

/**
 * The places of a row of kinds: the cards land level, below the tallest
 * panel, and each caption may grow to the next column.
 */
function places(
  ids: readonly string[],
  { scale, x, y, beside = false, natural = false }: Omit<Steg, "kinds">,
  { gap = GAP, end = CONTENT_END } = {},
): Plass[] {
  const kinds = ids.map((id) => BY_ID[id]);
  const tallest = Math.max(
    ...kinds.map((kind) => kind.height * widgetScale(kind, scale, natural)),
  );
  const cardY = beside ? y : Math.round(y + tallest + gap);
  return kinds.map((_, i) => {
    const next = x[i + 1];
    return {
      scale,
      x: x[i],
      y,
      cardY,
      captionWidth: (next === undefined ? end : next - 24) - x[i],
      beside,
      natural,
    };
  });
}

const STEG_PLACES = STEG.map((steg) => places(steg.kinds, steg));

const PRINT_PLACES = places(
  KINDS.map((kind) => kind.id),
  {
    scale: PRINT_SCALE,
    x: KINDS.map((_, i) => 112 + i * PRINT_PITCH),
    y: PRINT_Y,
  },
  { gap: 28, end: 1808 },
);

function Kolonne({ kind, plass }: { kind: Kind; plass: Plass }) {
  const { scale, x, y, cardY, captionWidth, beside, natural } = plass;
  const zoom = widgetScale(kind, scale, natural);
  const panelWidth = (kind.wide ? WIDE_PANEL_WIDTH : PANEL_WIDTH) * zoom;
  const panelHeight = kind.height * zoom;
  const pad = DOCK_OFFSET * zoom;
  const frame: CSSProperties = {
    left: x - pad,
    top: y - pad - ROOM * zoom,
    width: panelWidth + pad * 2,
    height: panelHeight + pad * 2 + ROOM * zoom,
  };
  const cardWidth = PANEL_WIDTH * scale;
  const cardHeight = kind.card.height * scale;
  // Under a wider panel the card comes out of the middle.
  const cardX = x + (beside ? 0 : (panelWidth - cardWidth) / 2);
  // The card's window starts at the panel's edge, so the card comes out
  // from under it, and the cards in a row land level with each other.
  const panelBottom = y + panelHeight;
  const drop = beside ? GAP : cardY - panelBottom;
  const window: CSSProperties = beside
    ? {
        left: x + panelWidth,
        top: cardY,
        width: GAP + cardWidth,
        height: cardHeight,
      }
    : {
        left: cardX,
        top: panelBottom,
        width: cardWidth,
        height: drop + cardHeight,
      };
  const card: CSSProperties = {
    left: beside ? GAP : 0,
    top: beside ? 0 : drop,
    width: cardWidth,
    height: cardHeight,
    borderRadius: 12 * scale,
    ...cssVars({
      "--kort-inn": beside
        ? `translateX(${-(drop + cardWidth)}px)`
        : `translateY(${-(drop + cardHeight)}px)`,
    }),
  };
  return (
    <figure className="sporsmal__kind">
      <figcaption
        className="sporsmal__caption"
        style={{ left: x, bottom: 1080 - y + 14, width: captionWidth }}
      >
        <span className="sporsmal__label">{kind.label}</span>
        {kind.note && <span className="sporsmal__note">{kind.note}</span>}
      </figcaption>
      <div className="sporsmal__frame" style={frame} inert>
        <LiveSurvey
          survey={kind.survey}
          surveyId={`sporsmal-${kind.id}`}
          scale={zoom}
          viewport={VIEWPORT}
          label={`Widgeten med et spørsmål av typen ${kind.label}`}
          className="sporsmal__survey"
        />
      </div>
      <div className="sporsmal__kort-vindu" style={window}>
        <img
          className="sporsmal__kort"
          src={kind.card.src}
          alt={kind.card.alt}
          style={card}
        />
      </div>
    </figure>
  );
}

/*
 * The index: the seven on a line, top right, clear of the Teams corner. A
 * frame on the line, like a train, holds the kinds on the stage and moves
 * on with every click.
 */
const LINE_X = 1500;
const FIRST_Y = 226;
const PITCH = 88;

function stationY(id: string) {
  return FIRST_Y + KINDS.findIndex((kind) => kind.id === id) * PITCH;
}

function Linje({ step }: { step: number }) {
  const shown = STEG[step]?.kinds ?? [];
  const top = stationY(shown[0] ?? KINDS[0].id);
  const bottom = stationY(shown[shown.length - 1] ?? KINDS[0].id);
  const last = stationY(KINDS[KINDS.length - 1].id);
  return (
    <LineMap
      className="typer"
      label={`Linja med de sju spørsmålstypene: ${KINDS.map((kind) => kind.label).join(", ")}. Nå vises ${shown.map((id) => BY_ID[id].label).join(" og ")}.`}
    >
      <path
        d={`M${LINE_X} ${FIRST_Y} L${LINE_X} ${last}`}
        className="typer__linje"
      />
      <rect
        className="typer__tog"
        x={LINE_X - 32}
        width={64}
        rx={32}
        style={{ y: top - 32, height: bottom - top + 64 }}
      />
      {KINDS.map((kind) => {
        const here = shown.includes(kind.id);
        const y = stationY(kind.id);
        return (
          <g
            key={kind.id}
            className={cx("typer__stasjon", here && "typer__stasjon--her")}
          >
            <circle cx={LINE_X} cy={y} style={{ r: here ? 18 : 12 }} />
            <MapText
              x={LINE_X + 54}
              y={y}
              size={here ? 44 : 36}
              weight={here ? 800 : 600}
              className="typer__navn"
            >
              {kind.label}
            </MapText>
          </g>
        );
      })}
    </LineMap>
  );
}

function Sporsmalstyper({ step, active }: SlideProps) {
  const mode = useRenderMode();
  if (mode === "print") {
    return (
      <div className="slide sporsmal sporsmal--print">
        <h2 className="sporsmal__title">Lumi har sju spørsmålstyper i dag</h2>
        <Tag kind="screenshot" className="sporsmal__tag" />
        {KINDS.map((kind, i) => (
          <Kolonne key={kind.id} kind={kind} plass={PRINT_PLACES[i]} />
        ))}
      </div>
    );
  }
  // On the stage the first kinds come out when the slide is presented, not
  // while it waits next to the one before.
  const live = active || mode !== "stage";
  return (
    <div className="slide sporsmal">
      <h2 className="sporsmal__title">Lumi har sju spørsmålstyper i dag</h2>
      <Tag kind="screenshot" className="sporsmal__tag" />
      {STEG.map((steg, i) => (
        <div
          key={steg.kinds.join("-")}
          className="sporsmal__steg"
          data-reveal=""
          data-revealed={live && step === i ? "" : undefined}
        >
          {steg.kinds.map((id, j) => (
            <Kolonne key={id} kind={BY_ID[id]} plass={STEG_PLACES[i][j]} />
          ))}
        </div>
      ))}
      <Linje step={step} />
    </div>
  );
}

export const sporsmalstyper: Slide = {
  id: "sporsmalstyper",
  title: "Lumi har sju spørsmålstyper i dag",
  steps: 3,
  Component: Sporsmalstyper,
};
