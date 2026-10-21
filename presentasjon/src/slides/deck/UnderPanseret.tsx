import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import { Line, LineMap, MapText, Station } from "../../map";
import "./avslutning.css";

/** The transport from «Konfigurer surveyen», shortened. Ten lines. */
const TRANSPORT = [
  "const transport: LumiSurveyTransport = {",
  "  async submit({ transportPayload }) {",
  '    const response = await fetch("/api/lumi/feedback", {',
  '      method: "POST",',
  '      headers: { "Content-Type": "application/json" },',
  "      body: JSON.stringify(transportPayload),",
  "    });",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: the code is shown on the slide, not run
  "    if (!response.ok) throw new Error(`Status ${response.status}`);",
  "  },",
  "};",
].join("\n");

// Strings and template literals, then punctuation.
const TOKEN = /("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|([{}()[\];,:=!.])/g;

/** Light highlighting, in the code colours from theme.css. */
function highlight(code: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of code.matchAll(TOKEN)) {
    const start = match.index;
    if (start > cursor) nodes.push(code.slice(cursor, start));
    const [text, quoted] = match;
    nodes.push(
      <span key={start} className={quoted ? "code-string" : "code-punctuation"}>
        {text}
      </span>,
    );
    cursor = start + text.length;
  }
  if (cursor < code.length) nodes.push(code.slice(cursor));
  return nodes;
}

// The code block: 32 px Overpass Mono is 20 px per character, and every
// line is 40 px. These place the mark under the URL in the third line.
const CODE_TOP = 328;
const CODE_BOTTOM = 788;
const CODE_TEXT_X = 112 + 6 + 24;
const CHAR = 20.015;
const LINE = 40;
// The backend line sits low enough for the «Lumi API» label to fit between
// the code and the two endpoints.
const BACKEND: readonly [number, number] = [152, 900];
const FORK_X = 580;
const END_X = 720;
const TOKENX_Y = BACKEND[1];
const AZURE_Y = BACKEND[1] + 100;
/** Where the station labels start: the ring and the label gap. */
const ENDPOINT_TEXT_X = END_X + 22 + 28;
/** The margin notes start level with the top of the code block. */
const ASIDE_TOP = 330;

function UnderPanseret() {
  return (
    <div className="slide">
      <h2 className="slide-title">Widgeten gjør ingen nettverkskall selv</h2>

      <LineMap label="Transporten appen skriver, sender svaret til appens egen backend. Backenden veksler token og sender svaret videre til Lumi API: med TokenX til POST /api/tokenx/v1/feedback for apper for sluttbrukere, eller med Entra ID OBO til POST /api/azure/v1/feedback for interne apper.">
        <g data-from={1}>
          <Line
            points={[
              [BACKEND[0], CODE_BOTTOM - 8],
              [BACKEND[0], BACKEND[1]],
              [END_X, BACKEND[1]],
            ]}
            radius={0}
          />
          <Line
            points={[
              [FORK_X, BACKEND[1]],
              [FORK_X + 100, AZURE_Y],
              [END_X, AZURE_Y],
            ]}
            radius={36}
          />
          <Station x={BACKEND[0]} y={BACKEND[1]} />
          <MapText x={ENDPOINT_TEXT_X} y={TOKENX_Y - 65} weight={700}>
            Lumi API
          </MapText>
          <Station
            x={END_X}
            y={TOKENX_Y}
            label="POST /api/tokenx/v1/feedback"
            note="TokenX: apper for sluttbrukere"
            mono
            className="under-panseret__endpoint"
          />
          <Station
            x={END_X}
            y={AZURE_Y}
            label="POST /api/azure/v1/feedback"
            note="Entra ID OBO: interne apper"
            mono
            className="under-panseret__endpoint"
          />
        </g>
      </LineMap>

      <pre className="under-panseret__code">
        <code>{highlight(TRANSPORT)}</code>
      </pre>
      <span
        className="under-panseret__call"
        data-from={1}
        style={{
          left: CODE_TEXT_X + 33 * CHAR,
          width: 20 * CHAR,
          top: CODE_TOP + 6 + 24 + 2 * LINE + 36,
        }}
      />

      <div
        className="end-at"
        data-from={1}
        style={{ left: 112, top: BACKEND[1] + 50 }}
      >
        <p className="end-label">Appens backend</p>
        <p className="end-note">veksler token og sender til Lumi API</p>
      </div>

      {/* Margin notes right of the code, stacked from its top edge. */}
      <div className="end-at under-panseret__aside" style={{ top: ASIDE_TOP }}>
        <p className="end-label">
          Appen skriver
          <br />
          <code>transport</code> selv.
        </p>
        <p className="end-label" data-from={2}>
          <code>"use client"</code>
          <br />i Next.js
        </p>
        <div data-from={2}>
          <p className="end-label">ca. 32 KB</p>
          <p className="end-note">
            minifisert og
            <br />
            gzippet, uten
            <br />
            React og Aksel
          </p>
        </div>
      </div>
    </div>
  );
}

export const underPanseret: Slide = {
  id: "under-panseret",
  title: "Widgeten gjør ingen nettverkskall selv",
  rooms: ["frontend"],
  steps: 2,
  notes: `Surveyen er bygd inn i appen. Widgeten kaller transport.submit, og det er appen som sender.

Klikk 1: Backenden veksler token og sender videre. TokenX for apper for sluttbrukere, Entra ID OBO for interne apper som Modia.

Klikk 2: I Next.js App Router legger dere til "use client" selv. 32 KB er uten React og Aksel, som appen har fra før.

Telleren teller fetch, XHR og sendBeacon fra sliden ble åpnet.

Lumi trenger ingen ny kilde i CSP.

Oppsettet vi dokumenterer, krever innlogget bruker, fordi backenden veksler brukerens token. Lumi API sjekker hvilken app som sender.

Er Lumi API nede, vises surveyen likevel. Send gir «Kunne ikke sende tilbakemeldingen. Prøv igjen senere.»`,
  Component: UnderPanseret,
};
