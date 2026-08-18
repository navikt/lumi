import { Alert, Box, Button, HStack, Loader } from "@navikt/ds-react";
import type {
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";
import { validateSurveyDocumentV1 } from "@navikt/lumi-survey";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  EditorTopbar,
  type SaveState,
} from "~/components/surveyverksted/EditorTopbar";
import { PageRail } from "~/components/surveyverksted/PageRail";
import { PreviewStage } from "~/components/surveyverksted/PreviewStage";
import {
  type CanvasUndo,
  QuestionCanvas,
} from "~/components/surveyverksted/QuestionCanvas";
import { SettingsModal } from "~/components/surveyverksted/SettingsModal";
import {
  ShareDialog,
  type ShareStatus,
} from "~/components/surveyverksted/ShareDialog";
import {
  createSurveyAuthoringRevisionServerFn,
  fetchSurveyAuthoringProjectServerFn,
  fetchSurveyAuthoringRevisionsServerFn,
  saveSurveyAuthoringDraftServerFn,
} from "~/server/actions";
import type {
  SurveyAuthoringProject,
  SurveyAuthoringProjectSummary,
} from "~/types/surveyAuthoring";
import {
  isDraftConflictError,
  isRetryableSaveError,
} from "~/utils/surveyAuthoringErrors";
import type {
  ReferenceableQuestion,
  VisibleIfConditionV1,
} from "~/utils/surveyDocument";
import {
  addOption,
  addPage,
  addQuestion,
  changeQuestionType,
  conditionValueSuggestions,
  duplicatePage,
  duplicateQuestion,
  findHandoffIssues,
  insertPageAt,
  insertQuestionAt,
  listReferenceableQuestions,
  locateQuestion,
  type MoveDirection,
  moveOption,
  movePage,
  movePageToIndex,
  moveQuestion,
  moveQuestionToIndex,
  type QuestionTypeId,
  removeOption,
  removePage,
  removeQuestion,
  setQuestionVisibleIf,
  setSurveyIntro,
  setSurveySuccess,
  updateOptionLabel,
  updateOptionValue,
} from "~/utils/surveyDocument";
import styles from "./surveyverksted-editor.module.css";

const searchSchema = z.object({ team: z.string().min(1) });

interface EditableDraft {
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
}

type UndoState =
  | {
      kind: "question";
      pageId: string;
      question: SurveyQuestionV1;
      index: number;
    }
  | { kind: "page"; page: SurveyPageV1; index: number }
  | { kind: "intro"; value: NonNullable<SurveyDocumentV1["intro"]> }
  | { kind: "success"; value: NonNullable<SurveyDocumentV1["success"]> };

function initialExpandedIds(page: SurveyPageV1): ReadonlySet<string> {
  return page.questions.length <= 2
    ? new Set(page.questions.map((question) => question.id))
    : new Set([page.questions[0].id]);
}

export const Route = createFileRoute("/surveyverksted/$projectId")({
  validateSearch: zodValidator(searchSchema),
  component: SurveyWorkshopEditorRoute,
});

function SurveyWorkshopEditorRoute() {
  const { projectId } = Route.useParams();
  const { team } = Route.useSearch();
  // Fresh data on mount; never refetch behind an open editor. A focus
  // refetch here would remount the editor and discard unsaved local state —
  // external changes surface as 409 conflicts on save instead.
  const projectQuery = useQuery({
    queryKey: ["survey-authoring-project", team, projectId],
    queryFn: () =>
      fetchSurveyAuthoringProjectServerFn({ data: { team, projectId } }),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (projectQuery.isPending) {
    return (
      <Box as="main" padding="space-32" className={styles.loading}>
        <Loader size="large" title="Åpner utkast" />
      </Box>
    );
  }

  if (projectQuery.isError) {
    return (
      <Box as="main" padding="space-32" className="main-container">
        <Alert variant="error">Utkastet kunne ikke åpnes.</Alert>
      </Box>
    );
  }

  // Keyed on id only: a refetched draftVersion must never remount the
  // editor while the author is typing.
  return (
    <SurveyWorkshopEditor
      key={projectQuery.data.id}
      project={projectQuery.data}
    />
  );
}

function SurveyWorkshopEditor({
  project,
}: {
  project: SurveyAuthoringProject;
}) {
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<EditableDraft>(() => ({
    name: project.name,
    surveyId: project.surveyId,
    document: project.document,
  }));
  const [draftVersion, setDraftVersion] = useState(project.draftVersion);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    JSON.stringify({
      name: project.name,
      surveyId: project.surveyId,
      document: project.document,
    }),
  );
  const [selectedPageId, setSelectedPageId] = useState(
    project.document.pages[0].id,
  );
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() =>
    initialExpandedIds(project.document.pages[0]),
  );
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const revisionsQuery = useQuery({
    queryKey: ["survey-authoring-revisions", project.team, project.id],
    queryFn: () =>
      fetchSurveyAuthoringRevisionsServerFn({
        data: { team: project.team, projectId: project.id },
      }),
  });

  const fingerprint = useMemo(() => JSON.stringify(draft), [draft]);
  const hasRequiredMetadata = Boolean(
    draft.name.trim() && draft.surveyId.trim(),
  );

  const saveMutation = useMutation({
    mutationFn: (variables: EditableDraft & { expectedVersion: number }) =>
      saveSurveyAuthoringDraftServerFn({
        data: {
          team: project.team,
          projectId: project.id,
          expectedVersion: variables.expectedVersion,
          name: variables.name,
          surveyId: variables.surveyId,
          document: variables.document,
        },
      }),
    onSuccess: (saved, variables) => {
      saveAttemptsRef.current = 0;
      setDraftVersion(saved.draftVersion);
      setSavedFingerprint(
        JSON.stringify({
          name: variables.name,
          surveyId: variables.surveyId,
          document: variables.document,
        }),
      );
      // Keep the caches authoritative: reopening the editor within staleTime
      // must hand back the saved draft, not the version from first mount.
      // While THIS editor stays mounted, cache updates never touch its state.
      queryClient.setQueryData(
        ["survey-authoring-project", project.team, project.id],
        saved,
      );
      queryClient.setQueryData<SurveyAuthoringProjectSummary[]>(
        ["survey-authoring-projects", project.team],
        (list) =>
          list?.map((candidate) =>
            candidate.id === saved.id
              ? {
                  ...candidate,
                  name: saved.name,
                  surveyId: saved.surveyId,
                  draftVersion: saved.draftVersion,
                  updatedAt: saved.updatedAt,
                }
              : candidate,
          ),
      );
    },
    onError: () => {
      saveAttemptsRef.current += 1;
    },
  });

  const saveAttemptsRef = useRef(0);
  const saveConflict =
    saveMutation.isError && isDraftConflictError(saveMutation.error);
  const saveRetryable =
    saveMutation.isError &&
    !saveConflict &&
    isRetryableSaveError(saveMutation.error);
  const saveStuck =
    saveMutation.isError &&
    !saveConflict &&
    (!saveRetryable || saveAttemptsRef.current >= 3);

  const isDirtyRef = useRef(false);
  const savePendingRef = useRef(false);
  const saveConflictRef = useRef(false);
  const draftVersionRef = useRef(draftVersion);
  const savedFingerprintRef = useRef(savedFingerprint);

  // Single-flight save coordinator: autosave, manual retry and the
  // navigation flush all pass through here, so there is never more than one
  // PUT on the wire and expectedVersion is read AFTER the previous request
  // settled — a slow autosave can no longer race the flush into a
  // self-inflicted 409. Refs are bumped manually so the loop never depends
  // on render timing.
  const activeSaveRef = useRef<Promise<unknown> | null>(null);
  const runSerializedSave = useCallback(async () => {
    while (activeSaveRef.current) {
      // Waiters inherit the active request's outcome: a failed save must
      // never be followed by another PUT of the same stale version. New
      // requests start only after a success or via the explicit retry.
      await activeSaveRef.current;
    }
    const draft = draftRef.current;
    const fingerprint = JSON.stringify(draft);
    if (fingerprint === savedFingerprintRef.current) return;
    if (!draft.name.trim() || !draft.surveyId.trim()) {
      throw new Error("Utkastet mangler navn eller survey-ID");
    }
    const request = saveMutation.mutateAsync({
      ...draft,
      expectedVersion: draftVersionRef.current,
    });
    activeSaveRef.current = request;
    try {
      const saved = await request;
      draftVersionRef.current = saved.draftVersion;
      savedFingerprintRef.current = fingerprint;
    } finally {
      if (activeSaveRef.current === request) activeSaveRef.current = null;
    }
  }, [saveMutation]);

  const retrySaveNow = useCallback(() => {
    saveAttemptsRef.current = 0;
    void runSerializedSave().catch(() => {
      // Surfaced via mutation state.
    });
  }, [runSerializedSave]);

  // Flush before leaving: keeps saving until the draft stops moving, so an
  // edit made while a flush request is on the wire gets its own follow-up
  // save. Parallel navigations (double-clicked back, browser back during a
  // pending flush) share the same flush promise.
  const flushPromiseRef = useRef<Promise<void> | null>(null);
  const flushPendingSave = useCallback(() => {
    if (flushPromiseRef.current) return flushPromiseRef.current;
    const run = (async () => {
      const started = Date.now();
      while (JSON.stringify(draftRef.current) !== savedFingerprintRef.current) {
        const remaining = 8000 - (Date.now() - started);
        if (remaining <= 0) {
          throw new Error("Fikk ikke lagret alle endringene i tide");
        }
        // Never start an overlapping request on timeout — give up and let
        // the caller ask the user instead. The in-flight PUT finishes on
        // its own terms.
        await Promise.race([
          runSerializedSave(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Lagringen bruker for lang tid")),
              remaining,
            ),
          ),
        ]);
      }
    })();
    flushPromiseRef.current = run.finally(() => {
      flushPromiseRef.current = null;
    });
    return flushPromiseRef.current;
  }, [runSerializedSave]);

  useBlocker({
    shouldBlockFn: async () => {
      if (!isDirtyRef.current && !savePendingRef.current) return false;
      if (saveConflictRef.current) {
        return !window.confirm(
          "Endringene kan ikke lagres på grunn av en konflikt. Forlate uten å lagre?",
        );
      }
      try {
        await flushPendingSave();
        return false;
      } catch (error) {
        return !window.confirm(
          isDraftConflictError(error)
            ? "Endringene kan ikke lagres på grunn av en konflikt. Forlate uten å lagre?"
            : "Fikk ikke lagret endringene. Forlate likevel?",
        );
      }
    },
    enableBeforeUnload: () => isDirtyRef.current || savePendingRef.current,
  });

  useEffect(() => {
    if (
      fingerprint === savedFingerprint ||
      !hasRequiredMetadata ||
      saveMutation.isPending
    ) {
      return;
    }
    // A version conflict freezes autosave until reload. Genuinely transient
    // errors get a few slower retries; everything else waits for the manual
    // retry action so permanent errors never masquerade as network noise.
    if (saveMutation.isError) {
      if (isDraftConflictError(saveMutation.error)) return;
      if (!isRetryableSaveError(saveMutation.error)) return;
      if (saveAttemptsRef.current >= 3) return;
    }

    const timeout = window.setTimeout(
      () => {
        void runSerializedSave().catch(() => {
          // Surfaced via mutation state.
        });
      },
      saveMutation.isError ? 3000 : 800,
    );
    return () => window.clearTimeout(timeout);
  }, [
    fingerprint,
    hasRequiredMetadata,
    saveMutation.isPending,
    saveMutation.isError,
    saveMutation.error,
    savedFingerprint,
    runSerializedSave,
  ]);

  const pages = draft.document.pages;
  const selectedPage =
    pages.find((page) => page.id === selectedPageId) ?? pages[0];
  const selectedPageNumber = pages.indexOf(selectedPage) + 1;
  const isDirty = fingerprint !== savedFingerprint;
  const totalQuestions = pages.reduce(
    (sum, page) => sum + page.questions.length,
    0,
  );
  const validationError = useMemo(() => {
    try {
      validateSurveyDocumentV1(draft.document);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Dokumentet er ugyldig";
    }
  }, [draft.document]);

  // Refs keep option handlers stable without stale closures.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const selectedPageRef = useRef(selectedPageId);

  // Re-initialize which cards are open when the author switches page:
  // short pages open everything, longer pages open the first question.
  // Skipped on mount — cards born expanded must not steal focus on load.
  const previousPageIdRef = useRef(selectedPageId);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only page switches re-initialize the set — question edits must not reset it
  useEffect(() => {
    if (previousPageIdRef.current === selectedPageId) return;
    previousPageIdRef.current = selectedPageId;
    const page = pages.find((candidate) => candidate.id === selectedPageId);
    if (!page) return;
    setExpandedIds(initialExpandedIds(page));
    setFocusQuestionId(null);
  }, [selectedPageId]);

  const updateDocument = useCallback((document: SurveyDocumentV1) => {
    setDraft((current) => ({ ...current, document }));
  }, []);

  const clearUndo = useCallback(() => setUndo(null), []);

  // Undo applies the INVERSE operation to the CURRENT document, so edits
  // made after the deletion survive an undo.
  const handleUndo = useCallback(() => {
    if (!undo) return;
    const document = draftRef.current.document;
    if (undo.kind === "question") {
      const next = insertQuestionAt(
        document,
        undo.pageId,
        undo.question,
        undo.index,
      );
      if (next !== document) {
        updateDocument(next);
        previousPageIdRef.current = undo.pageId;
        setSelectedPageId(undo.pageId);
        setExpandedIds((current) => new Set([...current, undo.question.id]));
        setFocusQuestionId(undo.question.id);
      }
    } else if (undo.kind === "page") {
      const next = insertPageAt(document, undo.page, undo.index);
      updateDocument(next);
      previousPageIdRef.current = undo.page.id;
      setSelectedPageId(undo.page.id);
      setExpandedIds(initialExpandedIds(undo.page));
      setFocusQuestionId(undo.page.questions[0]?.id ?? null);
    } else if (undo.kind === "intro") {
      updateDocument(setSurveyIntro(document, undo.value));
    } else {
      updateDocument(setSurveySuccess(document, undo.value));
    }
    setUndo(null);
  }, [undo, updateDocument]);

  const revisionMutation = useMutation({
    mutationFn: () => {
      validateSurveyDocumentV1(draft.document);
      return createSurveyAuthoringRevisionServerFn({
        data: {
          team: project.team,
          projectId: project.id,
          expectedDraftVersion: draftVersion,
        },
      });
    },
    onSuccess: async (revision) => {
      await queryClient.invalidateQueries({
        queryKey: ["survey-authoring-revisions", project.team, project.id],
      });
      await navigate({
        to: "/surveyverksted/revisions/$revisionId",
        params: { revisionId: revision.id },
        search: { team: project.team },
      });
    },
  });

  const handleAddQuestion = useCallback(
    (type: QuestionTypeId) => {
      const before = draftRef.current.document;
      const pageId = selectedPageRef.current;
      const next = addQuestion(before, pageId, type);
      const added = next.pages
        .find((page) => page.id === pageId)
        ?.questions.at(-1);
      updateDocument(next);
      if (added) {
        setExpandedIds((current) => new Set([...current, added.id]));
        setFocusQuestionId(added.id);
      }
    },
    [updateDocument],
  );

  const handleDeleteQuestion = useCallback(
    (questionId: string) => {
      const before = draftRef.current.document;
      const pageId = selectedPageRef.current;
      const page = before.pages.find((candidate) => candidate.id === pageId);
      if (!page) return;
      const index = page.questions.findIndex(
        (question) => question.id === questionId,
      );
      if (index === -1) return;
      const removed = page.questions[index];
      const next = removeQuestion(before, pageId, questionId);
      if (next === before) return;
      updateDocument(next);
      setExpandedIds((current) => {
        const copy = new Set(current);
        copy.delete(questionId);
        return copy;
      });
      setUndo({ kind: "question", pageId, question: removed, index });
    },
    [updateDocument],
  );

  const handleDeletePage = useCallback(
    (pageId: string) => {
      const before = draftRef.current.document;
      const pageIndex = before.pages.findIndex((page) => page.id === pageId);
      if (pageIndex === -1) return;
      const removed = before.pages[pageIndex];
      const next = removePage(before, pageId);
      if (next === before) return;
      updateDocument(next);
      if (selectedPageRef.current === pageId) {
        const neighbor = next.pages[Math.min(pageIndex, next.pages.length - 1)];
        setSelectedPageId(neighbor.id);
      }
      setUndo({ kind: "page", page: removed, index: pageIndex });
    },
    [updateDocument],
  );

  const handleAddPage = useCallback(() => {
    const { document: next, pageId } = addPage(draftRef.current.document);
    updateDocument(next);
    setSelectedPageId(pageId);
  }, [updateDocument]);

  const handleSelectPage = useCallback((pageId: string) => {
    setSelectedPageId(pageId);
    setUndo(null);
  }, []);

  const handleMovePage = useCallback(
    (pageId: string, direction: MoveDirection) =>
      updateDocument(movePage(draftRef.current.document, pageId, direction)),
    [updateDocument],
  );

  const handleReorderPage = useCallback(
    (pageId: string, toIndex: number) =>
      updateDocument(
        movePageToIndex(draftRef.current.document, pageId, toIndex),
      ),
    [updateDocument],
  );

  const handleDuplicatePage = useCallback(
    (pageId: string) =>
      updateDocument(duplicatePage(draftRef.current.document, pageId)),
    [updateDocument],
  );

  const handleExpand = useCallback(
    (questionId: string) =>
      setExpandedIds((current) => new Set([...current, questionId])),
    [],
  );

  const handleCollapse = useCallback(
    (questionId: string) =>
      setExpandedIds((current) => {
        const copy = new Set(current);
        copy.delete(questionId);
        return copy;
      }),
    [],
  );

  const handleUpdatePage = useCallback(
    (updater: (page: SurveyPageV1) => SurveyPageV1) => {
      const document = draftRef.current.document;
      const pageId = selectedPageRef.current;
      updateDocument({
        ...document,
        pages: document.pages.map((page) =>
          page.id === pageId ? updater(page) : page,
        ) as SurveyDocumentV1["pages"],
      });
    },
    [updateDocument],
  );

  const handleQuestionChange = useCallback(
    (
      questionId: string,
      updater: (question: SurveyQuestionV1) => SurveyQuestionV1,
    ) => {
      const document = draftRef.current.document;
      const pageId = selectedPageRef.current;
      updateDocument({
        ...document,
        pages: document.pages.map((page) =>
          page.id === pageId
            ? {
                ...page,
                questions: page.questions.map((question) =>
                  question.id === questionId ? updater(question) : question,
                ) as SurveyPageV1["questions"],
              }
            : page,
        ) as SurveyDocumentV1["pages"],
      });
    },
    [updateDocument],
  );

  const handleChangeType = useCallback(
    (questionId: string, type: QuestionTypeId) =>
      updateDocument(
        changeQuestionType(
          draftRef.current.document,
          selectedPageRef.current,
          questionId,
          type,
        ),
      ),
    [updateDocument],
  );

  const handleDuplicateQuestion = useCallback(
    (questionId: string) =>
      updateDocument(
        duplicateQuestion(
          draftRef.current.document,
          selectedPageRef.current,
          questionId,
        ),
      ),
    [updateDocument],
  );

  const handleMoveQuestion = useCallback(
    (questionId: string, direction: MoveDirection) =>
      updateDocument(
        moveQuestion(
          draftRef.current.document,
          selectedPageRef.current,
          questionId,
          direction,
        ),
      ),
    [updateDocument],
  );

  const handleReorderQuestion = useCallback(
    (questionId: string, toIndex: number) =>
      updateDocument(
        moveQuestionToIndex(
          draftRef.current.document,
          selectedPageRef.current,
          questionId,
          toIndex,
        ),
      ),
    [updateDocument],
  );

  const handleOpenSettingsFromShare = useCallback(() => {
    setShareOpen(false);
    setSettingsOpen(true);
  }, []);

  // Computed per document/expansion change so an open condition editor
  // always sees the CURRENT types and prompts of earlier questions — a
  // stable callback here would let the CanvasQuestion memo freeze stale
  // reference data. Collapsed cards are absent and stay undefined.
  const handleChangeIntro = useCallback(
    (intro: SurveyDocumentV1["intro"]) => {
      const removed = draftRef.current.document.intro;
      if (intro === undefined && removed !== undefined) {
        setUndo({ kind: "intro", value: removed });
      }
      updateDocument(setSurveyIntro(draftRef.current.document, intro));
    },
    [updateDocument],
  );

  const handleChangeSuccess = useCallback(
    (success: SurveyDocumentV1["success"]) => {
      const removed = draftRef.current.document.success;
      if (success === undefined && removed !== undefined) {
        setUndo({ kind: "success", value: removed });
      }
      updateDocument(setSurveySuccess(draftRef.current.document, success));
    },
    [updateDocument],
  );

  const expandedReferenceable = useMemo(() => {
    const map = new Map<string, ReferenceableQuestion[]>();
    for (const id of expandedIds) {
      map.set(id, listReferenceableQuestions(draft.document, id));
    }
    return map;
  }, [draft.document, expandedIds]);

  const suggestionsFor = useCallback(
    (referencedId: string) =>
      conditionValueSuggestions(draftRef.current.document, referencedId),
    [],
  );

  const handleChangeVisibleIf = useCallback(
    (questionId: string, condition: VisibleIfConditionV1 | undefined) =>
      updateDocument(
        setQuestionVisibleIf(
          draftRef.current.document,
          selectedPageRef.current,
          questionId,
          condition,
        ),
      ),
    [updateDocument],
  );

  const optionHandlersFor = useCallback(
    (questionId: string) => ({
      onAdd: () =>
        updateDocument(
          addOption(
            draftRef.current.document,
            selectedPageRef.current,
            questionId,
            "",
          ),
        ),
      onUpdateLabel: (index: number, label: string) =>
        updateDocument(
          updateOptionLabel(
            draftRef.current.document,
            selectedPageRef.current,
            questionId,
            index,
            label,
          ),
        ),
      onUpdateValue: (index: number, value: string) =>
        updateDocument(
          updateOptionValue(
            draftRef.current.document,
            selectedPageRef.current,
            questionId,
            index,
            value,
          ),
        ),
      onRemove: (index: number) =>
        updateDocument(
          removeOption(
            draftRef.current.document,
            selectedPageRef.current,
            questionId,
            index,
          ),
        ),
      onMove: (index: number, direction: MoveDirection) =>
        updateDocument(
          moveOption(
            draftRef.current.document,
            selectedPageRef.current,
            questionId,
            index,
            direction,
          ),
        ),
    }),
    [updateDocument],
  );

  selectedPageRef.current = selectedPage.id;
  isDirtyRef.current = isDirty;
  savePendingRef.current = saveMutation.isPending;
  saveConflictRef.current = saveConflict;
  draftVersionRef.current = draftVersion;
  savedFingerprintRef.current = savedFingerprint;

  const saveState: SaveState =
    saveConflict || saveStuck
      ? "error"
      : !hasRequiredMetadata
        ? "missing"
        : saveMutation.isPending || isDirty
          ? "saving"
          : "saved";

  const previewReady = !isDirty && !saveMutation.isPending;
  const previewHref = previewReady
    ? `/survey-preview?team=${encodeURIComponent(project.team)}&projectId=${encodeURIComponent(project.id)}&version=${draftVersion}`
    : null;

  const handoffIssues = useMemo(
    () => findHandoffIssues(draft.document),
    [draft.document],
  );

  const shareStatus: ShareStatus = saveConflict
    ? "conflict"
    : saveStuck
      ? "save-error"
      : !hasRequiredMetadata
        ? "missing"
        : validationError || handoffIssues.length > 0
          ? "invalid"
          : isDirty || saveMutation.isPending
            ? "saving"
            : "ready";

  const shareIssue = useMemo(() => {
    if (validationError) {
      const quoted = validationError.match(/"([^"]+)"/);
      return {
        message: validationError,
        location: quoted ? locateQuestion(draft.document, quoted[1]) : null,
      };
    }
    const first = handoffIssues[0];
    if (!first) return null;
    return {
      message: first.message,
      location: first.questionId
        ? locateQuestion(draft.document, first.questionId)
        : null,
    };
  }, [validationError, handoffIssues, draft.document]);

  const revisions = revisionsQuery.data ?? [];
  // Promise a number only once the list is known; the API decides anyway.
  const nextRevisionNumber = revisionsQuery.isSuccess
    ? revisions.reduce(
        (max, revision) => Math.max(max, revision.revisionNumber),
        0,
      ) + 1
    : null;

  const canvasUndo: CanvasUndo | null = undo
    ? undo.kind === "page"
      ? { label: "Siden ble slettet.", index: null }
      : undo.kind === "question" && undo.pageId === selectedPage.id
        ? { label: "Spørsmålet ble slettet.", index: undo.index }
        : null
    : null;

  const screenUndoFor = (kind: "intro" | "success") =>
    undo?.kind === kind
      ? {
          label:
            kind === "intro"
              ? "Introskjermen ble fjernet."
              : "Tilpasningen av bekreftelsen ble fjernet.",
          onUndo: handleUndo,
          onExpire: () => setUndo(null),
        }
      : null;

  const stats = useMemo(
    () => ({ pages: pages.length, questions: totalQuestions }),
    [pages.length, totalQuestions],
  );

  return (
    <main className={styles.editorShell}>
      <EditorTopbar
        name={draft.name}
        surveyId={draft.surveyId}
        team={project.team}
        saveState={saveState}
        previewHref={previewHref}
        onRename={(name) => setDraft((current) => ({ ...current, name }))}
        onBack={() =>
          navigate({ to: "/surveyverksted", search: { team: project.team } })
        }
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShare={() => setShareOpen(true)}
      />

      {saveConflict ? (
        <Alert variant="error" className={styles.saveAlert}>
          Utkastet ble ikke lagret. Det kan ha blitt endret i en annen fane.
          Last siden på nytt før du fortsetter.
        </Alert>
      ) : saveStuck ? (
        <Alert variant="warning" className={styles.saveAlert}>
          <HStack gap="space-12" align="center" wrap>
            <span>
              Endringene er ikke lagret:{" "}
              {saveMutation.error instanceof Error
                ? saveMutation.error.message
                : "ukjent feil"}
            </span>
            <Button
              type="button"
              variant="secondary-neutral"
              size="small"
              onClick={retrySaveNow}
            >
              Prøv å lagre igjen
            </Button>
          </HStack>
        </Alert>
      ) : null}

      <div className={styles.editorGrid}>
        <aside className={styles.outline}>
          <PageRail
            pages={pages}
            selectedPageId={selectedPage.id}
            onSelect={handleSelectPage}
            onAdd={handleAddPage}
            onMove={handleMovePage}
            onReorder={handleReorderPage}
            onDuplicate={handleDuplicatePage}
            onDelete={handleDeletePage}
          />
        </aside>

        <section
          className={styles.canvas}
          aria-label={`Side ${selectedPageNumber}: ${selectedPage.title ?? "uten tittel"}`}
        >
          <QuestionCanvas
            page={selectedPage}
            pageNumber={selectedPageNumber}
            totalPages={pages.length}
            expandedIds={expandedIds}
            intro={draft.document.intro}
            success={draft.document.success}
            introUndo={screenUndoFor("intro")}
            successUndo={screenUndoFor("success")}
            onChangeIntro={handleChangeIntro}
            onChangeSuccess={handleChangeSuccess}
            focusQuestionId={focusQuestionId}
            undo={canvasUndo}
            onUndo={handleUndo}
            onUndoExpire={clearUndo}
            onExpand={handleExpand}
            onCollapse={handleCollapse}
            onUpdatePage={handleUpdatePage}
            onQuestionChange={handleQuestionChange}
            onChangeType={handleChangeType}
            onDuplicate={handleDuplicateQuestion}
            onDelete={handleDeleteQuestion}
            onMoveQuestion={handleMoveQuestion}
            onReorderQuestion={handleReorderQuestion}
            optionHandlersFor={optionHandlersFor}
            referenceableByQuestion={expandedReferenceable}
            suggestionsFor={suggestionsFor}
            onChangeVisibleIf={handleChangeVisibleIf}
            onAddQuestion={handleAddQuestion}
          />
        </section>

        <aside className={styles.preview}>
          <PreviewStage
            document={draft.document}
            isValid={!validationError}
            surveyId={draft.surveyId}
            initialPageId={selectedPage.id}
            fullPreviewHref={previewHref}
            stats={stats}
          />
        </aside>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        surveyId={draft.surveyId}
        team={project.team}
        onChangeSurveyId={(surveyId) =>
          setDraft((current) => ({ ...current, surveyId }))
        }
      />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        status={shareStatus}
        validationMessage={shareIssue?.message ?? null}
        validationLocation={shareIssue?.location ?? null}
        nextRevisionNumber={nextRevisionNumber}
        stats={stats}
        revisions={revisions}
        team={project.team}
        freezing={revisionMutation.isPending}
        freezeError={
          revisionMutation.isError
            ? revisionMutation.error instanceof Error
              ? revisionMutation.error.message
              : "Revisjonen kunne ikke opprettes."
            : null
        }
        onFreeze={() => revisionMutation.mutate()}
        onOpenSettings={handleOpenSettingsFromShare}
        saveErrorMessage={
          saveStuck && saveMutation.error instanceof Error
            ? saveMutation.error.message
            : null
        }
        onRetrySave={retrySaveNow}
      />
    </main>
  );
}
