import { DownloadIcon, LinkIcon } from "@navikt/aksel-icons";
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
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Header } from "~/components/shared/Header";
import {
  fetchReleaseVerificationConfigServerFn,
  fetchReleaseVerificationRunServerFn,
  submitReleaseVerificationServerFn,
} from "~/server/actions";
import {
  canStartReleaseVerificationRun,
  createReleaseVerificationControlCode,
  createReleaseVerificationControlOptionId,
  createReleaseVerificationReport,
  createReleaseVerificationSurveyId,
  RELEASE_VERIFICATION_CONTROL_FIELD_ID,
  RELEASE_VERIFICATION_SURVEY_ID_PATTERN,
  type ReleaseVerificationCheckStatus,
  type ReleaseVerificationPhase,
  type ReleaseVerificationProbeEvidence,
  type ReleaseVerificationReportV1,
} from "~/utils/releaseVerification";

const searchSchema = z.object({
  surveyId: z.string().regex(RELEASE_VERIFICATION_SURVEY_ID_PATTERN).optional(),
  initialReceiptId: z.string().uuid().optional(),
  closingReceiptId: z.string().uuid().optional(),
});

type AttemptState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "error"; message: string };

export const Route = createFileRoute("/release-verification")({
  validateSearch: zodValidator(searchSchema),
  component: ReleaseVerificationPage,
});

function ReleaseVerificationPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const configQuery = useQuery({
    queryKey: ["release-verification-config"],
    queryFn: () => fetchReleaseVerificationConfigServerFn(),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  const [attempt, setAttempt] = useState<AttemptState>({ status: "idle" });
  const [optimisticProbes, setOptimisticProbes] = useState<{
    initial?: ReleaseVerificationProbeEvidence;
    closing?: ReleaseVerificationProbeEvidence;
  }>({});
  const [openedAt] = useState(() => new Date().toISOString());
  const [shareUrl, setShareUrl] = useState("");
  const shareKey = `${search.surveyId ?? ""}:${search.initialReceiptId ?? ""}:${search.closingReceiptId ?? ""}`;

  const config = configQuery.data;
  const surveyId = search.surveyId ?? config?.surveyId ?? null;
  const readbackInput =
    surveyId && search.initialReceiptId
      ? {
          surveyId,
          initialReceiptId: search.initialReceiptId,
          closingReceiptId: search.closingReceiptId,
        }
      : null;
  const runQuery = useQuery({
    queryKey: ["release-verification-run", readbackInput],
    queryFn: () => {
      if (!readbackInput) throw new Error("Ingen kjøring å lese tilbake");
      return fetchReleaseVerificationRunServerFn({ data: readbackInput });
    },
    enabled: Boolean(config?.enabled && readbackInput),
    refetchInterval: (query) => {
      const current = query.state.data;
      const unavailable =
        current?.initial?.status === "unavailable" ||
        current?.closing?.status === "unavailable";
      if (unavailable) return 5_000;
      return readbackInput && !search.closingReceiptId ? 30_000 : false;
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!shareKey && !globalThis.location) return;
    setShareUrl(globalThis.location?.href ?? "");
  }, [shareKey]);

  useEffect(() => {
    if (!config?.enabled || search.surveyId) return;
    void navigate({
      to: "/release-verification",
      search: { surveyId: config.surveyId },
      replace: true,
    });
  }, [config, navigate, search.surveyId]);

  const initialProbe =
    runQuery.data?.initial ?? optimisticProbes.initial ?? null;
  const closingProbe =
    runQuery.data?.closing ?? optimisticProbes.closing ?? null;
  const trustedNow =
    runQuery.data?.observedAt ?? initialProbe?.storedAt ?? openedAt;
  const report =
    config?.enabled && surveyId
      ? createReleaseVerificationReport({
          profile: config.profile,
          environment: config.environment,
          surveyId,
          now: trustedNow,
          holdDurationMs: config.holdDurationMs,
          preflight: config.preflight,
          initialProbe: initialProbe ?? undefined,
          closingProbe: closingProbe ?? undefined,
        })
      : null;
  const holdPassed =
    report?.checks.find(({ id }) => id === "hold-window")?.status === "passed";
  const closingStatus = report?.checks.find(
    ({ id }) => id === "closing-round-trip",
  )?.status;
  const earlyClosingProbe =
    closingProbe?.status === "verified" && closingStatus === "pending";
  const readbackUnavailable =
    initialProbe?.status === "unavailable" ||
    closingProbe?.status === "unavailable";
  const activePhase: ReleaseVerificationPhase | null =
    config?.enabled && config.preflight.status === "passed"
      ? !initialProbe
        ? "initial"
        : initialProbe.status === "verified" &&
            holdPassed &&
            closingStatus === "pending" &&
            (!closingProbe || earlyClosingProbe) &&
            report?.outcome !== "failed"
          ? "closing"
          : null
      : null;

  const survey = useMemo(
    () => (surveyId ? createVerificationSurvey(surveyId) : null),
    [surveyId],
  );
  const transport = useMemo<LumiSurveyTransport | null>(() => {
    if (!activePhase || !surveyId) return null;
    return {
      submit: async (submission) => {
        setAttempt({ status: "sending" });
        try {
          const evidence = await submitReleaseVerificationServerFn({
            data: submission.transportPayload,
          });
          setOptimisticProbes((current) => ({
            ...current,
            [activePhase]: evidence,
          }));
          setAttempt({ status: "idle" });
          await navigate({
            to: "/release-verification",
            search: {
              surveyId,
              initialReceiptId:
                activePhase === "initial"
                  ? evidence.receiptId
                  : search.initialReceiptId,
              closingReceiptId:
                activePhase === "closing" ? evidence.receiptId : undefined,
            },
            replace: true,
          });
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
    };
  }, [activePhase, navigate, search.initialReceiptId, surveyId]);

  const startNewRun = async () => {
    if (!canStartReleaseVerificationRun(attempt.status)) return;
    setAttempt({ status: "idle" });
    setOptimisticProbes({});
    await navigate({
      to: "/release-verification",
      search: { surveyId: createReleaseVerificationSurveyId() },
    });
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
            <Detail>Release flight recorder · rapportformat v1</Detail>
          </HStack>

          <VStack gap="space-8">
            <Heading size="xlarge">Bevis kjeden før utrulling</Heading>
            <BodyLong size="large">
              En kontrollert, syntetisk kjøring gjennom widget, innlogget
              dashboard, Lumi API og Postgres. Resultatet bygges fra eksakt
              readback av receipts og kan deles som lenke eller JSON.
            </BodyLong>
          </VStack>

          {configQuery.isPending ? (
            <LoadingState text="Kontrollerer miljø og teamtilgang …" />
          ) : configQuery.isError ? (
            <Alert variant="error">
              Kunne ikke starte preflight. Last siden på nytt.
            </Alert>
          ) : !config?.enabled ? (
            <Alert variant="info">
              Riggen er bare aktiv mot ekte backend i dev-gcp eller den
              eksplisitte lokale fullkjede-konfigurasjonen.
            </Alert>
          ) : surveyId && report ? (
            <>
              <ReportHeader report={report} />

              {config.preflight.status === "failed" ? (
                <Alert variant="error">
                  {config.preflight.message}. Ingen syntetiske data er sendt.
                </Alert>
              ) : config.preflight.status === "unavailable" ? (
                <Alert variant="info">
                  {config.preflight.message}. Ingen syntetiske data sendes før
                  siden lastes på nytt og preflighten er bestått.
                </Alert>
              ) : (
                <Alert variant="success">
                  Teamtilgang er bekreftet før skrivetesten starter.
                </Alert>
              )}

              <HGrid as="ol" columns={{ xs: 1, md: 4 }} gap="space-12">
                {report.checks.map((check, index) => (
                  <VerificationStage
                    key={check.id}
                    step={String(index + 1).padStart(2, "0")}
                    title={checkTitle(check.id)}
                    detail={check.detail}
                    status={check.status}
                  />
                ))}
              </HGrid>

              <Box
                background="neutral-soft"
                borderWidth="1"
                borderColor="neutral-subtle"
                borderRadius="12"
                padding={{ xs: "space-16", md: "space-24" }}
              >
                <VStack gap="space-16">
                  <HStack justify="space-between" align="start" wrap>
                    <VStack gap="space-4">
                      <Detail>SYNTETISK KJØRING</Detail>
                      <BodyShort weight="semibold">{surveyId}</BodyShort>
                      <BodyShort size="small">
                        Kontrollkode:{" "}
                        {createReleaseVerificationControlCode(surveyId)}
                      </BodyShort>
                    </VStack>
                    <HStack gap="space-8" wrap>
                      <CopyButton
                        copyText={surveyId}
                        text="Kopier survey-ID"
                        activeText="Survey-ID kopiert"
                        size="small"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        onClick={startNewRun}
                        disabled={
                          !canStartReleaseVerificationRun(attempt.status)
                        }
                      >
                        Ny kjøring
                      </Button>
                    </HStack>
                  </HStack>

                  {runQuery.isPending && readbackInput ? (
                    <LoadingState text="Leser receipts fra databasen …" />
                  ) : runQuery.isError ? (
                    <Alert variant="error">
                      Kunne ikke rekonstruere rapporten fra receipts.
                    </Alert>
                  ) : null}

                  {attempt.status === "sending" ? (
                    <Alert variant="info">
                      Sender og leser tilbake eksakt receipt …
                    </Alert>
                  ) : attempt.status === "error" ? (
                    <Alert variant="error">
                      Innsendingen feilet: {attempt.message}
                    </Alert>
                  ) : null}

                  {readbackUnavailable ? (
                    <Alert variant="info">
                      <HStack gap="space-12" align="center" wrap>
                        <BodyShort>
                          Readback er midlertidig utilgjengelig. Siden prøver
                          automatisk på nytt.
                        </BodyShort>
                        <Button
                          type="button"
                          variant="secondary"
                          size="small"
                          onClick={() => void runQuery.refetch()}
                        >
                          Prøv readback igjen
                        </Button>
                      </HStack>
                    </Alert>
                  ) : null}

                  {activePhase === "initial" ? (
                    <Alert variant="warning">
                      Åpne widgeten, velg 4 «Bra» og den viste kontrollkoden.
                      Startproben leses automatisk tilbake fra databasen.
                    </Alert>
                  ) : activePhase === "closing" ? (
                    <Alert variant="warning">
                      Holdetiden er ferdig. Send den avsluttende proben med de
                      samme syntetiske valgene.
                    </Alert>
                  ) : report.outcome === "passed" ? (
                    <Alert variant="success">
                      Den kontrollerte dev-kjeden er bestått. Begge receipts er
                      lest tilbake eksakt, og avslutningsproben ble lagret etter
                      holdetiden.
                    </Alert>
                  ) : report.observeAfter &&
                    initialProbe?.status === "verified" ? (
                    <Alert variant="info">
                      Startproben er bevist. Siden låser opp avslutningsproben
                      etter {report.observeAfter}.
                    </Alert>
                  ) : report.outcome === "failed" ? (
                    <Alert variant="error">
                      Kjøringen er stoppet fordi et lagret bevis ikke matcher
                      forventet receipt, survey, app, svar eller kontekst.
                    </Alert>
                  ) : null}

                  {activePhase && survey && transport ? (
                    <LumiSurveyDock
                      key={`${surveyId}:${activePhase}:${closingProbe?.receiptId ?? "new"}`}
                      surveyId={surveyId}
                      survey={survey}
                      transport={transport}
                      context={{
                        tags: {
                          purpose: "release-verification",
                          channel: config.authMode,
                          phase: activePhase,
                        },
                      }}
                      behavior={{
                        initialOpen: true,
                        hideAfterSubmit: false,
                        storageStrategy: "none",
                        showProgress: true,
                      }}
                    />
                  ) : null}
                </VStack>
              </Box>

              <ReportEvidence
                report={report}
                shareUrl={shareUrl}
                dashboardTeam={config.dashboardTeam}
                dashboardApp={config.dashboardApp}
              />
            </>
          ) : null}
        </VStack>
      </Box>
    </>
  );
}

function createVerificationSurvey(surveyId: string): SurveyDocumentV1 {
  const code = createReleaseVerificationControlCode(surveyId);
  return {
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
            id: RELEASE_VERIFICATION_CONTROL_FIELD_ID,
            type: "singleChoice",
            prompt: `Velg kontrollkode ${code}`,
            description:
              "Valget er syntetisk og skal ikke inneholde persondata.",
            required: true,
            options: [
              {
                value: createReleaseVerificationControlOptionId(surveyId),
                label: `Kontrollkode ${code}`,
              },
            ],
          },
        ],
      },
    ],
    success: {
      title: "Probe sendt",
      body: "Dashboardet leser nå samme receipt tilbake fra databasen.",
    },
  };
}

function ReportHeader({ report }: { report: ReleaseVerificationReportV1 }) {
  const labels = {
    passed: "Kontrollert dev-kjede bestått",
    pending: "Kjøringen pågår",
    failed: "Kjøringen er stoppet",
  } as const;
  return (
    <Box
      background="raised"
      role="status"
      aria-live="polite"
      borderWidth="2"
      borderColor={report.outcome === "passed" ? "success" : "neutral-subtle"}
      borderRadius="12"
      padding={{ xs: "space-16", md: "space-24" }}
    >
      <HStack justify="space-between" align="center" wrap gap="space-12">
        <VStack gap="space-4">
          <Detail>STATUS FOR DENNE KJØRINGEN</Detail>
          <Heading level="2" size="large">
            {labels[report.outcome]}
          </Heading>
        </VStack>
        <StatusTag status={report.outcome} />
      </HStack>
    </Box>
  );
}

function VerificationStage({
  step,
  title,
  detail,
  status,
}: {
  step: string;
  title: string;
  detail: string;
  status: ReleaseVerificationCheckStatus;
}) {
  return (
    <Box
      as="li"
      background="raised"
      borderWidth="1"
      borderColor="neutral-subtle"
      borderRadius="8"
      padding="space-16"
    >
      <VStack gap="space-8">
        <HStack justify="space-between" align="center">
          <Detail>{step}</Detail>
          <StatusTag status={status} size="small" />
        </HStack>
        <Heading level="2" size="small">
          {title}
        </Heading>
        <BodyShort size="small">{detail}</BodyShort>
      </VStack>
    </Box>
  );
}

function ReportEvidence({
  report,
  shareUrl,
  dashboardTeam,
  dashboardApp,
}: {
  report: ReleaseVerificationReportV1;
  shareUrl: string;
  dashboardTeam: string;
  dashboardApp: string;
}) {
  const reportJson = JSON.stringify(report, null, 2);
  return (
    <VStack gap="space-16">
      <HStack justify="space-between" align="end" wrap gap="space-12">
        <VStack gap="space-4">
          <Heading level="2" size="medium">
            Maskinlesbart bevis
          </Heading>
          <BodyShort>
            Lenken rekonstruerer rapporten fra receipt-ID-ene. JSON-en
            inneholder ikke token, NAV-ident, e-post eller fritekst.
          </BodyShort>
        </VStack>
        <HStack gap="space-8" wrap>
          {shareUrl ? (
            <CopyButton
              copyText={shareUrl}
              text="Kopier rapportlenke"
              activeText="Rapportlenke kopiert"
              icon={<LinkIcon aria-hidden />}
              size="small"
            />
          ) : null}
          <CopyButton
            copyText={reportJson}
            text="Kopier JSON"
            activeText="JSON kopiert"
            size="small"
          />
          <Button
            type="button"
            variant="secondary"
            size="small"
            icon={<DownloadIcon aria-hidden />}
            onClick={() => downloadReport(report)}
          >
            Last ned JSON
          </Button>
        </HStack>
      </HStack>

      <Box
        as="pre"
        background="neutral-soft"
        borderWidth="1"
        borderColor="neutral-subtle"
        borderRadius="8"
        padding="space-16"
        overflow="auto"
      >
        <BodyShort as="code" size="small">
          {reportJson}
        </BodyShort>
      </Box>

      {report.probes.initial ? (
        <Link
          to="/feedback"
          search={{
            team: dashboardTeam,
            app: dashboardApp,
            surveyId: report.subject.surveyId,
            dateMode: "auto",
          }}
        >
          Vis de syntetiske radene i dashboardet
        </Link>
      ) : null}

      <Alert variant="warning">
        <Heading level="2" size="small" spacing>
          Avgrensning
        </Heading>
        Denne rapporten tester ikke global Azure-feilrate eller
        trygdeetaten-proxyen, og den godkjenner derfor ikke NAV-wide utrulling
        alene. Første canary-app må fortsatt bevise proxy-integrasjonen.
      </Alert>
    </VStack>
  );
}

function StatusTag({
  status,
  size = "medium",
}: {
  status: ReleaseVerificationCheckStatus;
  size?: "small" | "medium";
}) {
  const labels = { passed: "Bestått", pending: "Venter", failed: "Feilet" };
  const variants = {
    passed: "success",
    pending: "warning",
    failed: "error",
  } as const;
  return (
    <Tag variant={variants[status]} size={size}>
      {labels[status]}
    </Tag>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <HStack gap="space-12" align="center">
      <Loader size="medium" title={text} />
      <BodyShort>{text}</BodyShort>
    </HStack>
  );
}

function checkTitle(
  id: ReleaseVerificationReportV1["checks"][number]["id"],
): string {
  return {
    "team-preflight": "Teamtilgang",
    "initial-round-trip": "Startprobe",
    "hold-window": "15 minutters hold",
    "closing-round-trip": "Sluttprobe",
    "local-submission-proxy": "Lokal proxy",
    "controlled-dashboard-round-trip": "Dashboard-rundtur",
  }[id];
}

function downloadReport(report: ReleaseVerificationReportV1): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.runId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
