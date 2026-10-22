import type { Slide, SlideProps } from "../../engine";
import { cx } from "../../engine/css";
import { AppBox, Line, LineMap, MapText, Station, Zone } from "../../map";
import { Reise } from "./KartReise";
import "./deck.css";

const TOP = 196;
/** The zones end 46 px above the Teams corner, with their labels. */
const HEIGHT = 628;
const ZONE_WIDTH = 592;
const BROWSER_X = 72;
const NAIS_X = BROWSER_X + ZONE_WIDTH;
const VENDOR_X = NAIS_X + ZONE_WIDTH;

const SKYRA_APP_Y = 330;
const LUMI_APP_Y = 520;
const APP_X = 112;
const APP_WIDTH = 512;
const APP_HEIGHT = 96;
const APP_RIGHT = APP_X + APP_WIDTH;
/** Under each app, flush with its badge: when the survey code is fetched. */
const BADGE_RIGHT = APP_RIGHT - 16;
const FETCH_GAP = 40;
/** The script comes in here, and the answer leaves here. */
const SCRIPT_X = 400;
const ANSWER_X = 520;
/** Labels on the two lines, each on its own side, as station labels are. */
const LINE_LABEL_Y = 250;
const LINE_LABEL_GAP = 28;
/** Appens backend, on the Lumi line. */
const BACKEND = [760, LUMI_APP_Y + 48] as const;

function Note({
  x,
  y,
  children,
  anchor = "start",
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "end";
}) {
  return (
    <MapText x={x} y={y} anchor={anchor} size={32} weight={600} muted>
      {children}
    </MapText>
  );
}

function HvorBorSvaret({ step }: SlideProps) {
  const concluded = step >= 3;
  return (
    <div className="slide">
      <LineMap label="Tre soner: brukerens nettleser, Navs plattform Nais og Skyra AS. Med Skyra henter nettleseren skriptet fra survey.skyra.no ved hver sidevisning. Svaret går fra nettleseren til Skyras server og lagres hos Skyra AS, hos Scaleway i EU. Skyra AS er databehandler for Nav. Med Lumi hentes widgeten når appen bygges, i en låst versjon. Svaret går fra nettleseren til appens backend, som har samme adresse som appen, videre til Lumi API og databasen på Nais.">
        <Zone
          x={BROWSER_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="neutral"
          label="Brukerens nettleser"
        />
        <Zone
          x={NAIS_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="nais"
          label="Navs plattform (Nais)"
          labelAt="top"
        />
        <Zone
          x={VENDOR_X}
          y={TOP}
          width={ZONE_WIDTH}
          height={HEIGHT}
          tone="neutral"
          label="Skyra AS"
          note="databehandler for Nav"
        />

        <AppBox
          x={APP_X}
          y={SKYRA_APP_Y}
          width={APP_WIDTH}
          part="Skyra-skript"
          partWidth={236}
        />
        <AppBox
          x={APP_X}
          y={LUMI_APP_Y}
          width={APP_WIDTH}
          part="Lumi-widget"
          partWidth={220}
        />

        {/* Click 1, Skyra: the script comes in, then the answer goes out over Nav's zone. */}
        <g className="kart-skript">
          <Line
            points={[
              [1440, 330],
              [1440, 96],
              [SCRIPT_X, 96],
              [SCRIPT_X, SKYRA_APP_Y],
            ]}
            radius={56}
            arrow
            draw
            from={1}
          />
        </g>
        <g data-from={1}>
          <Station x={1440} y={330} label="survey.skyra.no" mono side="right" />
          <Note x={SCRIPT_X - LINE_LABEL_GAP} y={LINE_LABEL_Y} anchor="end">
            skriptet
          </Note>
          <Note x={ANSWER_X + LINE_LABEL_GAP} y={LINE_LABEL_Y}>
            svaret
          </Note>
          <Note
            x={BADGE_RIGHT}
            y={SKYRA_APP_Y + APP_HEIGHT + FETCH_GAP}
            anchor="end"
          >
            hentes ved hver sidevisning
          </Note>
        </g>
        <Reise
          points={[
            [ANSWER_X, SKYRA_APP_Y],
            [ANSWER_X, 150],
            [1360, 150],
            [1360, 640],
          ]}
          radius={56}
          from={1}
          start={700}
          duration={1300}
        >
          <Station x={1360} y={500} label="Skyras server" side="right" />
          <Station
            x={1360}
            y={640}
            r={36}
            label="Lagres hos Skyra AS"
            note="Scaleway i EU"
            className="map-station--label-only"
          />
        </Reise>

        {/* Click 2, Lumi: the answer goes the way the app's own data goes. */}
        <Reise
          points={[
            [APP_RIGHT, BACKEND[1]],
            [BACKEND[0], BACKEND[1]],
            [BACKEND[0], 768],
          ]}
          radius={18}
          from={2}
          duration={900}
        >
          <Station
            x={BACKEND[0]}
            y={BACKEND[1]}
            label="Appens backend"
            note="samme adresse som appen"
          />
          <Station x={760} y={668} label="Lumi API" />
          <Station
            x={760}
            y={768}
            r={36}
            label="Databasen"
            className="map-station--label-only"
          />
        </Reise>
        <g data-from={2}>
          <Note
            x={BADGE_RIGHT}
            y={LUMI_APP_Y + APP_HEIGHT + FETCH_GAP}
            anchor="end"
          >
            hentes ved bygg, låst versjon
          </Note>
        </g>
      </LineMap>

      <h2
        key={concluded ? "svar" : "sporsmal"}
        className={cx(
          "slide-maptitle hvor__title",
          concluded && "hvor__title--svar",
        )}
      >
        {concluded ? (
          <>
            Begge brukes i Nav.
            <br />
            Forskjellen er hvor svaret bor.
          </>
        ) : (
          "Hvor bor svaret?"
        )}
      </h2>
    </div>
  );
}

export const hvorBorSvaret: Slide = {
  id: "hvor-bor-svaret",
  title: "Hvor bor svaret?",
  steps: 3,
  notes: `Beskriv bare veiene.

Først, beskriv kartet: «Tre soner: til venstre brukerens nettleser, i midten Navs plattform Nais, til høyre Skyra AS. Følg den gule prikken. Der den stopper, bor svaret.»

Faggruppa, inn: «Flere av dere kjenner Skyra, som brukes på nav.no og i flere fagsystemer. Skyra og Lumi brukes begge i Nav. Nå skal dere se hvor svaret går i hver av dem.»

Frontend forum, ordrett: «Da svarer jeg på spørsmålet fra starten. Nei, vi sammenlignet ikke funksjonene. Det som avgjorde, var hvor svaret skulle bo.»

Klikk 1, Skyra: «Skriptet er Skyras kode. Nettleseren henter det fra Skyra ved hver sidevisning.» Så går svaret rett fra nettleseren til Skyra AS og lagres i EU. Skyra AS er databehandler for Nav, og Skyra kan også blokkere fødselsnummer, telefonnummer og e-post i fritekst.

Klikk 2, Lumi: «Widgeten er en npm-pakke. Den hentes når appen bygges, i en låst versjon.» Svaret går via appens backend til Lumi API og databasen. Lumi legger ikke til en ny leverandør.

Klikk 3: «Begge brukes i Nav. Forskjellen er hvor svaret bor.» Så: «Vi i eSyfo valgte Nais, der appenes egne data ligger. Andre team har valgt Skyra.» FlexJar bor på samme sted som Lumi.

Frontend forum: Lumi trenger ingen ny kilde i CSP. Svaret går gjennom appens egen backend, og surveyen ligger i appens kode.

Hvis noen spør om samtykke: på nav.no henter dekoratøren Skyras skript først etter samtykke. I Modia er skriptet en vanlig script-tag. Lumi-widgeten leser samtykket fra dekoratøren selv. Uten samtykke til surveyer starter den minimert, og den husker ikke at brukeren har lukket den.

Hvis noen spør om Google Cloud: «Lumi kjører i prod-gcp, Nais-klyngen i Google Cloud. Google er allerede leverandør for Nais.»`,
  Component: HvorBorSvaret,
};
