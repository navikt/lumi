import { QrCode } from "../../components/QrCode";
import { TRIAL_URL } from "../../content/salen";
import type { Slide } from "../../engine";
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

function ProvSelv() {
  return (
    <div className="slide">
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
  notes: `Ta fram mobilen, også dere på Teams. Skann koden, eller skriv adressen.

Siden har den samme widgeten som appene bruker. Når dere trykker Send, viser telefonen det appen ville fått, og hva Lumi API ville lagret. Siden sender ingenting til noen server.

Frontend forum: i en ekte app er jobben pnpm add @navikt/lumi-survey og én komponent med transport={{ endpoint }}. Pakken ligger på npmjs, så dere trenger verken .npmrc eller GitHub-token. Har appen ikke Aksel 8 eller nyere, legger dere til @navikt/ds-react og @navikt/ds-css også. Produktlederakademiet får ikke pnpm-linja på sliden.

La koden stå mens folk spør.`,
  Component: ProvSelv,
};
