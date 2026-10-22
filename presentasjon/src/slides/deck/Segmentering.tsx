import film from "../../assets/video/segmentering-filter.mp4";
import poster from "../../assets/video/segmentering-filter.webp";
import { SlideVideo } from "../../components/SlideVideo";
import type { Slide, SlideProps } from "../../engine";
import "./segmentering.css";

/*
 * The app sends what it knows with the answer, as tags, and the dashboard
 * splits the answers on them.
 *
 * Step 0: the line in the app, large. Step 1: the line moves up under the
 * title, and a recording of the mock dashboard plays (dark theme, test
 * data). It is two windows on the same page, 1120 × 744 at its own size, so
 * the UI text is about 28 px on the stage: the top of the dashboard (336 px)
 * and, 40 px under it, the Segmentering card further down the page (368 px).
 * Step 2: what else an app can send, on a board beside the film.
 */

/** Shown on step 0 only. */
function onlyAtStart(step: number) {
  return {
    "data-reveal": "",
    "data-revealed": step === 0 ? "" : undefined,
  };
}

function Segmentering({ step }: SlideProps) {
  return (
    <div
      className="slide segmentering"
      data-start={step === 0 ? "" : undefined}
    >
      <h2 className="segmentering__title">
        Send med det appen vet,{" "}
        <span data-from={1}>og se svarene per gruppe</span>
      </h2>

      <p className="segmentering__kode">
        <code>
          <span className="segmentering__tegn">{"context={{ tags: { "}</span>
          <strong className="segmentering__nokkel">abTest</strong>
          <span className="segmentering__tegn">{": "}</span>
          <strong className="segmentering__verdi">"A"</strong>
          <span className="segmentering__tegn">{" } }}"}</span>
        </code>
      </p>
      <p className="segmentering__hvor" {...onlyAtStart(step)}>
        på widgeten i appen
      </p>

      <div className="segmentering__film" data-from={1}>
        <SlideVideo
          src={film}
          poster={poster}
          width={1120}
          height={744}
          playFrom={1}
          className="segmentering__video"
          label="Opptak fra dashboardet med testdata, i to utsnitt av samme side. Øverst Tilbakemeldinger 67 og Snitt vurdering 3,5. Lenger ned kortet Segmentering med Ab Test: B 34 og A 33. Et klikk på B gir filteret Ab Test: B, 34 tilbakemeldinger og snittet 3,1. Filteret fjernes, og et klikk på A gir 33 tilbakemeldinger og snittet 3,9."
        />
      </div>

      <dl className="segmentering__tavle" data-from={2}>
        <div className="segmentering__rad">
          <dt>Rolle</dt>
          <dd>
            <code>"arbeidsgiver"</code>
          </dd>
        </div>
        <div className="segmentering__rad">
          <dt>Steg</dt>
          <dd>
            <code>"kvittering"</code>
          </dd>
        </div>
        <div className="segmentering__rad">
          <dt>A/B-test</dt>
          <dd>
            <code>"A"</code> eller <code>"B"</code>
          </dd>
        </div>
        <div className="segmentering__rad segmentering__rad--selv">
          <dt>Enhet</dt>
          <dd>mobil eller PC, samler widgeten selv</dd>
        </div>
      </dl>
      <p className="segmentering__personvern" data-from={2}>
        <span>Verdier med få varianter.</span>{" "}
        <span>Aldri person- eller saksnummer.</span>
      </p>
    </div>
  );
}

export const segmentering: Slide = {
  id: "segmentering",
  title: "Send med det appen vet, og se svarene per gruppe",
  steps: 2,
  notes: `Fra start: «Appen vet ofte ting surveyen ikke trenger å spørre om. For eksempel hvilken rolle brukeren har, eller hvilken versjon av et nytt design hen så.» Det sender appen med svaret som tags, i context på widgeten. Her er det en A/B-test: brukerne som ser variant A, sender A.

Klikk 1: filmen går av seg selv i rundt 17 sekunder. Snakk over den:
Hver tag får et eget kort under Segmentering i dashboardet. Her sender appen abTest, A eller B. Det er testdata.
Alle svarene: 67, med snittet 3,5.
Klikk på B, og hele visningen viser bare svarene fra B: 34 svar og snittet 3,1.
Filteret fjernes. Klikk på A: 33 svar og snittet 3,9.
Samme survey, delt i to grupper. Forskjellen ser dere med en gang.

Klikk 2: dette kan appen sende. Dine sykmeldte sender med rollen «arbeidsgiver» og hvor surveyen vises. Steg i et løp fungerer på samme måte. Enhetstypen, altså mobil, nettbrett eller desktop, samler widgeten selv, og kortet Enheter finnes alltid.
Hold verdiene få og grove. Aldri person- eller saksnummer. Regn ikke med at konteksten er anonym.

Hvis noen spør: tags er med i eksporten. Har en tag flere enn ti ulike verdier, får den ikke noe kort. Verdier med mange varianter, som versjonsnummer, kan ligge i debug. De lagres, men vises ikke. Widgeten samler aldri inn url, og pathname bare når dere slår på collectLocation. Under Tilbakemeldinger og Eksporter ligger Segmentering i menyen Filter, med én liste per tag.`,
  Component: Segmentering,
};
