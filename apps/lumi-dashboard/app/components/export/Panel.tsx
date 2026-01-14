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
  HStack,
  Heading,
  Radio,
  RadioGroup,
  VStack,
} from "@navikt/ds-react";
import dayjs from "dayjs";
import { useState } from "react";
import { DashboardCard, DashboardGrid } from "~/components/dashboard";
import { useSearchParams } from "~/hooks/useSearchParams";
import { exportServerFn } from "~/server/actions";
import {
  formatMetadataLabel,
  formatMetadataValue,
  parseSegmentParam,
} from "~/utils/segmentUtils";

type ExportFormat = "csv" | "json" | "excel";

/**
 * Panel for exporting feedback data in various formats.
 * Uses server function for authenticated backend access.
 */
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
          app: params.app,
          surveyId: params.surveyId,
          fromDate: params.fromDate,
          toDate: params.toDate,
          hasText: params.hasText,
          query: params.query,
          lowRating: params.lowRating,
          deviceType: params.deviceType,
          tag: params.tag,
          segment: params.segment,
        },
      });

      // Convert base64 back to blob and download
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
            style={{ marginLeft: "0.5rem" }}
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
          <Heading size="small">Velg format</Heading>

          <RadioGroup
            legend="Eksportformat"
            hideLegend
            value={format}
            onChange={(val) => setFormat(val as ExportFormat)}
          >
            <Radio value="csv">
              <HStack gap="space-8" align="start">
                <FilesIcon aria-hidden style={{ marginTop: "2px" }} />
                <VStack gap="0">
                  <BodyShort weight="semibold">CSV</BodyShort>
                  <BodyShort size="small">
                    Kommaseparert fil, fungerer med Excel og andre verktøy
                  </BodyShort>
                </VStack>
              </HStack>
            </Radio>
            <Radio value="excel">
              <HStack gap="space-8" align="start">
                <FileExcelIcon aria-hidden style={{ marginTop: "2px" }} />
                <VStack gap="0">
                  <BodyShort weight="semibold">Excel (XLSX)</BodyShort>
                  <BodyShort size="small">
                    Native Excel-format med formatering
                  </BodyShort>
                </VStack>
              </HStack>
            </Radio>
            <Radio value="json">
              <HStack gap="space-8" align="start">
                <FilesIcon aria-hidden style={{ marginTop: "2px" }} />
                <VStack gap="0">
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
          <Heading size="small">Aktive filtre</Heading>
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

/**
 * Displays active filter parameters in a readable format.
 */
function ActiveFilters({
  params,
}: { params: ReturnType<typeof useSearchParams>["params"] }) {
  const segments = parseSegmentParam(params.segment);
  const segmentEntries = Object.entries(segments);

  return (
    <VStack gap="space-12">
      {params.app && params.app !== "alle" && (
        <BodyShort size="small" spacing>
          <strong>App:</strong> {params.app}
        </BodyShort>
      )}
      {params.surveyId && params.surveyId !== "alle" && (
        <BodyShort size="small" spacing>
          <strong>Survey:</strong> {params.surveyId}
        </BodyShort>
      )}
      {params.fromDate && (
        <BodyShort size="small" spacing>
          <strong>Fra:</strong> {dayjs(params.fromDate).format("DD.MM.YYYY")}
        </BodyShort>
      )}
      {params.toDate && (
        <BodyShort size="small" spacing>
          <strong>Til:</strong> {dayjs(params.toDate).format("DD.MM.YYYY")}
        </BodyShort>
      )}
      {params.query && (
        <BodyShort size="small" spacing>
          <strong>Søk:</strong> {params.query}
        </BodyShort>
      )}
      {params.hasText === "true" && (
        <BodyShort size="small" spacing>
          <strong>Filter:</strong> Kun med tekst
        </BodyShort>
      )}
      {params.lowRating === "true" && (
        <BodyShort size="small" spacing>
          <strong>Filter:</strong> Kun lave vurderinger (1-2)
        </BodyShort>
      )}
      {params.tag && (
        <BodyShort size="small" spacing>
          <strong>Tags:</strong> {params.tag}
        </BodyShort>
      )}
      {params.deviceType && (
        <BodyShort size="small" spacing>
          <strong>Enhet:</strong>{" "}
          {params.deviceType === "mobile"
            ? "Mobil"
            : params.deviceType === "desktop"
              ? "Desktop"
              : params.deviceType === "tablet"
                ? "Nettbrett"
                : "Alle"}
        </BodyShort>
      )}

      {segmentEntries.length > 0 && (
        <VStack gap="space-4">
          <BodyShort size="small" spacing>
            <strong>Segmentering:</strong>
          </BodyShort>
          {segmentEntries.map(([key, value]) => (
            <BodyShort key={key} size="small" spacing>
              {formatMetadataLabel(key)}: {formatMetadataValue(value)}
            </BodyShort>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
