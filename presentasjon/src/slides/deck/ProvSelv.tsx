import { QrCode } from "../../components/QrCode";
import { Tag } from "../../components/Tag";
import { TRIAL_URL } from "../../content/salen";
import type { Slide } from "../../engine";
import "./avslutning.css";

/** The link as people type it: no scheme. */
const TRIAL_TEXT = TRIAL_URL.replace(/^https:\/\//, "");

// 41 modules with the quiet zone (version 4), 18 px each. The quiet zone
// reaches into the margin, so the dark modules line up with the title.
const MODULE = 18;
const QR_SIZE = 41 * MODULE;
const QUIET_ZONE = 4 * MODULE;
// Below the title, so the quiet zone stays clear of it.
const MODULES_TOP = 272;
const MODULES_SIZE = 33 * MODULE;

function ProvSelv() {
  return (
    <div className="slide">
      <h2 className="slide-title">Prøv selv</h2>
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
          left: 112 + MODULES_SIZE + 96,
          top: MODULES_TOP,
          height: MODULES_SIZE,
        }}
      >
        <Tag kind="live" />
        <p className="slide-lead prov-selv__lead">
          Svaret ditt forlater ikke telefonen.
        </p>
        <p className="prov-selv__link">{TRIAL_TEXT}</p>
      </div>
    </div>
  );
}

export const provSelv: Slide = {
  id: "prov-selv",
  title: "Prøv selv",
  rooms: ["frontend", "produktledere"],
  notes: `Ta fram mobilen, også dere på Teams.

Telefonen viser det som ville blitt sendt. Widgeten er den samme som i appene, men svaret blir på telefonen.`,
  Component: ProvSelv,
};
