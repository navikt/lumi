import {
  ArchiveIcon,
  ArrowCirclepathIcon,
  TrashIcon,
} from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  ErrorMessage,
  Hide,
  HStack,
  Pagination,
  Show,
  Table,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import React, { useState } from "react";

import { useArchiveSurvey } from "~/hooks/useArchiveSurvey";
import { useDeleteFeedback } from "~/hooks/useDeleteFeedback";
import { useFeedback } from "~/hooks/useFeedback";
import { useFilterBootstrap } from "~/hooks/useFilterBootstrap";
import { useSearchParams } from "~/hooks/useSearchParams";
import { isSurveyArchived } from "~/utils/surveyArchiveUtils";
import { ArchiveSurveyDialog } from "../../dashboard/ArchiveSurveyDialog";
import { DeleteSurveyDialog } from "../../dashboard/DeleteSurveyDialog";
import { DeleteFeedbackDialog } from "../DeleteFeedbackDialog";
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
export function FeedbackTable() {
  const { params, setParam } = useSearchParams();
  const page = Number.parseInt(params.page || "1", 10);
  const { data, error, isPending } = useFeedback();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);
  const deleteFeedbackMutation = useDeleteFeedback();
  const { data: bootstrap } = useFilterBootstrap();
  const { restoreMutation } = useArchiveSurvey();

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

  // Loading and error states
  if (error) {
    return <Alert variant="error">Kunne ikke laste tilbakemeldinger</Alert>;
  }

  // isPending: no cached data AND fetching (TanStack Query v5 best practice)
  // With placeholderData: keepPreviousData, isPending stays false during refetches
  if (isPending) {
    return <FeedbackTableSkeleton showToolbar />;
  }

  // Data extraction
  const feedbackList = data?.content || [];
  const totalPages = data?.totalPages || 1;
  const totalElements = data?.totalElements || 0;
  const selectedSurvey = params.surveyId;
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
          onArchive={() => setArchiveDialogOpen(true)}
          onRestore={() => restoreMutation.mutate(selectedSurvey)}
          isRestoring={restoreMutation.isPending}
          restoreFailed={restoreMutation.isError}
          onDelete={() => setDeleteDialogOpen(true)}
        />
      )}

      {feedbackList.length === 0 ? (
        <Alert variant="info">Ingen tilbakemeldinger funnet</Alert>
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
  onArchive,
  onRestore,
  isRestoring,
  restoreFailed,
  onDelete,
}: {
  surveyId: string;
  totalCount: number;
  isArchived: boolean;
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
          <Tooltip content="Slett hele surveyen (alle svar, uavhengig av filtrering)">
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
