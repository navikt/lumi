import { Button } from "@navikt/ds-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LumiSurveyDock,
  type LumiSurveyDockProps,
} from "../components/LumiSurveyDock";
import { removeConsentValue } from "../components/shared/consentStorage.js";
import type { LumiSurveySubmission } from "../core/types.js";
import "./LumiSurveyDockExamplePage.css";
import { CodePreview, SurveyCodePreview } from "./SurveyCodePreview";

// Type for the Storybook mock consent API
interface LumiMockConsentApi {
  setConsent: (granted: boolean) => void;
  getConsent: () => boolean;
}

declare global {
  interface Window {
    __LUMI_SURVEY_MOCK_CONSENT__?: LumiMockConsentApi;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const SUCCESS_TRANSPORT: LumiSurveyDockProps["transport"] = {
  async submit(submission) {
    await delay(800);
    console.info("Simulert innsending", submission);
  },
};

interface ExamplePageProps extends LumiSurveyDockProps {
  sourceCode?: string;
}

interface ExampleStoryInfo {
  name: string;
  description: string;
}

export const ExampleStoryInfoContext = createContext<ExampleStoryInfo>({
  name: "Lumi-eksempellab",
  description: "Utforsk konfigurasjonen og test hele surveyflyten.",
});

export const ExamplePage = ({ sourceCode, ...props }: ExamplePageProps) => {
  const storyInfo = useContext(ExampleStoryInfoContext);
  const [resetToken, setResetToken] = useState(0);
  const [lastSubmission, setLastSubmission] = useState<LumiSurveySubmission>();
  const [hasConsent, setHasConsent] = useState(() => {
    const stored = localStorage.getItem("__lumi_survey_storybook_consent__");
    return stored === null ? true : stored === "true";
  });

  const handleReset = useCallback(() => {
    void (async () => {
      await removeConsentValue(`lumi-dismissed-${props.surveyId}`);
      setLastSubmission(undefined);
      setResetToken((token) => token + 1);
    })();
  }, [props.surveyId]);

  const previewTransport = useMemo<LumiSurveyDockProps["transport"]>(
    () => ({
      async submit(submission) {
        await props.transport.submit(submission);
        setLastSubmission(submission);
      },
    }),
    [props.transport],
  );

  const currentDocument = "authoringSchemaVersion" in props.survey;

  const handleGrantConsent = useCallback(() => {
    const mockAPI = window.__LUMI_SURVEY_MOCK_CONSENT__;
    if (mockAPI) {
      mockAPI.setConsent(true);
      setHasConsent(true);
    }
  }, []);

  const handleRevokeConsent = useCallback(() => {
    const mockAPI = window.__LUMI_SURVEY_MOCK_CONSENT__;
    if (mockAPI) {
      mockAPI.setConsent(false);
      setHasConsent(false);
    }
  }, []);

  useEffect(() => {
    // Listen for consent changes from controls
    const handleConsentChange = () => {
      const stored = localStorage.getItem("__lumi_survey_storybook_consent__");
      setHasConsent(stored === null ? true : stored === "true");
    };

    window.addEventListener(
      "__lumi_survey_consent_change__",
      handleConsentChange,
    );
    return () =>
      window.removeEventListener(
        "__lumi_survey_consent_change__",
        handleConsentChange,
      );
  }, []);

  return (
    <div className="lumi-storybook-example-page">
      <div className="lumi-storybook-example-page__content">
        <div
          style={{
            display: "grid",
            gap: "var(--ax-space-8)",
            paddingBottom: "var(--ax-space-8)",
            borderBottom: "1px solid var(--ax-border-neutral-subtle)",
          }}
        >
          <span
            style={{
              width: "fit-content",
              padding: "2px var(--ax-space-8)",
              borderRadius: "var(--ax-radius-full)",
              background: currentDocument
                ? "var(--ax-bg-success-soft)"
                : "var(--ax-bg-warning-soft)",
              color: "var(--ax-text-neutral)",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            {currentDocument ? "Anbefalt modell" : "Kompatibilitet i 2.x"}
          </span>
          <h2 style={{ margin: 0 }}>{storyInfo.name}</h2>
          <p style={{ margin: 0 }}>{storyInfo.description}</p>
          <p style={{ margin: 0, color: "var(--ax-text-neutral-subtle)" }}>
            {currentDocument
              ? "Test flyten og send inn for å se submission.transportPayload – schemaVersion 2-payloaden integrasjonen skal videresende."
              : "Dette eksempelet viser eldre questions[]-konfigurasjon. Bruk SurveyDocumentV1 for nye surveyer."}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: "var(--ax-space-8)",
            flexWrap: "wrap",
          }}
        >
          <Button size="small" variant="secondary" onClick={handleReset}>
            Nullstill docken
          </Button>
          <Button
            size="small"
            variant={hasConsent ? "secondary" : "primary"}
            onClick={handleGrantConsent}
            disabled={hasConsent}
          >
            Gi samtykke
          </Button>
          <Button
            size="small"
            data-color={hasConsent ? "danger" : undefined}
            variant={!hasConsent ? "secondary" : "primary"}
            onClick={handleRevokeConsent}
            disabled={!hasConsent}
          >
            Fjern samtykke
          </Button>
        </div>
        <div
          style={{
            padding: "var(--ax-space-16)",
            background: hasConsent
              ? "var(--ax-bg-success-soft)"
              : "var(--ax-bg-warning-soft)",
            borderRadius: "var(--ax-radius-4)",
          }}
        >
          <strong>Samtykke status:</strong>{" "}
          {hasConsent ? "Gitt ✓" : "Ikke gitt ✗"}
          <p style={{ margin: "var(--ax-space-8) 0 0", fontSize: "0.875rem" }}>
            {hasConsent
              ? "Docken kan bruke localStorage til å huske at den ble lukket."
              : "Docken vises fortsatt, men kan ikke huske at den ble lukket (ingen localStorage-persistering)."}
          </p>
        </div>
        <div
          style={{
            padding: "var(--ax-space-16)",
            background: "var(--ax-bg-info-soft)",
            borderRadius: "var(--ax-radius-4)",
            fontSize: "0.875rem",
          }}
        >
          <strong>Tips for testing:</strong>
          <ul
            style={{
              margin: "var(--ax-space-8) 0 0",
              paddingLeft: "var(--ax-space-24)",
            }}
          >
            <li>
              Med <code>hideAfterSubmit=true</code> (standard): Docken
              forsvinner helt etter innsending
            </li>
            <li>
              Bruk "Nullstill docken" for å vise den igjen etter innsending
            </li>
            <li>
              Uten samtykke: localStorage fungerer ikke, men docken vises
              fortsatt
            </li>
          </ul>
        </div>

        {props.survey && (
          <SurveyCodePreview
            survey={props.survey}
            context={props.context}
            behavior={props.behavior}
            sourceCode={sourceCode}
            defaultCollapsed={false}
          />
        )}
        {lastSubmission && (
          <CodePreview
            code={JSON.stringify(lastSubmission.transportPayload, null, 2)}
            title="Siste innsending"
            badge="schemaVersion 2"
            note="Dette er den kanoniske transport-payloaden. authoringSchemaVersion 1 og schemaVersion 2 versjonerer to forskjellige kontrakter."
            tone="payload"
          />
        )}
      </div>
      <LumiSurveyDock
        key={resetToken}
        {...props}
        transport={previewTransport}
      />
    </div>
  );
};
