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
import { useState } from "react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { ActiveFilters } from "~/components/export/ActiveFilters";
import { useSearchParams } from "~/hooks/useSearchParams";
import { exportServerFn } from "~/server/actions";
import { splitChoiceParam } from "~/utils/choiceFilterUtils";
import { splitRatingParam } from "~/utils/ratingFilterUtils";
import styles from "./Panel.module.css";

type ExportFormat = "csv" | "json" | "excel";

export function ExportPanel() {
  const { params } = useSearchParams();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(false);

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
                    Kommaseparert fil, fungerer med Excel og andre verktøy
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
                    Native Excel-format med formatering
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
            Last ned {format.toUpperCase()}
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
            Eksporten inkluderer alle svar med metadata (enhet, side, tidspunkt)
            som matcher filtrene (maks 10 000).
          </BodyShort>
        </VStack>
      </DashboardCard>
    </DashboardGrid>
  );
}
