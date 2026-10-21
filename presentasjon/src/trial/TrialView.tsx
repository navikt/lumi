import {
  LumiSurveyDock,
  type LumiSurveyTransport,
  type LumiSurveyTransportPayload,
} from "@navikt/lumi-survey";
import { useMemo, useState } from "react";
import { PayloadSummary } from "../components/PayloadSummary";
import { PayloadView } from "../components/PayloadView";
import { useNetworkCalls } from "../components/useNetworkCalls";
import { SALEN_SURVEY } from "../content/salen";
import "./trial.css";

const BEHAVIOR = {
  initialOpen: true,
  hideAfterSubmit: false,
  storageStrategy: "none",
} as const;

/**
 * The phone page (`?prov`): the real widget in the real viewport, with a
 * transport that keeps the answer on the page.
 */
export function TrialView() {
  const [payload, setPayload] = useState<LumiSurveyTransportPayload | null>(
    null,
  );
  const networkCalls = useNetworkCalls(true);
  const transport = useMemo<LumiSurveyTransport>(
    () => ({
      submit: async (submission) => setPayload(submission.transportPayload),
    }),
    [],
  );

  return (
    <main className="trial">
      <h1 className="trial__title">Svaret ditt forlater ikke telefonen</h1>
      <p className="trial__lead">
        Widgeten nederst er den samme som team i Nav bruker. Her blir svaret
        liggende på siden og sendes ikke til noen server. I en ekte app går
        svaret til appens egen backend.
      </p>
      <p className="trial__meter">
        Nettverkskall fra siden: <strong>{networkCalls}</strong>
      </p>
      {payload ? (
        <>
          <PayloadSummary payload={payload} className="trial__payload" />
          <details className="trial__details">
            <summary>Vis alt appen ville fått</summary>
            <PayloadView payload={payload} caption="Hele payloaden" />
          </details>
        </>
      ) : (
        <p className="trial__empty">Svar i widgeten og trykk Send.</p>
      )}
      <p className="trial__more">
        Mer om Lumi:{" "}
        <a href="https://navikt.github.io/lumi/">navikt.github.io/lumi</a>
      </p>
      <div className="trial__widget">
        <LumiSurveyDock
          surveyId="hvor-bor-svaret"
          survey={SALEN_SURVEY}
          transport={transport}
          behavior={BEHAVIOR}
        />
      </div>
    </main>
  );
}
