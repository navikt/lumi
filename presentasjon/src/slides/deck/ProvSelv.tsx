import { QrCode } from "../../components/QrCode";
import { TRIAL_URL } from "../../content/salen";
import type { Slide, SlideProps } from "../../engine";
import { useBuildMotion } from "./bevisMotion";
import "./avslutning.css";

/** The link as people type it: no scheme. */
const TRIAL_TEXT = TRIAL_URL.replace(/^https:\/\//, "");

// 41 modules with the quiet zone (version 4), 16 px each: about a fifth of
// the stage. The quiet zone reaches into the margin, so the dark modules
// line up with the title.
const MODULE = 16;
const QR_SIZE = 41 * MODULE;
const QUIET_ZONE = 4 * MODULE;
const MODULES_TOP = 340;
const MODULES_SIZE = 33 * MODULE;

/*
 * The QR code is the slide. The corners of a camera's viewfinder stand
 * outside the code, clear of the quiet zone, and close on it when the slide
 * comes on: point the phone here.
 */
const OUTSIDE = 40;
const FRAME = QR_SIZE + 2 * OUTSIDE;

/** Four corners, 22 px outside the code, with arms 88 px long. */
function viewfinder(size: number): string {
  const a = 18;
  const b = size - 18;
  const arm = 88;
  return [
    `M${a} ${a + arm} V${a} H${a + arm}`,
    `M${b - arm} ${a} H${b} V${a + arm}`,
    `M${b} ${b - arm} V${b} H${b - arm}`,
    `M${a + arm} ${b} H${a} V${b - arm}`,
  ].join(" ");
}

function ProvSelv({ step, active }: SlideProps) {
  const motion = useBuildMotion(step, active);
  return (
    <div className="slide prov-selv" data-motion={motion ? "" : undefined}>
      <h2 className="slide-title">Dere kan prøve widgeten nå</h2>
      <div
        className="end-at prov-selv__qr"
        style={{ left: 112 - QUIET_ZONE, top: MODULES_TOP - QUIET_ZONE }}
      >
        <QrCode
          text={TRIAL_URL}
          size={QR_SIZE}
          label={`QR-kode til prøvesiden, ${TRIAL_TEXT}`}
        />
        <svg
          className="prov-selv__sikte"
          viewBox={`0 0 ${FRAME} ${FRAME}`}
          aria-hidden="true"
        >
          <path d={viewfinder(FRAME)} />
        </svg>
      </div>
      <div
        className="end-at prov-selv__text"
        style={{
          left: 112 + MODULES_SIZE + 128,
          top: MODULES_TOP,
          height: MODULES_SIZE,
        }}
      >
        <p className="prov-selv__lead">
          Siden viser det appen ville fått,
          <br />
          og sender ingenting.
        </p>
        <p className="prov-selv__link">{TRIAL_TEXT}</p>
        {/* For developers: what it takes in a real app. Not for product leads. */}
        <p className="prov-selv__install">
          <span className="prov-selv__install-label">I appen deres:</span>
          <code>pnpm add @navikt/lumi-survey</code>
        </p>
      </div>
    </div>
  );
}

export const provSelv: Slide = {
  id: "prov-selv",
  title: "Dere kan prøve widgeten nå",
  rooms: ["frontend", "produktledere"],
  Component: ProvSelv,
};
