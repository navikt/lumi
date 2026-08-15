import { Button, Heading, Select, Tag } from "@navikt/ds-react";
import {
  LumiSurveyDock,
  type LumiSurveySubmission,
  type LumiSurveyTransport,
} from "@navikt/lumi-survey";
import { useMemo, useState } from "react";

import { demoScenarios } from "./scenarios";

const DASHBOARD_URL = "http://localhost:3000/feedback";

type SubmissionState =
  | { status: "idle" }
  | { status: "sending"; surveyId: string }
  | { status: "success"; surveyId: string; submittedAt: string }
  | { status: "error"; surveyId: string; message: string };

export function App() {
  const [scenarioId, setScenarioId] = useState(demoScenarios[0].id);
  const [submission, setSubmission] = useState<SubmissionState>({
    status: "idle",
  });
  const scenario =
    demoScenarios.find((candidate) => candidate.id === scenarioId) ??
    demoScenarios[0];
  const surveyId = `local-demo-${scenario.id}`;

  const transport = useMemo<LumiSurveyTransport>(
    () => ({
      submit: async (result: LumiSurveySubmission) => {
        setSubmission({ status: "sending", surveyId: result.surveyId });
        const response = await fetch("/api/azure/v1/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.transportPayload),
        });

        if (!response.ok) {
          const details = await response.text();
          const message = details || `HTTP ${response.status}`;
          setSubmission({
            status: "error",
            surveyId: result.surveyId,
            message,
          });
          throw new Error(message);
        }

        setSubmission({
          status: "success",
          surveyId: result.surveyId,
          submittedAt: result.submittedAt,
        });
      },
    }),
    [],
  );

  const dashboardHref = `${DASHBOARD_URL}?team=local-dev&surveyId=${encodeURIComponent(surveyId)}`;

  return (
    <main className="testBench">
      <header className="masthead">
        <div>
          <p className="eyebrow">LUMI / LOCAL SIGNAL LAB</p>
          <Heading level="1" size="xlarge">
            Full-chain testbenk
          </Heading>
          <p className="lede">
            Send ekte widgetdata gjennom proxy, API og Postgres. Kontroller
            resultatet i dashboardet uten mock-data.
          </p>
        </div>
        <div className="liveBadge">
          <span aria-hidden="true" /> lokal kjede
        </div>
      </header>

      <section className="controlGrid" aria-labelledby="scenario-heading">
        <div className="controlPanel">
          <p className="panelIndex">01 / TESTSIGNAL</p>
          <Heading id="scenario-heading" level="2" size="large">
            Velg scenario
          </Heading>
          <Select
            label="Survey- og feltvariant"
            value={scenario.id}
            onChange={(event) => {
              setScenarioId(event.target.value);
              setSubmission({ status: "idle" });
            }}
          >
            {demoScenarios.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </Select>

          <div className="scenarioReadout">
            <p>{scenario.summary}</p>
            <div className="tagRow">
              {scenario.coverage.map((item) => (
                <Tag key={item} size="small" variant="outline">
                  {item}
                </Tag>
              ))}
            </div>
          </div>

          <dl className="routeMap">
            <div>
              <dt>Survey ID</dt>
              <dd>{surveyId}</dd>
            </div>
            <div>
              <dt>Rute</dt>
              <dd>widget → proxy → API → DB</dd>
            </div>
          </dl>
        </div>

        <div className="signalPanel" aria-live="polite">
          <p className="panelIndex">02 / KVITTERING</p>
          <Heading level="2" size="large">
            {submission.status === "success"
              ? "Signal lagret"
              : submission.status === "error"
                ? "Signal avvist"
                : submission.status === "sending"
                  ? "Sender signal"
                  : "Klar for innsending"}
          </Heading>
          <p className={`statusCopy status-${submission.status}`}>
            {submission.status === "success" &&
              `${submission.surveyId} ble lagret ${new Date(submission.submittedAt).toLocaleTimeString("nb-NO")}.`}
            {submission.status === "error" && submission.message}
            {submission.status === "sending" &&
              `Sender ${submission.surveyId} gjennom hele kjeden …`}
            {submission.status === "idle" &&
              "Widgeten åpner nederst til høyre. Fullfør skjemaet for å sende et ekte datasett."}
          </p>
          <Button as="a" href={dashboardHref} target="_blank" rel="noreferrer">
            Åpne resultat i dashboard
          </Button>
        </div>
      </section>

      <section className="matrix" aria-labelledby="matrix-heading">
        <div>
          <p className="panelIndex">03 / DEKNINGSMATRISE</p>
          <Heading id="matrix-heading" level="2" size="medium">
            {demoScenarios.length} stabile definisjoner
          </Heading>
        </div>
        <ol>
          {demoScenarios.map((candidate, index) => (
            <li key={candidate.id} data-active={candidate.id === scenario.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <button type="button" onClick={() => setScenarioId(candidate.id)}>
                {candidate.title}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <LumiSurveyDock
        key={surveyId}
        surveyId={surveyId}
        survey={scenario.survey}
        transport={transport}
        context={{
          pathname: "/local-demo",
          tags: { environment: "local-full-chain", scenario: scenario.id },
        }}
        behavior={{
          initialOpen: true,
          hideAfterSubmit: false,
          questionLayout: "auto",
          showProgress: true,
          storageStrategy: "none",
        }}
        success={{
          title: "Signalet er lagret",
          body: "Åpne dashboardet for å kontrollere hele kjeden.",
        }}
      />
    </main>
  );
}
