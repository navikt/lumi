import film from "../../assets/video/verksted-utkast.mp4";
import poster from "../../assets/video/verksted-utkast.webp";
import { SlideVideo } from "../../components/SlideVideo";
import type { Slide } from "../../engine";
import { RouteProgress } from "./RouteProgress";
import "./verksted.css";

/**
 * A silent recording of the mock Surveyverksted (dark theme), 1680×672: the
 * team picks a setup, names the draft, writes the question, sees the real
 * widget in the preview and shares a version with the developer.
 */
function SammeUtkast() {
  return (
    <div className="slide verksted-film verksted-film--bottom">
      <h2 className="verksted-film__title">
        Teamet lager surveyen i Surveyverksted
      </h2>
      <div className="verksted-film__window">
        <SlideVideo
          src={film}
          poster={poster}
          width={1680}
          height={672}
          label="Opptak fra Surveyverksted med testdata. Under «Hva vil dere finne ut?» står «Hvordan opplevde brukeren tjenesten?». Utkastet får navnet Dagen så langt, og Surveyverksted foreslår survey-ID-en dagen-sa-langt. I utkastet skrives spørsmålet om til «Hvordan har dagen vært så langt?», og forhåndsvisningen viser det i den ekte widgeten med smilefjes. Så deles versjon 1 med utvikleren, og versjonssiden har knappen Kopier TypeScript."
        />
      </div>
      <p className="verksted-film__note">
        Opptak fra Surveyverksted med testdata.
      </p>
      <RouteProgress at={0} />
    </div>
  );
}

export const sammeUtkast: Slide = {
  id: "samme-utkast",
  title: "Teamet lager surveyen i Surveyverksted",
  notes: `Filmen går av seg selv i rundt 25 sekunder. Snakk over den:
Under «Hva vil dere finne ut?» velger teamet et oppsett. Her er det vurderingen.
Utkastet får et navn, og Surveyverksted foreslår survey-ID-en.
Teamet skriver spørsmålet: «Hvordan har dagen vært så langt?» Det er spørsmålet dere svarte på i stad.
Forhåndsvisningen viser den ekte widgeten. Den sender ingen svar.
«Del med utvikler» lager versjon 1 med egen lenke. Utvikleren kopierer TypeScript-koden derfra.

Spør salen: «Hvem kan åpne utkastet?» Svar: alle i teamet i Nais Console. Designere, produktfolk og utviklere jobber i samme utkast, og det lagres for teamet.

Når og hvor surveyen vises, bestemmer appen: teamet velger siden, og widgeten kan starte som en liten knapp.`,
  Component: SammeUtkast,
};
