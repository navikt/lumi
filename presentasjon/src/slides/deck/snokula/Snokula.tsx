import {
  type CSSProperties,
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Slide, SlideProps } from "../../../engine";
import { cx } from "../../../engine/css";
import scene from "./scene.svg?raw";
import "./snokula.css";

/*
 * Snøkula. Nav is a snow globe: inside the glass Nav keeps watch, outside
 * is the weather. A tool from a vendor needs a hole in the glass: its
 * script comes in, and the answer goes out into the storm, towards the
 * vendor in the fog. With Lumi the answer stays in the globe, in the core
 * of the crystal from Lumi's logo.
 *
 * The drawing is scene.svg. The opening shows the whole world (scene 1),
 * the fagsystem slide goes in close (scene 2), and the chapter slides look
 * at one place in it (scene k). Each shows what all share, plus the parts
 * whose `data-scene` names it.
 */

type Scene = "1" | "2" | "k";

const markup = new Map<Scene, string>();

/** The drawing for one scene: what all share, and what is its own. */
function markupFor(which: Scene): string {
  const cached = markup.get(which);
  if (cached !== undefined) return cached;
  const doc = new DOMParser().parseFromString(scene, "image/svg+xml");
  for (const element of doc.querySelectorAll(
    `[data-scene]:not([data-scene~="${which}"])`,
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
  /** Where a chapter slide looks: a CSS transform of the world. */
  kamera?: string;
  children: ReactNode;
}

function Snokula({
  scene: which,
  step,
  active,
  label,
  kamera,
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
        data-steg={step}
        data-entre={entre ? "" : undefined}
        style={kamera ? ({ "--kamera": kamera } as CSSProperties) : undefined}
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

/**
 * The opening and the cover. Step 0: Lumi's name beside the globe, and it
 * snows. 1: the camera pulls back to the storm and the vendor. 2: the hole,
 * the script in and the answer out. 3: an answer jumps into Lumi, and the
 * snow settles. 4: the claim.
 */
function Apning({ step, active }: SlideProps) {
  return (
    <Snokula
      scene="1"
      step={step}
      active={active}
      label="En snøkule på en sokkel der det står Nav. Inne i kula snør det, og der står appen, appens backend og Lumi, tegnet som krystallen fra logoen. Utenfor glasset er det storm med regn, vind og lyn. Lengst til høyre ligger en tåkebanke, og et skilt der det står Eksterne verktøy peker inn i tåka. Nede i stormen titter et troll opp av og til. Med et verktøy fra en leverandør må det lages et hull i glasset, med et rør gjennom. Skriptet fra leverandøren kommer inn gjennom røret og blir i appen. Svaret går ut gjennom det samme røret, slår opp en paraply, og vinden tar det med inn i tåka. Med Lumi hopper svaret fra appen over appens backend og inn i kjernen av krystallen. Da slutter det å snø."
    >
      <div
        className={cx(
          "snokula__forside",
          step > 0 && "snokula__forside--borte",
        )}
      >
        <h1 className="snokula__navn">Lumi</h1>
        <p className="snokula__hva">
          Surveyer der svaret
          <br />
          blir i Nav
        </p>
        <p className="snokula__hvem">Audun Sørheim, Team eSyfo</p>
      </div>
      {step >= 4 && (
        <h2 className="snokula__tittel snokula__tittel--ny">
          Med Lumi blir svaret i Nav
        </h2>
      )}
    </Snokula>
  );
}

export const apning: Slide = {
  id: "lumi",
  title: "Lumi: surveyer der svaret blir i Nav",
  steps: 4,
  Component: Apning,
};

function Fagsystemene({ step, active }: SlideProps) {
  return (
    <Snokula
      scene="2"
      step={step}
      active={active}
      label="Samme snøkule, nærmere. Inne i Nav står en mindre snøkule, og på sokkelen står det Fagsystemer. Der inne sitter en saksbehandler ved en skjerm med appen. Den lille kula har en dør ut mot appens backend. Et verktøy fra en leverandør trenger et eget rør ut gjennom begge glassene: svaret går fra skjermen gjennom røret, slår opp paraplyen i stormen og forsvinner inn i tåka. Med Lumi går svaret ut gjennom døra appen allerede har, over appens backend og inn i krystallen, inne i den store kula."
    >
      <h2 className="snokula__tittel">
        Også i fagsystemene
        <br />
        blir svaret i Nav
      </h2>
    </Snokula>
  );
}

export const fagsystemene: Slide = {
  id: "fagsystemene",
  title: "Også i fagsystemene blir svaret i Nav",
  rooms: ["faggruppa"],
  steps: 2,
  Component: Fagsystemene,
};

/** A chapter: the globe, seen from one place in it, and the chapter's name. */
function kapittel(
  id: string,
  title: string,
  kamera: string,
  label: string,
): Slide {
  function Kapittel({ step, active }: SlideProps) {
    return (
      <Snokula
        scene="k"
        step={step}
        active={active}
        kamera={kamera}
        label={label}
      >
        <h2 className="snokula__kapittel">{title}</h2>
      </Snokula>
    );
  }
  return { id, title, Component: Kapittel };
}

export const kapittelHvaErLumi = kapittel(
  "kapittel-lumi",
  "Hva er Lumi?",
  "translate(-52px, -1503px) scale(2.6)",
  "Nærbilde av krystallen inne i snøkula. I kjernen sitter et svar, en gul skive med øyne.",
);

export const kapittelHvaKanDereGjore = kapittel(
  "kapittel-muligheter",
  "Det dere bestemmer selv",
  "translate(-1825px, -1810px) scale(3)",
  "Nærbilde av appens hus inne i snøkula. I vinduet sitter widgeten.",
);

export const kapittelKomIGang = kapittel(
  "kapittel-kom-i-gang",
  "Slik kommer dere i gang",
  "translate(620px, 160px) scale(0.72)",
  "Hele snøkula, litt på avstand, med stormen rundt.",
);

/**
 * The globe as a picture, for the front page: the chapter scene, whole and
 * without the weather, with the answer in Lumi's core. It says what the
 * text beside it says, so screen readers skip it.
 */
export function SnokulaBilde() {
  const suffix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const html = useMemo(() => withIds(markupFor("k"), suffix), [suffix]);
  const svgRef = useRef<SVGSVGElement>(null);

  // As on a slide at its first step: what is shown from step 0 is shown.
  // The drawing never changes, so once is enough.
  useLayoutEffect(() => {
    const parts = svgRef.current?.querySelectorAll("[data-from]") ?? [];
    for (const element of parts) {
      element.toggleAttribute(
        "data-revealed",
        element.getAttribute("data-from") === "0",
      );
    }
  }, []);

  return (
    <div className="snokula snokula--bilde" data-scene="k">
      <svg
        ref={svgRef}
        className="snokula__bilde"
        viewBox="328 168 944 952"
        aria-hidden="true"
      >
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own drawing, scene.svg beside this file */}
        <g dangerouslySetInnerHTML={{ __html: html }} />
      </svg>
    </div>
  );
}
