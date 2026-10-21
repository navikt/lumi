import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { LiveSurvey } from "../../components/LiveSurvey";
import type { Slide } from "../../engine";
import { LineMap, MapText } from "../../map";
import "./sporsmal.css";

/*
 * The real widget, with the map's own lines pointing at what the team
 * decides (left) and what Lumi decides (right). Both questions show at
 * once, so the follow-up can be pointed at.
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

/** The frame on the stage, between the two sides. */
export const STYRER_FRAME = {
  x: 700,
  y: 320,
  width: 560,
  height: 700,
} as const;

/** A point in the widget, with the name of what is there. */
interface Pointer {
  /** Where the line ends, on the widget, in stage pixels. */
  at: readonly [number, number];
  label: string;
  note?: string;
}

/*
 * Measured on the stage with the widget open: the panel's left edge is at
 * x 776, its right edge at 1234, the first question at y 425, the follow-up
 * at 603 with «(valgfritt)» ending at 1013, and the notice from y 790.
 */
const TEAM: readonly Pointer[] = [
  { at: [776, 425], label: "Spørsmålene og tekstene" },
  {
    at: [776, 603],
    label: "Hvem som får hvilke spørsmål",
    note: "betinget visning",
  },
  {
    at: [776, 980],
    label: "Når og hvor den vises",
    note: "appen bestemmer i koden",
  },
];

const LUMI: readonly Pointer[] = [
  { at: [1234, 426], label: "Utseendet fra Aksel" },
  { at: [1028, 604], label: "Faste tekster", note: "som Send og (valgfritt)" },
  {
    at: [1214, 800],
    label: "Varselet om personopplysninger",
    note: "på som standard, la det stå",
  },
];

const RING = 14;
const LEFT_END = 640;
const RIGHT_START = 1320;

function PointerLine({
  pointer,
  side,
}: {
  pointer: Pointer;
  side: "team" | "lumi";
}) {
  const [x, y] = pointer.at;
  const labelX = side === "team" ? LEFT_END : RIGHT_START;
  const anchor = side === "team" ? "end" : "start";
  const lineStart = side === "team" ? LEFT_END + 20 : RIGHT_START - 20;
  const hasNote = Boolean(pointer.note);
  return (
    <g>
      {/* Cased, as on a transit map, so the line shows on the light widget too. */}
      <path
        d={`M${lineStart} ${y} L${side === "team" ? x - RING : x + RING} ${y}`}
        className="styrer__casing"
      />
      <path
        d={`M${lineStart} ${y} L${side === "team" ? x - RING : x + RING} ${y}`}
        className="styrer__line"
      />
      <circle cx={x} cy={y} r={RING} className="styrer__ring" />
      <MapText
        x={labelX}
        y={hasNote ? y - 20 : y}
        anchor={anchor}
        size={36}
        weight={700}
      >
        {pointer.label}
      </MapText>
      {pointer.note && (
        <MapText
          x={labelX}
          y={y + 22}
          anchor={anchor}
          size={32}
          weight={600}
          muted
        >
          {pointer.note}
        </MapText>
      )}
    </g>
  );
}

function StyrerDere() {
  return (
    <div className="slide">
      <h2 className="slide-title">
        Dere bestemmer innholdet. Lumi setter rammene.
      </h2>
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
      <LineMap label="Den ekte widgeten. Til venstre det teamet bestemmer: spørsmålene og tekstene, hvem som får hvilke spørsmål med betinget visning, og når og hvor den vises, som appen bestemmer i koden. Til høyre det Lumi bestemmer: utseendet fra Aksel, faste tekster som Send og (valgfritt), og varselet om personopplysninger, som er på som standard og bør stå.">
        <g data-from={1}>
          <MapText x={LEFT_END} y={360} anchor="end" size={44} weight={800}>
            Dere bestemmer
          </MapText>
          {TEAM.map((pointer) => (
            <PointerLine key={pointer.label} pointer={pointer} side="team" />
          ))}
        </g>
        <g data-from={2}>
          <MapText x={RIGHT_START} y={360} size={44} weight={800}>
            Lumi bestemmer
          </MapText>
          {LUMI.map((pointer) => (
            <PointerLine key={pointer.label} pointer={pointer} side="lumi" />
          ))}
        </g>
      </LineMap>
    </div>
  );
}

export const styrerDere: Slide = {
  id: "styrer-dere",
  title: "Dere bestemmer innholdet. Lumi setter rammene.",
  steps: 2,
  notes: `Fra start: den ekte widgeten, med to spørsmål.

Klikk 1, dere bestemmer: spørsmålene og tekstene i Surveyverksted. Betinget visning og kontekst avgjør hvem som får hvilke spørsmål, for eksempel «Hva manglet?» bare etter «Nei». Når og hvor den vises, bestemmer appen i koden: når siden lastes, etter en fullført oppgave eller som knappen «Gi tilbakemelding», nederst til høyre eller venstre.

Klikk 2, Lumi bestemmer: utseendet følger Aksel. Faste tekster som «Send», «Neste», «Tilbake» og «(valgfritt)» kan dere ikke endre. Varselet om personopplysninger er på som standard. La det stå. Lumi API maskerer kjente mønstre og sletter svar automatisk etter 12 måneder.

Det som ikke er lov, står på neste side om ansvar: be om navn eller fødselsnummer, og rekruttere til brukertester. Endringer krever ny versjon av appen, det sa vi på forrige slide.`,
  Component: StyrerDere,
};
