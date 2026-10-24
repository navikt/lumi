import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { Slide, SlideProps } from "../../../engine";
import scene from "./scene.svg?raw";
import "./snokula.css";

/*
 * Snøkula. Nav is a snow globe: inside the glass Nav keeps watch, outside
 * is the weather. With Lumi the answer stays in the globe. A tool from a
 * vendor needs a hole in the glass: its script comes in, and the answer
 * goes out into the storm, towards the vendor in the fog. The drawing is
 * scene.svg, shared by two slides. Each shows the world, plus the parts
 * marked with its own `data-scene`.
 */

type Scene = 1 | 2;

const markup = new Map<Scene, string>();

/** The drawing for one slide: what both share, and what is its own. */
function markupFor(which: Scene): string {
  const cached = markup.get(which);
  if (cached !== undefined) return cached;
  const doc = new DOMParser().parseFromString(scene, "image/svg+xml");
  for (const element of doc.querySelectorAll(
    `[data-scene]:not([data-scene="${which}"])`,
  )) {
    element.remove();
  }
  const html = doc.documentElement.innerHTML;
  markup.set(which, html);
  return html;
}

/** Ids of one instance: the overview and the print view show a slide twice. */
function withIds(html: string, suffix: string): string {
  return html
    .replace(/id="([^"]+)"/g, `id="$1-${suffix}"`)
    .replace(/url\(#([^)]+)\)/g, `url(#$1-${suffix})`);
}

interface SnokulaProps extends SlideProps {
  scene: Scene;
  label: string;
  children: ReactNode;
}

function Snokula({
  scene: which,
  step,
  active,
  label,
  children,
}: SnokulaProps) {
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const html = useMemo(
    () => withIds(markupFor(which), suffix),
    [which, suffix],
  );

  // Entered at the first step, the entrance plays. Entered from the slide
  // after, at the last step, the globe is simply there.
  const [entre, setEntre] = useState(false);
  useLayoutEffect(() => {
    if (!active) setEntre(false);
    else if (step === 0) setEntre(true);
  }, [active, step]);

  return (
    <div className="slide">
      <div
        className="snokula"
        data-scene={which}
        data-entre={entre ? "" : undefined}
      >
        <svg
          className="snokula__scene"
          viewBox="0 0 1920 1080"
          role="img"
          aria-label={label}
        >
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own drawing, scene.svg beside this file */}
          <g dangerouslySetInnerHTML={{ __html: html }} />
        </svg>
        {children}
      </div>
    </div>
  );
}

function InneINav({ step, active }: SlideProps) {
  return (
    <Snokula
      scene={1}
      step={step}
      active={active}
      label="En snøkule på en sokkel der det står Nav. Inne i kula er det stille snøvær, og der står appen, appens backend og Lumi. Utenfor glasset er det storm med regn, vind og lyn. Lengst til høyre ligger en tåkebanke, og et skilt der det står Leverandøren peker inn i tåka. Med Lumi hopper svaret fra appen over appens backend og inn i Lumi, uten å gå ut av kula. Med et verktøy fra en leverandør må det lages et hull i glasset, med et rør gjennom. Skriptet fra leverandøren kommer inn gjennom røret og blir i appen. Svaret går ut gjennom det samme røret, slår opp en paraply, og vinden tar det med inn i tåka der leverandøren er."
    >
      {step >= 3 ? (
        <h2 key="svar" className="snokula__tittel snokula__tittel--ny">
          Med Lumi blir svaret
          <br />
          der Nav passer på
        </h2>
      ) : (
        <h2 key="start" className="snokula__tittel">
          Inne i Nav passer
          <br />
          Nav selv på
        </h2>
      )}
    </Snokula>
  );
}

export const inneINav: Slide = {
  id: "inne-i-nav",
  title: "Inne i Nav passer Nav selv på",
  steps: 3,
  notes: `Beskriv bildet først, ordrett: «Snøkula er Nav. Inne i kula står appen, appens backend og Lumi. Utenfor glasset er det storm, og langt ute i tåka står leverandøren.»

Faggruppa, inn: «Mange team i Nav bruker eksterne verktøy for å spørre brukerne. Lumi gjør det på en annen måte. Følg den gule.»

Frontend forum, ordrett: «Da svarer jeg på spørsmålet fra starten. Vi sammenlignet ikke funksjonene. Det som avgjorde, var at svaret skulle bli i Nav.»

Klikk 1, Lumi: «Med Lumi hopper svaret fra appen, via appens backend, inn i Lumi. Det går aldri ut av kula.» Widgeten er en npm-pakke som bygges inn i appen, i en låst versjon.

Klikk 2, et eksternt verktøy: «Skal appen bruke et verktøy fra en leverandør, må vi lage et hull i glasset. Skriptet kommer inn, og appen henter det på nytt ved hver sidevisning. Svaret går ut samme vei.» Så: «Ute er det vær. Det betyr ikke at leverandøren er dårlig. Men utenfor kula kan ikke Nav passe på selv, og veien ut er én ting til å passe på.»

Klikk 3, ordrett: «Med Lumi blir svaret der Nav passer på.» Så: «Vi i eSyfo valgte å holde svaret i Nav. Andre team har valgt eksterne verktøy, og det kan være riktig for dem.»

Ler noen av snøkula: «Ja, Nav lever i en boble. Her er det en fordel.»

Frontend forum: Lumi trenger ingen ny kilde i CSP. Svaret går gjennom appens egen backend, og surveyen ligger i appens kode.

Hvis noen spør om samtykke: Lumi-widgeten leser samtykket fra dekoratøren selv. Uten samtykke til surveyer starter den minimert, og den husker ikke at brukeren har lukket den.

Hvis noen spør om Google Cloud: «Lumi kjører i prod-gcp, Nais-klyngen i Google Cloud. Google er allerede leverandør for Nais.»`,
  Component: InneINav,
};

function Fagsystemene({ step, active }: SlideProps) {
  return (
    <Snokula
      scene={2}
      step={step}
      active={active}
      label="Samme snøkule, nærmere. Inne i Nav står en mindre snøkule, og på sokkelen står det Fagsystemer. Der inne sitter en saksbehandler ved en skjerm med appen. Den lille kula har en dør ut mot appens backend. Et verktøy fra en leverandør trenger et eget rør ut gjennom begge glassene: svaret går fra skjermen gjennom røret, slår opp paraplyen i stormen og forsvinner inn i tåka. Med Lumi går svaret ut gjennom døra appen allerede har, over appens backend og inn i Lumi, inne i den store kula."
    >
      <h2 className="snokula__tittel">
        I fagsystemene trenger
        <br />
        Lumi ingen ny åpning ut
      </h2>
      <p className="snokula__merk">Gjelder apper med backend i prod-gcp</p>
    </Snokula>
  );
}

export const fagsystemene: Slide = {
  id: "fagsystemene",
  title: "I fagsystemene trenger Lumi ingen ny åpning ut",
  steps: 2,
  notes: `Kameraet går inn i kula av seg selv. Beskriv, ordrett: «Inne i Nav står en mindre kule: fagsystemene. Der sitter saksbehandleren. Den lille kula har sitt eget glass, og en dør til appens backend.»

Klikk 1: «Et eksternt verktøy trenger et rør ut gjennom begge glassene.» Flere fagsystemer har en slik åpning i dag.

Klikk 2: «Med Lumi går svaret gjennom døra appen allerede har, til appens backend og inn i Lumi. Det blir inne i Nav.»

Faggruppa, ordrett: «Skal noen publisere surveyer uten utvikler, er eksterne verktøy laget for det.»

Det gjelder apper med backend i prod-gcp, og det står under tittelen. Fagsystemer med backend i prod-fss må avklare med oss først, for Lumi API tar bare imot kall fra prod-gcp.`,
  Component: Fagsystemene,
};
