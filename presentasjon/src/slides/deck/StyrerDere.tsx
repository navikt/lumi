import type { Slide } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import "./sporsmal.css";

const TOP = 440;
const SPACING = 120;

interface Stop {
  label: string;
  note?: string;
}

interface Column {
  x: number;
  title: string;
  stops: readonly Stop[];
  /** Things Lumi does not do: drawn dashed and dim. */
  not?: boolean;
  from?: number;
}

/**
 * The columns share rows, so a long label must end well before the next
 * column's ring on the same row. The longest note in the middle column sits
 * on its last row, below the shorter third column.
 */
const COLUMNS: readonly Column[] = [
  {
    x: 150,
    title: "Dere bestemmer",
    stops: [
      { label: "Spørsmålene og tekstene" },
      { label: "Når surveyen vises", note: "appen bestemmer i koden" },
      {
        label: "Hvem som får hvilke spørsmål",
        note: "betinget visning og kontekst",
      },
      { label: "Plassering på siden", note: "nederst til høyre eller venstre" },
      { label: "Hvilke svar som slettes" },
    ],
  },
  {
    x: 774,
    title: "Lumi bestemmer",
    from: 1,
    stops: [
      { label: "Utseendet", note: "fra Aksel" },
      { label: "Faste tekster", note: "som «Neste» og «Tilbake»" },
      { label: "Maskering", note: "og sletting etter 12 måneder" },
      {
        label: "Varselet under fritekst",
        note: "om personopplysninger, skal vises",
      },
    ],
  },
  {
    x: 1310,
    title: "Går ikke eller er ikke lov",
    not: true,
    from: 2,
    stops: [
      { label: "Endre uten ny appversjon", note: "surveyen ligger i koden" },
      {
        label: "Rekruttere til brukertester",
        note: "ikke lov etter bruksvilkårene",
      },
      {
        label: "Be om personopplysninger",
        note: "ikke lov etter bruksvilkårene",
      },
    ],
  },
];

function stopY(index: number): number {
  return TOP + SPACING * index;
}

function StyrerDere() {
  return (
    <div className="slide">
      <h2 className="slide-title">
        Dere bestemmer innholdet. Lumi setter rammene.
      </h2>
      <LineMap label="Tre linjer. Dere bestemmer spørsmålene og tekstene, når surveyen vises, hvem som får hvilke spørsmål, plasseringen og hvilke svar som slettes. Lumi bestemmer utseendet fra Aksel, faste tekster, maskering og sletting etter 12 måneder, og varselet om personopplysninger, som skal vises. Det som ikke går eller ikke er lov: endre uten ny appversjon, fordi surveyen ligger i koden, og rekruttere til brukertester eller be om personopplysninger, som ikke er lov etter bruksvilkårene.">
        {COLUMNS.map((column) => (
          <g key={column.title} data-from={column.from}>
            <MapText x={column.x - 38} y={TOP - 72} size={44} weight={800}>
              {column.title}
            </MapText>
            <Line
              points={[
                [column.x, TOP],
                [column.x, stopY(column.stops.length - 1)],
              ]}
              dashed={column.not}
              dim={column.not}
            />
            {column.stops.map((stop, i) => (
              <Station
                key={stop.label}
                x={column.x}
                y={stopY(i)}
                label={stop.label}
                note={stop.note}
                dim={column.not}
              />
            ))}
          </g>
        ))}
      </LineMap>
    </div>
  );
}

export const styrerDere: Slide = {
  id: "styrer-dere",
  title: "Dere bestemmer innholdet. Lumi setter rammene.",
  steps: 2,
  notes: `Dere bestemmer: spørsmålene og tekstene i Surveyverksted. Når surveyen vises, bestemmer appen i koden: når siden lastes, etter en fullført oppgave eller som knappen «Gi tilbakemelding». Betinget visning og kontekst avgjør hvem som får spørsmålene. Plassering nederst til høyre eller venstre. Dere sletter svar i dashboardet.

Klikk 1, Lumi bestemmer: utseendet følger Aksel. Faste tekster som «Neste», «Tilbake» og «(valgfritt)» kan dere ikke endre. Lumi API maskerer kjente mønstre og sletter svar etter 12 måneder. Varselet om personopplysninger skal vises.

Klikk 2, går ikke eller er ikke lov: endre teksten uten ny versjon av appen, rekruttere til brukertester, be om personopplysninger. Bruksvilkårene forbyr også undersøkelser rettet mot brukere med skjermingskode.`,
  Component: StyrerDere,
};
