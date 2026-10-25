import {
  ArrowsCirclepathIcon,
  DownloadIcon,
  FileExcelIcon,
  FilesIcon,
} from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Button,
  Heading,
  HStack,
  Radio,
  RadioGroup,
  VStack,
} from "@navikt/ds-react";
import { useEffect, useRef, useState } from "react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { ActiveFilters } from "~/components/export/ActiveFilters";
import { AnalysisBudgetAlert } from "~/components/shared/AnalysisBudgetAlert";
import { usePeriodRange } from "~/hooks/usePeriodRange";
import { useSearchParams } from "~/hooks/useSearchParams";
import { exportServerFn } from "~/server/actions";
import { MAX_EXPORT_SIZE } from "~/server/actions/export";
import {
  FILTER_BUDGET_DESCRIPTION,
  isAnalysisBudgetError,
} from "~/utils/analysisBudget";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { isSinceFirst } from "~/utils/dashboardPeriod";
import { focusIsLost, focusStayedOn } from "~/utils/focus";
import { splitRatingParam } from "~/utils/ratingFilterUtils";
import styles from "./Panel.module.css";

type ExportFormat = "csv" | "json" | "excel";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  excel: "Excel",
  json: "JSON",
};

interface Truncation {
  total: number;
  count: number;
}

/**
 * How the last export ended. It belongs to the filters it was made with and
 * is only shown while they are the current ones. The end of «Fra første
 * svar» moving at midnight does not change the filters.
 */
type ExportOutcome = { filterKey: string } & (
  | { kind: "downloaded"; truncation: Truncation | null }
  | { kind: "budget" }
  | { kind: "failed"; message: string }
  | { kind: "filtersChanged" }
);

export function ExportPanel() {
  const { params } = useSearchParams();
  const { fromDate: firstAnswerDate } = usePeriodRange();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const filterKey = JSON.stringify(
    isSinceFirst(params) ? { ...params, toDate: undefined } : params,
  );
  // Read when the export answers, to see if the filters changed meanwhile.
  const currentFilterKey = useRef(filterKey);
  const exportController = useRef<AbortController | null>(null);
  const budgetAlertRef = useRef<HTMLDivElement>(null);
  const failedAlertRef = useRef<HTMLDivElement>(null);
  const downloadButtonRef = useRef<HTMLButtonElement>(null);
  // Set when an export ends, for the effect that moves focus.
  const exportEnded = useRef(false);

  // Cleared during render, as the outcome belongs to the filters it was made
  // with. Going back to those filters does not bring it back.
  if (outcome && outcome.filterKey !== filterKey) {
    setOutcome(null);
  }

  useEffect(() => {
    currentFilterKey.current = filterKey;
    // An export only answers for the filters it started with.
    return () => exportController.current?.abort();
  }, [filterKey]);

  // Aksel disables the button while the export loads, and the focus is lost.
  // When the export ends, focus moves to an alert the user must read, or
  // back to the button.
  useEffect(() => {
    if (!outcome || !exportEnded.current) return;
    exportEnded.current = false;
    if (!focusIsLost()) return;
    if (outcome.kind === "budget") budgetAlertRef.current?.focus();
    else if (outcome.kind === "failed") failedAlertRef.current?.focus();
    else downloadButtonRef.current?.focus();
  }, [outcome]);

  // A closed alert takes its close button with it.
  const closeAlert = (next: ExportOutcome | null) => {
    setOutcome(next);
    downloadButtonRef.current?.focus();
  };

  const handleExport = async () => {
    // A new export with the same filters gets the same refusal. The alert
    // says what helps.
    if (outcome?.kind === "budget") {
      budgetAlertRef.current?.focus();
      return;
    }

    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;
    const startedWith = filterKey;
    const filtersChanged = () => currentFilterKey.current !== startedWith;
    const end = (next: ExportOutcome) => {
      exportEnded.current = true;
      setOutcome(next);
    };
    // Shown with the filters as they are when the export answers.
    const showFiltersChanged = () =>
      end({ kind: "filtersChanged", filterKey: currentFilterKey.current });
    setIsExporting(true);
    setOutcome(null);

    try {
      const result = await exportServerFn({
        data: {
          format,
          team: params.team,
          includeArchived: params.showArchived === "true" ? "true" : undefined,
          app: params.app,
          surveyId: params.surveyId,
          fromDate: params.fromDate,
          toDate: params.toDate,
          hasText: params.hasText,
          query: params.query,
          lowRating: params.lowRating,
          deviceType: params.deviceType,
          theme: params.theme,
          task: params.task,
          tag: params.tag,
          segment: params.segment,
          choice: splitChoiceParam(params.choice),
          rating: splitRatingParam(params.rating),
          phrase: params.phrase,
        },
        signal: controller.signal,
      });

      if (filtersChanged()) {
        showFiltersChanged();
        return;
      }
      // The panel went away, or a newer export replaced this one.
      if (controller.signal.aborted) return;

      const binaryString = atob(result.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.contentType });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      end({
        kind: "downloaded",
        filterKey: startedWith,
        truncation:
          result.total !== null &&
          result.count !== null &&
          result.total > result.count
            ? { total: result.total, count: result.count }
            : null,
      });
    } catch (err) {
      if (filtersChanged()) {
        showFiltersChanged();
        return;
      }
      if (controller.signal.aborted) return;
      if (isAnalysisBudgetError(err)) {
        end({ kind: "budget", filterKey: startedWith });
        return;
      }
      console.error("Export failed:", err);
      end({
        kind: "failed",
        filterKey: startedWith,
        message: err instanceof Error ? err.message : "Ukjent feil ved eksport",
      });
    } finally {
      if (exportController.current === controller) {
        exportController.current = null;
        setIsExporting(false);
      }
    }
  };

  return (
    <DashboardGrid minColumnWidth="300px">
      {outcome?.kind === "failed" && (
        <Alert
          ref={failedAlertRef}
          tabIndex={-1}
          role="alert"
          variant="error"
          className="export-alert"
          closeButton
          onClose={() => closeAlert(null)}
        >
          {outcome.message}
          <Button
            variant="tertiary"
            size="small"
            icon={<ArrowsCirclepathIcon aria-hidden />}
            onClick={handleExport}
            className={styles.retryButton}
          >
            Prøv igjen
          </Button>
        </Alert>
      )}
      {outcome?.kind === "budget" && (
        <AnalysisBudgetAlert
          ref={budgetAlertRef}
          description={FILTER_BUDGET_DESCRIPTION}
          offerRemoveFilter
          focusAfterFiltersRemoved={(origin) => {
            if (focusStayedOn(origin)) downloadButtonRef.current?.focus();
          }}
          className="export-alert"
        />
      )}
      {/* Always in the page. Screen readers announce what comes into it. */}
      <div role="status" className={`export-alert ${styles.status}`}>
        {outcome?.kind === "downloaded" && (
          <VStack gap={{ xs: "space-16", md: "space-24" }}>
            <Alert variant="success">
              Eksport fullført! Filen er lastet ned.
            </Alert>
            {outcome.truncation && (
              <Alert
                variant="warning"
                closeButton
                onClose={() => closeAlert({ ...outcome, truncation: null })}
              >
                Eksporten har de{" "}
                {outcome.truncation.count.toLocaleString("no-NO")} nyeste
                svarene av {outcome.truncation.total.toLocaleString("no-NO")}.
                Del opp perioden og eksporter hver del for seg for å få med
                alle.
              </Alert>
            )}
          </VStack>
        )}
        {outcome?.kind === "filtersChanged" && (
          <Alert variant="info">
            Filtrene ble endret før eksporten var ferdig. Ingen fil ble lastet
            ned. Last ned på nytt.
          </Alert>
        )}
      </div>
      <DashboardCard padding="space-24">
        <VStack gap="space-16">
          <Heading size="small" level="2">
            Velg format
          </Heading>

          <RadioGroup
            legend="Eksportformat"
            hideLegend
            value={format}
            onChange={(val) => setFormat(val as ExportFormat)}
          >
            <Radio value="csv">
              <HStack gap="space-8" align="start">
                <FilesIcon aria-hidden className={styles.optionIcon} />
                <VStack gap="space-0">
                  <BodyShort weight="semibold">CSV</BodyShort>
                  <BodyShort size="small">
                    Kommaseparert fil for videre behandling i skript og andre
                    verktøy
                  </BodyShort>
                </VStack>
              </HStack>
            </Radio>
            <Radio value="excel">
              <HStack gap="space-8" align="start">
                <FileExcelIcon aria-hidden className={styles.optionIcon} />
                <VStack gap="space-0">
                  <BodyShort weight="semibold">Excel (XLSX)</BodyShort>
                  <BodyShort size="small">
                    Regneark som åpnes direkte i Excel
                  </BodyShort>
                </VStack>
              </HStack>
            </Radio>
            <Radio value="json">
              <HStack gap="space-8" align="start">
                <FilesIcon aria-hidden className={styles.optionIcon} />
                <VStack gap="space-0">
                  <BodyShort weight="semibold">JSON</BodyShort>
                  <BodyShort size="small">
                    Maskinlesbart format for videre prosessering
                  </BodyShort>
                </VStack>
              </HStack>
            </Radio>
          </RadioGroup>

          <Button
            ref={downloadButtonRef}
            onClick={handleExport}
            loading={isExporting}
            icon={<DownloadIcon aria-hidden />}
          >
            Last ned {FORMAT_LABELS[format]}
          </Button>
        </VStack>
      </DashboardCard>
      <DashboardCard padding="space-24">
        <VStack gap="space-16">
          <Heading size="small" level="2">
            Aktive filtre
          </Heading>
          <ActiveFilters params={params} firstAnswerDate={firstAnswerDate} />
          <BodyShort size="small" textColor="subtle">
            CSV og Excel har én rad per innsending med ID, tidspunkt, app,
            survey, første vurdering, første fritekstsvar, skjermstørrelse og om
            tekst er maskert. JSON har alle svarene og konteksten fra appen,
            blant annet enhet og side. Eksporten har opptil{" "}
            {MAX_EXPORT_SIZE.toLocaleString("no-NO")} svar som passer med
            filtrene.
          </BodyShort>
        </VStack>
      </DashboardCard>
    </DashboardGrid>
  );
}
