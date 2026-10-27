import film from "../../assets/video/dashboard-svaret.mp4";
import poster from "../../assets/video/dashboard-svaret.webp";
import { SlideVideo } from "../../components/SlideVideo";
import { Tag } from "../../components/Tag";
import type { Slide } from "../../engine";
import "./verksted.css";

/**
 * A silent recording of the mock dashboard (light theme, test data), 1680×760:
 * the team picks the survey, filters on a rating and opens an answer. The
 * window is the film at its own size, so the UI text is about 28 px on the
 * stage, and it ends 40 px above the Teams corner. Who sees the answers is
 * the claim, so «bare teamet deres» is in the team's green.
 */
function BareTeamet() {
  return (
    <div className="slide verksted-film verksted-film--top">
      <div className="verksted-film__window">
        <SlideVideo
          src={film}
          poster={poster}
          width={1680}
          height={760}
          label="Opptak fra dashboardet med testdata. Teamet velger surveyen survey-vurdering, og kortene viser 67 tilbakemeldinger og et snitt på 3,5. Et klikk på vurderingen 1 filtrerer hele dashboardet til 12 svar. Tilbakemeldingene har samme filter, og øverst ligger svaret «Fant ikke planen. Send svar til Ola Nordmann, [E-POST FJERNET]», merket Redigert. Svaret åpnes."
        />
      </div>
      <h2 className="verksted-film__title">
        I dashboardet ser{" "}
        <span className="verksted-film__team">bare teamet deres</span> svarene
      </h2>
      <div className="verksted-film__fot">
        <p className="verksted-film__note">
          Tilgangen følger teamet i Nais Console.
        </p>
        <Tag kind="film" />
      </div>
    </div>
  );
}

export const bareTeamet: Slide = {
  id: "bare-teamet",
  title: "I dashboardet ser bare teamet deres svarene",
  Component: BareTeamet,
};
