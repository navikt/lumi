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
  Component: UnderPanseret,
};
