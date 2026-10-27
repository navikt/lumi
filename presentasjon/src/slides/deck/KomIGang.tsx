import { QrCode } from "../../components/QrCode";
import type { Slide, SlideProps } from "../../engine";
import { cssVars } from "../../engine/css";
import { useBuildMotion } from "./bevisMotion";
import "./avslutning.css";

/*
 * The first survey in three steps, on a line from the top down, and the
 * docs as a QR code. The three stations stand empty from the start, and
 * each click lights one in the colour of who does it: the team's green,
 * and Lumi's blue for access, the one step where the team waits, marked
 * with an hourglass. The line is dashed until the step before is done.
 * Source: «Hva er Lumi?» and «Koble til backend» in the docs.
 */

const DOCS_URL = "https://navikt.github.io/lumi/";
const DOCS_TEXT = "navikt.github.io/lumi";

const LINE_X = 184;
const STEP_Y = [360, 566, 772] as const;
const STATION_R = 56;

const STEPS = [
  {
    label: "Lag et utkast i Surveyverksted",
    note: "Alle på teamet i Nais Console kan.",
    tone: "team",
  },
  {
    label: "Be om tilgang for appen",
    note: "En PR eller en issue i navikt/lumi.",
    tone: "lumi",
    waits: true,
  },
  {
    label: "Legg widgeten inn i appen",
    note: "Utvikleren følger dokumentasjonen.",
    tone: "team",
  },
] as const;

/** The code: 400 px, top right, ending well above the Teams corner. */
const QR = { left: 1300, top: 236, size: 400 } as const;

/** Waiting: an hourglass, in Lumi's blue. */
function Timeglass() {
  return (
    <svg
      className="kom-i-gang__timeglass"
      viewBox="0 0 40 56"
      aria-hidden="true"
    >
      <path
        d="M5 4 H35 M5 52 H35 M10 4 C10 18 18 22 18 28 C18 34 10 38 10 52 M30 4 C30 18 22 22 22 28 C22 34 30 38 30 52"
        className="kom-i-gang__glass"
      />
      <path d="M13 50 Q20 39 27 50 Z M15 12 H25 L20 19 Z" />
    </svg>
  );
}

function KomIGang({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div className="slide kom-i-gang" data-motion={motion ? "" : undefined}>
      <h2 className="slide-title kom-i-gang__tittel">
        Tre steg til den første surveyen
      </h2>
      <svg
        className="kom-i-gang__linje"
        viewBox="0 0 1920 1080"
        aria-hidden="true"
      >
        {/* Planned: the whole way, dashed, under the line that is built. */}
        <path
          d={`M${LINE_X} ${STEP_Y[0]} V${STEP_Y[2]}`}
          className="kom-i-gang__planlagt"
        />
        {[1, 2].map((i) => (
          <path
            key={i}
            d={`M${LINE_X} ${STEP_Y[i - 1]} V${STEP_Y[i]}`}
            pathLength={1}
            className="kom-i-gang__bygd"
            data-from={i + 1}
          />
        ))}
        {STEPS.map((s, i) => (
          <g
            key={s.label}
            className={`kom-i-gang__stasjon kom-i-gang__stasjon--${s.tone}`}
          >
            <circle
              cx={LINE_X}
              cy={STEP_Y[i]}
              r={STATION_R}
              className="kom-i-gang__tom"
            />
            <text
              x={LINE_X}
              y={STEP_Y[i] + 4}
              textAnchor="middle"
              dominantBaseline="middle"
              className="kom-i-gang__tall-tom"
            >
              {i + 1}
            </text>
            <g className="kom-i-gang__tent" data-from={i + 1}>
              <circle cx={LINE_X} cy={STEP_Y[i]} r={STATION_R} />
              <text
                x={LINE_X}
                y={STEP_Y[i] + 4}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {i + 1}
              </text>
            </g>
          </g>
        ))}
      </svg>
      <ol className="kom-i-gang__steg">
        {STEPS.map((s, i) => (
          <li
            key={s.label}
            className={`kom-i-gang__punkt kom-i-gang__punkt--${s.tone}`}
            style={cssVars({ "--y": `${STEP_Y[i]}px` })}
            data-from={i + 1}
          >
            <span className="kom-i-gang__navn">
              {s.label}
              {"waits" in s && <Timeglass />}
            </span>
            <span className="kom-i-gang__note">{s.note}</span>
          </li>
        ))}
      </ol>
      <div
        className="end-at kom-i-gang__qr"
        style={{ left: QR.left, top: QR.top, width: QR.size }}
      >
        <div className="kom-i-gang__kode">
          <QrCode
            text={DOCS_URL}
            size={QR.size}
            label={`QR-kode til dokumentasjonen, ${DOCS_TEXT}`}
          />
          <svg
            className="kom-i-gang__sikte"
            viewBox="-40 -40 480 480"
            aria-hidden="true"
          >
            <path d="M-26 46 V-26 H46 M354 -26 H426 V46 M426 354 V426 H354 M46 426 H-26 V354" />
          </svg>
        </div>
        <p className="kom-i-gang__lenke">{DOCS_TEXT}</p>
        <p className="kom-i-gang__slack">Spørsmål: #lumi på Slack</p>
      </div>
    </div>
  );
}

export const komIGang: Slide = {
  id: "kom-i-gang",
  title: "Tre steg til den første surveyen",
  steps: 3,
  Component: KomIGang,
};
