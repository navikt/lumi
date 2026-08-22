import {
  Alert,
  BodyLong,
  BodyShort,
  Box,
  Button,
  CopyButton,
  Detail,
  Heading,
  HGrid,
  HStack,
  Loader,
  Tag,
  VStack,
} from "@navikt/ds-react";
import {
  LumiSurveyDock,
  type LumiSurveyTransport,
  type SurveyDocumentV1,
} from "@navikt/lumi-survey";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "~/components/shared/Header";
import {
  fetchReleaseVerificationConfigServerFn,
  submitReleaseVerificationServerFn,
} from "~/server/actions";
import {
  canStartReleaseVerificationRun,
  createReleaseVerificationSurveyId,
} from "~/utils/releaseVerification";

const verificationSurvey: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "release-check",
      questions: [
        {
          id: "rating",
          type: "rating",
          variant: "emoji",
          prompt: "Hvordan oppleves denne verifikasjonskjøringen?",
          required: true,
        },
        {
          id: "trace",
          type: "text",
          prompt: "Legg inn en kort sporingsmerknad",
          description: "Skriv noe du enkelt kjenner igjen i dashboardet.",
          required: true,
          maxLength: 160,
        },
      ],
    },
  ],
  success: {
    title: "Signal lagret",
    body: "Kontroller nå at det samme svaret er synlig i dashboardet.",
  },
};

type AttemptState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success"; id: string; duplicate: boolean }
  | { status: "error"; message: string };

export const Route = createFileRoute("/release-verification")({
  component: ReleaseVerificationPage,
});

function ReleaseVerificationPage() {
  const configQuery = useQuery({
    queryKey: ["release-verification-config"],
    queryFn: () => fetchReleaseVerificationConfigServerFn(),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptState>({ status: "idle" });

  useEffect(() => {
    if (configQuery.data?.surveyId && !surveyId) {
      setSurveyId(configQuery.data.surveyId);
    }
  }, [configQuery.data?.surveyId, surveyId]);

  const transport = useMemo<LumiSurveyTransport>(
    () => ({
      submit: async (submission) => {
        setAttempt({ status: "sending" });
        try {
          const receipt = await submitReleaseVerificationServerFn({
            data: submission.transportPayload,
          });
          setAttempt({ status: "success", ...receipt });
        } catch (error) {
          setAttempt({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Ukjent feil under innsending",
          });
          throw error;
        }
      },
    }),
    [],
  );

  const startNewRun = () => {
    if (!canStartReleaseVerificationRun(attempt.status)) return;
    setSurveyId(createReleaseVerificationSurveyId());
    setAttempt({ status: "idle" });
  };

  return (
    <>
      <Header />
      <Box
        as="main"
        paddingBlock={{ xs: "space-16", md: "space-32" }}
        paddingInline={{ xs: "space-12", sm: "space-16" }}
        className="main-container"
      >
        <VStack gap="space-24">
          <HStack gap="space-12" align="center" wrap>
            <Tag variant="warning" size="small">
              Kun dev
            </Tag>
            <Detail>Release flight check</Detail>
          </HStack>

          <VStack gap="space-8">
            <Heading size="xlarge">Bevis kjeden før utrulling</Heading>
            <BodyLong size="large">
              Denne siden sender en ekte v2-innsending til Lumi API. I dev går
              den gjennom dashboardets eksisterende Azure OBO-flyt; den lokale
              fullkjedetesten bruker eksplisitt auth-bypass. Hver kjøring får en
              ny, syntetisk survey-ID og påvirker ingen survey som er i bruk.
            </BodyLong>
          </VStack>

          {configQuery.isPending ? (
            <HStack gap="space-12" align="center">
              <Loader size="medium" title="Sjekker miljø" />
              <BodyShort>Sjekker om verifikasjonsriggen er aktiv …</BodyShort>
            </HStack>
          ) : configQuery.isError ? (
            <Alert variant="error">
              Kunne ikke kontrollere miljøet. Last siden på nytt eller sjekk
              dashboard-loggene.
            </Alert>
          ) : !configQuery.data.enabled ? (
            <Alert variant="info">
              Verifikasjonsriggen er avslått her. Den er bare aktiv mot ekte
              backend i dev-gcp eller i den eksplisitte lokale
              fullkjede-konfigurasjonen.
            </Alert>
          ) : surveyId ? (
            <>
              <HGrid columns={{ xs: 1, md: 3 }} gap="space-16">
                <VerificationStage
                  step="01"
                  title="Widget"
                  detail="SurveyDocumentV1 fra release-build"
                />
                <VerificationStage
                  step="02"
                  title="Identitet"
                  detail={
                    configQuery.data.authMode === "azure-obo"
                      ? "Azure OBO som lumi-dashboard"
                      : "Eksplisitt lokal auth-bypass"
                  }
                />
                <VerificationStage
                  step="03"
                  title="Rundtur"
                  detail="API → Postgres → dashboard"
                />
              </HGrid>

              <Box
                background="neutral-soft"
                borderWidth="1"
                borderColor="neutral-subtle"
                borderRadius="12"
                padding={{ xs: "space-16", md: "space-24" }}
              >
                <VStack gap="space-16">
                  <HStack justify="space-between" align="center" wrap>
                    <VStack gap="space-4">
                      <Detail>SYNTETISK SURVEY-ID</Detail>
                      <BodyShort weight="semibold">{surveyId}</BodyShort>
                    </VStack>
                    <HStack gap="space-8">
                      <CopyButton copyText={surveyId} size="small" />
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={startNewRun}
                        disabled={
                          !canStartReleaseVerificationRun(attempt.status)
                        }
                      >
                        Ny test-ID
                      </Button>
                    </HStack>
                  </HStack>

                  {attempt.status === "sending" ? (
                    <Alert variant="info">
                      Sender gjennom ekte dev-kjede …
                    </Alert>
                  ) : attempt.status === "success" ? (
                    <Alert variant="success">
                      API-et bekreftet{" "}
                      {attempt.duplicate ? "en retry" : "ny lagring"}
                      {` med id ${attempt.id}.`} Åpne dashboardet og finn
                      sporingsmerknaden før testen godkjennes.
                    </Alert>
                  ) : attempt.status === "error" ? (
                    <Alert variant="error">
                      Innsendingen feilet: {attempt.message}
                    </Alert>
                  ) : (
                    <Alert variant="warning">
                      Åpne widgeten nederst til høyre, fyll ut begge feltene og
                      send inn.
                    </Alert>
                  )}

                  {attempt.status === "success" &&
                  configQuery.data.dashboardTeam &&
                  configQuery.data.dashboardApp ? (
                    <Link
                      to="/feedback"
                      search={{
                        team: configQuery.data.dashboardTeam,
                        app: configQuery.data.dashboardApp,
                        surveyId,
                        dateMode: "auto",
                      }}
                    >
                      <Button variant="primary">
                        Kontroller i dashboardet
                      </Button>
                    </Link>
                  ) : null}
                </VStack>
              </Box>

              <LumiSurveyDock
                key={surveyId}
                surveyId={surveyId}
                survey={verificationSurvey}
                transport={transport}
                context={{
                  tags: {
                    purpose: "release-verification",
                    channel: configQuery.data.authMode ?? "unknown",
                  },
                }}
                behavior={{
                  initialOpen: true,
                  hideAfterSubmit: false,
                  storageStrategy: "none",
                  showProgress: true,
                }}
              />
            </>
          ) : null}
        </VStack>
      </Box>
    </>
  );
}

function VerificationStage({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail: string;
}) {
  return (
    <Box
      background="raised"
      borderWidth="1"
      borderColor="neutral-subtle"
      borderRadius="8"
      padding="space-16"
    >
      <VStack gap="space-4">
        <Detail>{step}</Detail>
        <Heading level="2" size="small">
          {title}
        </Heading>
        <BodyShort size="small">{detail}</BodyShort>
      </VStack>
    </Box>
  );
}
