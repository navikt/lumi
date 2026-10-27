import film from "../../assets/video/verksted-utkast.mp4";
import poster from "../../assets/video/verksted-utkast.webp";
import { SlideVideo } from "../../components/SlideVideo";
import { Tag } from "../../components/Tag";
import type { Slide } from "../../engine";
import "./verksted.css";

/**
 * A silent recording of the mock Surveyverksted (light theme), 1680×672: the
 * team picks a setup, names the draft, writes the question, sees the real
 * widget in the preview and shares a version with the developer. The room
 * has not heard of Surveyverksted, so the name is the largest thing in the
 * title, after what you do there in the team's green.
 */
function SammeUtkast() {
  return (
    <div className="slide verksted-film verksted-film--bottom">
      <h2 className="verksted-film__title">
        <span className="verksted-film__hva">Dere lager surveyen i</span>{" "}
        <span className="verksted-film__navn">Surveyverksted</span>
      </h2>
      <div className="verksted-film__window">
        <SlideVideo
          src={film}
          poster={poster}
          width={1680}
          height={672}
          label="Opptak fra Surveyverksted med testdata. Under «Hva vil dere finne ut?» står «Hvordan opplevde brukeren tjenesten?». Utkastet får navnet Dagen så langt, og Surveyverksted foreslår survey-ID-en dagen-sa-langt. I utkastet skrives spørsmålet om til «Hvordan har dagen vært så langt?», og forhåndsvisningen viser det i widgeten med smilefjes. Så deles versjon 1 med utvikleren, og versjonssiden har knappen Kopier TypeScript."
        />
      </div>
      <Tag kind="film" className="verksted-film__tag" />
    </div>
  );
}

export const sammeUtkast: Slide = {
  id: "samme-utkast",
  title: "Dere lager surveyen i Surveyverksted",
  Component: SammeUtkast,
};
