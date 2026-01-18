import { Button } from "@navikt/ds-react";
import { useCallback, useEffect, useState } from "react";
import {
  LumiSurveyDock,
  type LumiSurveyDockProps,
} from "../components/LumiSurveyDock";
import { removeConsentValue } from "../components/shared/consentStorage.js";
import { SurveyCodePreview } from "./SurveyCodePreview";

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

export const ExamplePage = (props: LumiSurveyDockProps) => {
  const [resetToken, setResetToken] = useState(0);
  const [hasConsent, setHasConsent] = useState(() => {
    const stored = localStorage.getItem("__lumi_survey_storybook_consent__");
    return stored === null ? true : stored === "true";
  });

  const handleReset = useCallback(() => {
    void (async () => {
      await removeConsentValue(`flexjar-dismissed-${props.surveyId}`);
      setResetToken((token) => token + 1);
    })();
  }, [props.surveyId]);

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
    <div
      style={{
        minHeight: "120vh",
        padding: "var(--ax-space-48)",
        background: "var(--ax-bg-neutral-soft)",
        color: "var(--ax-text-neutral)",
      }}
    >
      <div
        style={{
          maxWidth: "640px",
          display: "grid",
          gap: "var(--ax-space-16)",
        }}
      >
        <h2 style={{ margin: 0 }}>Designflate</h2>
        <p style={{ margin: 0 }}>
          Scroll litt for å se at docken holder seg i hjørnet. Bruk knappene
          under for å teste ulike scenarier.
        </p>
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
            title="Survey-konfigurasjon"
            defaultCollapsed={false}
          />
        )}
      </div>
      <LumiSurveyDock key={resetToken} {...props} />
    </div>
  );
};
