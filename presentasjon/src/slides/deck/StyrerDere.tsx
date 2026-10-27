import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { LiveSurvey } from "../../components/LiveSurvey";
import type { Slide, SlideProps } from "../../engine";
import { LineMap, MapText } from "../../map";
import {
  type Boks,
  Merker,
  type Peker,
  PekerLinje,
  pekerKey,
  Ramme,
} from "./SporsmalPeker";
import "./sporsmal.css";

/*
 * The real widget, split in two by colour. First the team's side: a green
 * highlighter over the words the team writes, and a green frame round the
 * app, which decides when and where the widget shows. Then Lumi's side: a
 * blue highlighter over the fixed texts, and blue frames round the look and
 * the notice. Both questions show at once, so the follow-up can be pointed
 * at.
 */
const SURVEY: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "oppgaven",
      questions: [
        {
          id: "fikk",
          type: "singleChoice",
          prompt: "Fikk du gjort det du kom for?",
          required: true,
          options: [
            { value: "ja", label: "Ja" },
            { value: "nei", label: "Nei" },
          ],
        },
        {
          id: "manglet",
          type: "text",
          prompt: "Hva manglet?",
          required: false,
          maxLength: 500,
        },
      ],
    },
  ],
};

/** The app's frame on the stage, between the two sides. */
export const STYRER_FRAME = {
  x: 700,
  y: 272,
  width: 560,
  height: 700,
} as const;

/*
 * Measured on the stage with the widget open (zoom 1.2): the panel from
 * x 774 to 1235 and y 339 to 946. The lines of text, as the browser sets
 * them: the question at y 360, «Ja» at 426 and «Nei» at 483 from x 833,
 * «Hva manglet?» at 541 up to x 921 and «(valgfritt)» after it, the
 * counter at 692 and the notice from 741 to 849.
 */
const WORDS: readonly Boks[] = [
  { x: 789, y: 358, width: 308, height: 38 },
  { x: 827, y: 425, width: 33, height: 32 },
  { x: 827, y: 482, width: 42, height: 32 },
  { x: 789, y: 539, width: 133, height: 34 },
];

/** The app is the team's: its frame decides when and where the widget shows. */
const APP: Boks = {
  x: STYRER_FRAME.x - 14,
  y: STYRER_FRAME.y - 14,
  width: STYRER_FRAME.width + 28,
  height: STYRER_FRAME.height + 28,
};

/** Lumi's fixed texts: «(valgfritt)» and the counter. */
const FIXED: readonly Boks[] = [
  { x: 924, y: 539, width: 92, height: 34 },
  { x: 789, y: 690, width: 138, height: 34 },
];

const PANEL: Boks = { x: 764, y: 329, width: 481, height: 627 };
const NOTICE: Boks = { x: 787, y: 733, width: 436, height: 124 };

/** The team's rings sit on the app's green frame, level with their part. */
const TEAM: readonly Peker[] = [
  { at: [APP.x, 377], label: "Spørsmålene og tekstene" },
  {
    at: [APP.x, 556],
    label: "Hvem som får hvilke spørsmål",
    note: "betinget visning",
  },
  {
    at: [APP.x, 920],
    label: "Når og hvor den vises",
    note: "i appens kode",
  },
];

/**
 * Lumi's rings sit on the blue frames, and just after «(valgfritt)». The
 * notice's ring is high on its frame, so the note under its name ends above
 * the Teams corner.
 */
const LUMI: readonly Peker[] = [
  { at: [PANEL.x + PANEL.width, 377], label: "Utseendet fra Aksel" },
  {
    at: [FIXED[0].x + FIXED[0].width + 16, 556],
    label: "Faste tekster",
    note: "(valgfritt) og tegntelleren",
  },
  {
    at: [NOTICE.x + NOTICE.width, 752],
    label: ["Varselet om", "personopplysninger"],
    note: "på som standard, la det stå",
  },
];

const LEFT_END = 640;
const RIGHT_START = 1320;
const HEADER_Y = 312;

function StyrerDere({ step }: SlideProps) {
  const team = step >= 1;
  const lumi = step >= 2;
  return (
    <div className="slide">
      <h2 className="styrer__title">Hva kan dere endre i widgeten?</h2>
      <div
        className="styrer__frame"
        style={{
          left: STYRER_FRAME.x,
          top: STYRER_FRAME.y,
          width: STYRER_FRAME.width,
          height: STYRER_FRAME.height,
        }}
        inert
      >
        <LiveSurvey
          survey={SURVEY}
          surveyId="styrer-dere"
          scale={1.2}
          viewport={{ width: 1280, height: 800 }}
          label="Widgeten med spørsmålet Fikk du gjort det du kom for?, med Ja og Nei, og Hva manglet?, valgfritt, med varselet om personopplysninger."
          className="styrer__survey"
        />
      </div>
      <Merker linjer={WORDS} on={team} start={250} />
      <Merker linjer={FIXED} on={lumi} tone="lumi" start={700} />
      <LineMap label="Widgeten, delt i to. Til venstre, i grønt, det teamet bestemmer: spørsmålene og tekstene, hvem som får hvilke spørsmål med betinget visning, og når og hvor den vises, i appens kode. Til høyre, i blått, det Lumi bestemmer: utseendet fra Aksel, faste tekster som (valgfritt) og tegntelleren, og varselet om personopplysninger, som er på som standard og bør stå.">
        <Ramme boks={APP} on={team} tone="team" radius={24} start={100} />
        <Ramme boks={PANEL} on={lumi} radius={22} start={100} />
        <Ramme boks={NOTICE} on={lumi} radius={14} start={450} tid={550} />
        <g data-from={1} className="styrer__side">
          <MapText
            x={LEFT_END}
            y={HEADER_Y}
            anchor="end"
            size={44}
            weight={800}
            className="peker__hode peker__hode--team"
          >
            Dere bestemmer
          </MapText>
          {TEAM.map((peker) => (
            <PekerLinje
              key={pekerKey(peker)}
              peker={peker}
              side="left"
              labelX={LEFT_END}
              tone="team"
            />
          ))}
        </g>
        <g data-from={2} className="styrer__side">
          <MapText
            x={RIGHT_START}
            y={HEADER_Y}
            size={44}
            weight={800}
            className="peker__hode peker__hode--lumi"
          >
            Lumi bestemmer
          </MapText>
          {LUMI.map((peker) => (
            <PekerLinje
              key={pekerKey(peker)}
              peker={peker}
              side="right"
              labelX={RIGHT_START}
              tone="lumi"
            />
          ))}
        </g>
      </LineMap>
    </div>
  );
}

export const styrerDere: Slide = {
  id: "styrer-dere",
  title: "Hva kan dere endre i widgeten?",
  steps: 2,
  Component: StyrerDere,
};
