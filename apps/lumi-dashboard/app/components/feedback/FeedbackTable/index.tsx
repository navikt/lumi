import { TrashIcon } from "@navikt/aksel-icons";
import {
  Alert,
  BodyShort,
  Box,
  Button,
  HStack,
  Hide,
  Pagination,
  Show,
  Table,
  Tooltip,
  VStack,
} from "@navikt/ds-react";
import React, { useState } from "react";

import { useDeleteFeedback } from "~/hooks/useDeleteFeedback";
import { useFeedback } from "~/hooks/useFeedback";
import { useSearchParams } from "~/hooks/useSearchParams";
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
  const [feedbackToDelete, setFeedbackToDelete] = useState<string | null>(null);
  const deleteFeedbackMutation = useDeleteFeedback();

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

  return (
    <div className={styles.table}>
      {/* Toolbar with bulk actions when survey is selected */}
      {selectedSurvey && totalElements > 0 && (
        <SurveyToolbar
          surveyId={selectedSurvey}
          totalCount={totalElements}
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
                    <Table.HeaderCell style={{ width: 40 }} />
                    <Table.HeaderCell style={{ width: 100 }}>
                      Dato
                    </Table.HeaderCell>
                    <Table.HeaderCell>Tilbakemelding</Table.HeaderCell>
                    <Table.HeaderCell style={{ width: 200 }}>
                      App
                    </Table.HeaderCell>
                    <Table.HeaderCell style={{ width: 80 }} />
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
  onDelete,
}: { surveyId: string; totalCount: number; onDelete: () => void }) {
  return (
    <div className={styles.toolbar}>
      <HStack justify="space-between" align="center" wrap gap="space-8">
        <BodyShort size="small" textColor="subtle">
          Viser {totalCount} svar for <strong>{surveyId}</strong>
        </BodyShort>
        <Tooltip content="Slett hele surveyen (alle svar, uavhengig av filtrering)">
          <Button
            variant="danger"
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
        <BodyShort size="small">
          <Hide below="sm" asChild>
            <span>
              Viser {(page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, totalElements)} av {totalElements}
            </span>
          </Hide>
          <Show below="sm">
            {(page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, totalElements)} / {totalElements}
          </Show>
        </BodyShort>
        <Pagination
          page={page}
          count={totalPages}
          onPageChange={onPageChange}
          size="small"
          siblingCount={0}
          boundaryCount={1}
        />
      </HStack>
    </Box>
  );
}
