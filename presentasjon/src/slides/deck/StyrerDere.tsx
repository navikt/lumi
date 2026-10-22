import type { SurveyDocumentV1 } from "@navikt/lumi-survey";
import { LiveSurvey } from "../../components/LiveSurvey";
import { type Slide, type SlideProps, useRenderMode } from "../../engine";
import { LineMap, MapText } from "../../map";
import { type Peker, PekerLinje } from "./SporsmalPeker";
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
  y: 272,
  width: 560,
  height: 700,
} as const;

/** Positions measured with the frame at y 320, moved with it. */
const DY = STYRER_FRAME.y - 320;

/*
 * Measured on the stage with the widget open: the panel's left edge is at
 * x 776, its right edge at 1234, the first question at y 425, the follow-up
 * at 603 with «(valgfritt)» ending at 1013, the counter at 755 and the
 * notice from y 790. All y values here are moved with the frame.
 */
const TEAM: readonly Peker[] = [
  { at: [776, 425 + DY], label: "Spørsmålene og tekstene" },
  {
    at: [776, 603 + DY],
    label: "Hvem som får hvilke spørsmål",
    note: "betinget visning",
  },
  {
    at: [776, 980 + DY],
    label: "Når og hvor den vises",
    note: "appen bestemmer i koden",
  },
];

const LUMI: readonly Peker[] = [
  { at: [1234, 426 + DY], label: "Utseendet fra Aksel" },
  {
    at: [1028, 604 + DY],
    label: "Faste tekster",
    note: "(valgfritt) og tegntelleren",
  },
  {
    at: [1214, 800 + DY],
    label: "Varselet om personopplysninger",
    note: "på som standard, la det stå",
  },
];

const LEFT_END = 640;
const RIGHT_START = 1320;

function StyrerDere({ step }: SlideProps) {
  // When Lumi's side comes, the team's side steps back. Print shows both.
  const mode = useRenderMode();
  const back = step >= 2 && mode !== "print";
  return (
    <div className="slide">
      <h2 className="styrer__title">
        Dere bestemmer innholdet.
        <br />
        Lumi setter rammene.
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
      <LineMap label="Den ekte widgeten. Til venstre det teamet bestemmer: spørsmålene og tekstene, hvem som får hvilke spørsmål med betinget visning, og når og hvor den vises, som appen bestemmer i koden. Til høyre det Lumi bestemmer: utseendet fra Aksel, faste tekster som (valgfritt) og tegntelleren, og varselet om personopplysninger, som er på som standard og bør stå.">
        <g data-from={1}>
          <g className="styrer__side" data-back={back ? "" : undefined}>
            <MapText
              x={LEFT_END}
              y={360 + DY}
              anchor="end"
              size={44}
              weight={800}
            >
              Dere bestemmer
            </MapText>
            {TEAM.map((peker) => (
              <PekerLinje
                key={peker.label}
                peker={peker}
                side="left"
                labelX={LEFT_END}
              />
            ))}
          </g>
        </g>
        <g data-from={2}>
          <MapText x={RIGHT_START} y={360 + DY} size={44} weight={800}>
            Lumi bestemmer
          </MapText>
          {LUMI.map((peker) => (
            <PekerLinje
              key={peker.label}
              peker={peker}
              side="right"
              labelX={RIGHT_START}
            />
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

Klikk 1, dere bestemmer: spørsmålene og tekstene i Surveyverksted. Betinget visning og kontekst avgjør hvem som får hvilke spørsmål, for eksempel «Hva manglet?» bare etter «Nei». Når og hvor den vises, bestemmer appen i koden: når siden lastes, etter en fullført oppgave eller som knappen «Gi tilbakemelding», nede til høyre eller til venstre. Knappetekster og feilmeldinger, som «Send», kan appen også endre i koden.

Klikk 2, Lumi bestemmer: utseendet følger Aksel. Noen tekster er faste: «Neste», «Tilbake», «(valgfritt)» og tegntelleren under fritekstfeltet. Varselet om personopplysninger er på som standard. La det stå. Lumi API maskerer kjente mønstre og sletter svar automatisk etter 12 måneder.

Det som ikke er lov, står på sliden om ansvar: be om navn eller fødselsnummer, og rekruttere til brukertester. Endringer i surveyen krever en ny versjon av appen.`,
  Component: StyrerDere,
};
