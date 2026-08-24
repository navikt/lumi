import {
  ArchiveIcon,
  ArrowCirclepathIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import {
  BodyShort,
  Box,
  Button,
  ErrorMessage,
  Hide,
  HStack,
  Pagination,
  Show,
  Table,
  Tag,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import React, { useEffect, useState } from "react";

import { useActiveFilters } from "~/hooks/useActiveFilters";
import { useArchiveSurvey } from "~/hooks/useArchiveSurvey";
import { useDeleteFeedback } from "~/hooks/useDeleteFeedback";
import { useFeedback } from "~/hooks/useFeedback";
import { useFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { useSearchParams } from "~/hooks/useSearchParams";
import { getTeamSubmissionPeriod } from "~/utils/dashboardPeriod";
import {
  formatRelativeSubmissionTime,
  isReceivingAfterArchive,
  isSurveyArchived,
} from "~/utils/surveyArchiveUtils";
import { ArchiveSurveyDialog } from "../../dashboard/ArchiveSurveyDialog";
import { DeleteSurveyDialog } from "../../dashboard/DeleteSurveyDialog";
import { DataFetchBoundary } from "../../shared/DataFetchBoundary";
import { DeleteFeedbackDialog } from "../DeleteFeedbackDialog";
import { FeedbackEmptyState } from "./EmptyState";
import { FeedbackCard } from "./FeedbackCard";
import { FeedbackExpandedView } from "./FeedbackExpandedView";
import { FeedbackRow } from "./FeedbackRow";
import { Skeleton as FeedbackTableSkeleton } from "./Skeleton";
import styles from "./styles.module.css";

/**
 * Main feedback table component displaying paginated feedback list.
 * Shows table on desktop, card grid on mobile.
 * Supports expand/collapse for detailed view, deletion, and filtering.
 */
interface FeedbackTableProps {
  onResetFilters?: () => void;
}

export function FeedbackTable({ onResetFilters }: FeedbackTableProps = {}) {
  const feedbackQuery = useFeedback();

  return (
    <DataFetchBoundary
      title="Kunne ikke hente tilbakemeldinger"
      queries={[feedbackQuery]}
    >
      <FeedbackTableContent
        feedbackQuery={feedbackQuery}
        onResetFilters={onResetFilters}
      />
    </DataFetchBoundary>
  );
}

function FeedbackTableContent({
  feedbackQuery,
  onResetFilters,
}: {
  feedbackQuery: ReturnType<typeof useFeedback>;
  onResetFilters?: () => void;
}) {
  const { params, setParam, setParams } = useSearchParams();
  const page = Number.parseInt(params.page || "1", 10);
  const { data, error, isPending } = feedbackQuery;
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);
  const deleteFeedbackMutation = useDeleteFeedback();
  const { data: bootstrap } = useFilterBootstrap();
  const { restoreMutation } = useArchiveSurvey(params.surveyId);
  const { hasActiveNonPeriodFilters, resetFilters } = useActiveFilters();
  const feedbackList = data?.content || [];
  const totalPages = data?.totalPages || 1;
  const totalElements = data?.totalElements || 0;
  const hasOutOfRangePage =
    !isPending &&
    !error &&
    feedbackList.length === 0 &&
    totalElements > 0 &&
    page > totalPages;
  const handleResetFilters = () => {
    onResetFilters?.();
    resetFilters();
  };

  useEffect(() => {
    if (hasOutOfRangePage) {
      setParam("page", String(totalPages));
    }
  }, [hasOutOfRangePage, setParam, totalPages]);

  const toggleExpanded = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // isPending: no cached data AND fetching (TanStack Query v5 best practice)
  // With placeholderData: keepPreviousData, isPending stays false during refetches
  if (isPending || hasOutOfRangePage) {
    return <FeedbackTableSkeleton showToolbar />;
  }

  // Data extraction
  const selectedSurvey = params.surveyId;
  const selectedSurveyMeta = selectedSurvey
    ? bootstrap?.surveyMeta?.[selectedSurvey]
    : undefined;
  const selectedSurveyIsArchived =
    !!selectedSurvey && isSurveyArchived(selectedSurvey, bootstrap?.surveyMeta);
  return (
    <div className={styles.table}>
      {/* Toolbar with bulk actions when survey is selected. Not gated on
          totalElements: old surveys without hits in the current period are
          exactly the ones users want to archive. */}
      {selectedSurvey && (
        <SurveyToolbar
          surveyId={selectedSurvey}
          totalCount={totalElements}
          isArchived={selectedSurveyIsArchived}
          lastSubmissionAt={selectedSurveyMeta?.lastSubmissionAt ?? null}
          receivingAfterArchive={isReceivingAfterArchive(selectedSurveyMeta)}
          onArchive={() => setArchiveDialogOpen(true)}
          onRestore={() => restoreMutation.mutate(selectedSurvey)}
          isRestoring={restoreMutation.isPending}
          restoreFailed={restoreMutation.isError}
          onDelete={() => setDeleteDialogOpen(true)}
        />
      )}

      {feedbackList.length === 0 ? (
        <FeedbackEmptyState
          hasAnyData={bootstrap ? bootstrap.apps.length > 0 : undefined}
          hasActiveNonPeriodFilters={hasActiveNonPeriodFilters}
          onResetFilters={handleResetFilters}
          periodFromDate={params.fromDate}
          periodToDate={params.toDate}
          fullPeriod={getTeamSubmissionPeriod(bootstrap?.surveyMeta, {
            includeArchived: params.showArchived === "true",
          })}
          onShowFullPeriod={(period) =>
            setParams({
              dateMode: "fixed",
              fromDate: period.fromDate,
              toDate: period.toDate,
              page: "1",
            })
          }
        />
      ) : (
        <>
          {/* Desktop: Table view */}
          <Show above="md">
            <div className={styles.tableWrapper}>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell className={styles.headerCellExpand} />
                    <Table.HeaderCell className={styles.headerCellDate}>
                      Dato
                    </Table.HeaderCell>
                    <Table.HeaderCell>Tilbakemelding</Table.HeaderCell>
                    <Table.HeaderCell className={styles.headerCellApp}>
                      App
                    </Table.HeaderCell>
                    <Table.HeaderCell className={styles.headerCellActions} />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {feedbackList.map((feedback) => (
                    <React.Fragment key={feedback.id}>
                      <FeedbackRow
                        feedback={feedback}
                        isExpanded={expandedRows.has(feedback.id)}
                        onToggleExpand={() => toggleExpanded(feedback.id)}
                        onDelete={() => setFeedbackToDelete(feedback.id)}
                        isDeleting={
                          deleteFeedbackMutation.isPending &&
                          feedbackToDelete === feedback.id
                        }
                      />
                      {expandedRows.has(feedback.id) && (
                        <FeedbackExpandedView feedback={feedback} />
                      )}
                    </React.Fragment>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </Show>

          {/* Mobile: Card view */}
          <Hide above="md">
            <VStack gap="space-12" padding="space-12">
              {feedbackList.map((feedback) => (
                <FeedbackCard
                  key={feedback.id}
                  feedback={feedback}
                  isExpanded={expandedRows.has(feedback.id)}
                  onToggleExpand={() => toggleExpanded(feedback.id)}
                  onDelete={() => setFeedbackToDelete(feedback.id)}
                  isDeleting={
                    deleteFeedbackMutation.isPending &&
                    feedbackToDelete === feedback.id
                  }
                />
              ))}
            </VStack>
          </Hide>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalElements={totalElements}
            pageSize={data?.size || 10}
            onPageChange={(p) => setParam("page", String(p))}
          />
        </>
      )}

      {/* Archive survey confirmation dialog */}
      {selectedSurvey && (
        <ArchiveSurveyDialog
          surveyId={selectedSurvey}
          isOpen={archiveDialogOpen}
          onClose={() => setArchiveDialogOpen(false)}
        />
      )}

      {/* Delete survey confirmation dialog */}
      {selectedSurvey && (
        <DeleteSurveyDialog
          surveyId={selectedSurvey}
          filteredCount={totalElements}
          isOpen={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onDeleted={() => setParam("surveyId", undefined)}
        />
      )}

      {/* Delete single feedback confirmation dialog */}
      <DeleteFeedbackDialog
        id={feedbackToDelete}
        onClose={() => setFeedbackToDelete(null)}
        onConfirm={() => {
          if (feedbackToDelete) {
            deleteFeedbackMutation.mutate(feedbackToDelete, {
              onSuccess: () => setFeedbackToDelete(null),
            });
          }
        }}
        isPending={deleteFeedbackMutation.isPending}
      />
    </div>
  );
}

/**
 * Toolbar shown when a survey is selected with bulk actions.
 */
function SurveyToolbar({
  surveyId,
  totalCount,
  isArchived,
  lastSubmissionAt,
  receivingAfterArchive,
  onArchive,
  onRestore,
  isRestoring,
  restoreFailed,
  onDelete,
}: {
  surveyId: string;
  totalCount: number;
  isArchived: boolean;
  lastSubmissionAt: string | null;
  receivingAfterArchive: boolean;
  onArchive: () => void;
  onRestore: () => void;
  isRestoring: boolean;
  restoreFailed: boolean;
  onDelete: () => void;
}) {
  return (
    <div className={styles.toolbar}>
      <HStack justify="space-between" align="center" wrap gap="space-8">
        <HStack gap="space-8" align="center">
          <BodyShort size="small" textColor="subtle">
            Viser {totalCount} svar for <strong>{surveyId}</strong>
            {isArchived && <> (arkivert)</>}
          </BodyShort>
          {lastSubmissionAt && (
            <BodyShort size="small" textColor="subtle">
              · Sist svar {formatRelativeSubmissionTime(lastSubmissionAt)}
            </BodyShort>
          )}
          {receivingAfterArchive && (
            <Tooltip content="Surveyen er arkivert, men frontenden sender fortsatt inn svar. Fjern widgeten fra frontend-koden for å stoppe datainnsamling.">
              <Tag size="small" variant="warning">
                Mottar fortsatt innsendinger
              </Tag>
            </Tooltip>
          )}
          {restoreFailed && (
            <ErrorMessage size="small">
              Kunne ikke gjenopprette surveyen. Prøv igjen.
            </ErrorMessage>
          )}
        </HStack>
        <HStack gap="space-8" align="center">
          {isArchived ? (
            <Tooltip content="Gjenopprett surveyen fra arkivet">
              <Button
                variant="secondary"
                size="small"
                icon={<ArrowCirclepathIcon aria-hidden />}
                onClick={onRestore}
                loading={isRestoring}
              >
                Gjenopprett
              </Button>
            </Tooltip>
          ) : (
            <Tooltip content="Skjul surveyen i dashboardet — innsendinger stoppes ikke">
              <Button
                variant="secondary"
                size="small"
                icon={<ArchiveIcon aria-hidden />}
                onClick={onArchive}
              >
                Arkiver
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Slett alle svar og fjern surveyen fra dashboardet — nye innsendinger stoppes ikke">
            <Button
              data-color="danger"
              variant="primary"
              size="small"
              icon={<TrashIcon aria-hidden />}
              onClick={onDelete}
            >
              <Hide below="sm" asChild>
                <span>Slett alle svar</span>
              </Hide>
              <Show below="sm">Slett</Show>
            </Button>
          </Tooltip>
        </HStack>
      </HStack>
    </div>
  );
}

/**
 * Pagination bar with count display.
 */
function PaginationBar({
  page,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Box padding="space-16">
      <HStack justify="space-between" align="center" wrap gap="space-8">
        <Hide below="sm">
          <BodyShort size="small">
            Viser {(page - 1) * pageSize + 1} -{" "}
            {Math.min(page * pageSize, totalElements)} av {totalElements}
          </BodyShort>
        </Hide>
        <Show below="sm">
          <BodyShort size="small">
            {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, totalElements)} / {totalElements}
          </BodyShort>
        </Show>
        <Pagination
          page={page}
          count={totalPages}
          onPageChange={onPageChange}
          size="small"
          prevNextTexts
          siblingCount={0}
          boundaryCount={1}
        />
      </HStack>
    </Box>
  );
}
