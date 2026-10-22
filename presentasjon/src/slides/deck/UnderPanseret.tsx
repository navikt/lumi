import type { ReactNode } from "react";
import type { Slide } from "../../engine";
import "./avslutning.css";

/** Punctuation and strings, in the code colours from theme.css. */
function P({ children }: { children: ReactNode }) {
  return <span className="code-punctuation">{children}</span>;
}

function S({ children }: { children: ReactNode }) {
  return <span className="code-string">{children}</span>;
}

/**
 * A part of the code line, marked from a build step, with a pointer that
 * hangs down to a short label under the window.
 */
function Marked({
  children,
  label,
  note,
  from,
}: {
  children: ReactNode;
  label: string;
  note: string;
  from: number;
}) {
  return (
    <span className="under-panseret__target">
      {children}
      <span className="under-panseret__pointer" data-from={from}>
        <span className="under-panseret__label">{label}</span>
        <span className="under-panseret__note">{note}</span>
      </span>
    </span>
  );
}

function UnderPanseret() {
  return (
    <div className="slide">
      <h2 className="slide-title under-panseret__title">
        Widgeten sender svaret bare til appens egen backend
      </h2>

      {/* The editor window bleeds off the right edge: one line matters. */}
      <pre className="under-panseret__code">
        <code>
          transport<P>{"={{"}</P>{" "}
          <Marked label="Samme domene" note="POST med JSON" from={1}>
            endpoint
          </Marked>
          <P>:</P>{" "}
          <Marked
            label="Appens backend"
            note="veksler token og sender svaret til Lumi API"
            from={1}
          >
            <S>"/api/lumi/feedback"</S>
          </Marked>{" "}
          <P>{"}}"}</P>
        </code>
      </pre>

      <div className="end-at under-panseret__client" data-from={2}>
        <p className="end-label">
          <code>@navikt/lumi-survey/client</code>
        </p>
        <p className="end-note">
          inngangen med <code>"use client"</code> for serverkomponenter i
          Next.js
        </p>
      </div>
    </div>
  );
}

export const underPanseret: Slide = {
  id: "under-panseret",
  title: "Widgeten sender svaret bare til appens egen backend",
  rooms: ["frontend"],
  steps: 2,
  notes: `Fra start: «Fra versjon 2.5.0 sender widgeten svaret selv. Dere gir den én linje: stien til et endepunkt i appens egen backend.» Widgeten sender en POST med JSON dit, og bare et ekte 2xx-svar regnes som sendt.

Klikk 1: Widgeten godtar bare en sti på samme domene som siden. Står det et annet domene der, viser den ingen survey og skriver en [Lumi]-feil i konsollen. Backenden veksler token og sender svaret videre til Lumi API: TokenX for apper for sluttbrukere, Entra ID OBO for interne apper som Modia.

Klikk 2: I Next.js App Router importerer dere widgeten fra @navikt/lumi-survey/client. Den har "use client", så en serverkomponent kan vise widgeten med transport={{ endpoint }}.

Hvis noen spør:
Fra 2.4.0 venter widgeten høyst ti sekunder per forsøk og prøver én gang til ved 503, og ved 429 når Retry-After er fem sekunder eller mindre. Lumi API lagrer et svar bare én gang, også om det kommer to ganger.
Trenger backenden egne headere, kan dere fortsatt skrive en egen transport med submit.
Lumi trenger ingen ny kilde i CSP.
Pakken er rundt 34 KB minifisert og gzippet, uten React og Aksel, som appen har fra før.
Oppsettet vi dokumenterer, krever innlogget bruker, fordi backenden veksler brukerens token. Lumi API sjekker hvilken app som sender.
Er Lumi API nede, vises surveyen likevel. Send gir «Kunne ikke sende tilbakemeldingen. Prøv igjen senere.»
Telleren på svar-meg står på null fordi presentasjonen gir widgeten en egen transport som holder svaret i nettleseren.`,
  Component: UnderPanseret,
};
