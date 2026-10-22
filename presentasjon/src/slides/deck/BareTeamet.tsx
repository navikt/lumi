import film from "../../assets/video/dashboard-svaret.mp4";
import poster from "../../assets/video/dashboard-svaret.webp";
import { SlideVideo } from "../../components/SlideVideo";
import type { Slide } from "../../engine";
import "./verksted.css";

/**
 * A silent recording of the mock dashboard (dark theme, test data), 1680×760:
 * the team picks the survey, filters on a rating and opens the answer from
 * the room. The window is the film at its own size, so the UI text is about
 * 28 px on the stage, and it ends 40 px above the Teams corner.
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
        Dere ser bare svarene til teamet deres
      </h2>
      <p className="verksted-film__note">
        Tilgangen følger teamet i Nais Console. Opptaket viser testdata.
      </p>
    </div>
  );
}

export const bareTeamet: Slide = {
  id: "bare-teamet",
  title: "Dere ser bare svarene til teamet deres",
  notes: `Inn: «Hvem får lese svaret? Bare teamet deres.»

Filmen går av seg selv i rundt 20 sekunder. Snakk over den:
Teamet velger surveyen og ser kortene, med antall svar og snittet.
Et klikk på vurderingen 1 filtrerer hele dashboardet.
Tilbakemeldingene har samme filter. Øverst ligger svaret med teksten fra i stad.
Svaret er åpnet. E-postadressen er fjernet, navnet står igjen, og svaret er merket Redigert.

Opptaket er fra dashboardet med testdata. Svaret fra salen er satt inn med samme tekst, så tallene er ikke deres.

Tilgang: Lumi spør Nais Console hvilke team dere er med i. Endringer i medlemskap virker innen ti minutter. Et annet team får beskjed om at det ikke har tilgang.

Hvert svar har en sletteknapp, så teamet kan slette svar med personopplysninger. Lumi lagrer ikke hvem som svarte, heller ikke Nav-identen. I små grupper kan app, tidspunkt, enhet og det som står i svaret, likevel røpe hvem som svarte. Lederen til den som svarte, ser ikke svarene i Lumi, med mindre hen er med i teamet i Nais Console.

Svarene kan lastes ned som CSV, Excel og JSON fra dashboardet.`,
  Component: BareTeamet,
};
