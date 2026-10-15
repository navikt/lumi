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
import { useEffect, useState } from "react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { ActiveFilters } from "~/components/export/ActiveFilters";
import { useSearchParams } from "~/hooks/useSearchParams";
import { exportServerFn } from "~/server/actions";
import { MAX_EXPORT_SIZE } from "~/server/actions/export";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
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

export function ExportPanel() {
  const { params } = useSearchParams();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [truncation, setTruncation] = useState<Truncation | null>(null);
  const filterKey = JSON.stringify(params);

  // biome-ignore lint/correctness/useExhaustiveDependencies: filterKey is the trigger, since the warning only applies to the filters the file was exported with
  useEffect(() => {
    setTruncation(null);
  }, [filterKey]);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(false);
    setTruncation(null);

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
      });

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

      if (
        result.total !== null &&
        result.count !== null &&
        result.total > result.count
      ) {
        setTruncation({ total: result.total, count: result.count });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Export failed:", err);
      setError(err instanceof Error ? err.message : "Ukjent feil ved eksport");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardGrid minColumnWidth="300px">
      {error && (
        <Alert
          variant="error"
          className="export-alert"
          closeButton
          onClose={() => setError(null)}
        >
          {error}
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
      {success && (
        <Alert variant="success" className="export-alert">
          Eksport fullført! Filen er lastet ned.
        </Alert>
      )}
      {truncation && (
        <Alert
          variant="warning"
          role="status"
          className="export-alert"
          closeButton
          onClose={() => setTruncation(null)}
        >
          Eksporten har de {truncation.count.toLocaleString("no-NO")} nyeste
          svarene av {truncation.total.toLocaleString("no-NO")}. Del opp
          perioden og eksporter hver del for seg for å få med alle.
        </Alert>
      )}
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
          <ActiveFilters params={params} />
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
