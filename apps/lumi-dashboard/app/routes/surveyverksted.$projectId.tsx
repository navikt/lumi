import { Alert, Box, Button, HStack, Loader } from "@navikt/ds-react";
import type {
  LumiSurveyAnswerValue,
  SurveyDocumentV1,
  SurveyPageV1,
  SurveyQuestionV1,
} from "@navikt/lumi-survey";
import { validateSurveyDocumentV1 } from "@navikt/lumi-survey";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  EditorTopbar,
  type SaveState,
} from "~/components/surveyverksted/EditorTopbar";
import { FlowOverview } from "~/components/surveyverksted/FlowOverview";
import { PageRail } from "~/components/surveyverksted/PageRail";
import {
  changePresentation,
  type InlinePreviewWidth,
} from "~/components/surveyverksted/PresentationControls";
import {
  PreviewStage,
  STAGE_ENVIRONMENT_TAG,
} from "~/components/surveyverksted/PreviewStage";
import {
  type CanvasUndo,
  QuestionCanvas,
} from "~/components/surveyverksted/QuestionCanvas";
import { QuestionEditor } from "~/components/surveyverksted/QuestionEditor/QuestionEditor";
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
import {
  isDraftAnswer,
  isRevisionAnswer,
  presentationAsStored,
  type SurveyAuthoringProject,
  type SurveyAuthoringProjectSummary,
  type SurveyPresentation,
  savedAsSent,
  withPresentation,
  withStoredPresentation,
} from "~/types/surveyAuthoring";
import {
  LUMI_API_WRITE_TIMEOUT_MESSAGE,
  UNREADABLE_WRITE_ANSWER_MESSAGE,
} from "~/utils/apiErrorMessages";
import { buildConditionSummaries } from "~/utils/conditionSummary";
import {
  computeLiveVisibility,
  type PreviewViewport,
} from "~/utils/liveVisibility";
import {
  isDraftConflictError,
  isRetryable,
  PresentationNotSavedError,
  saveFailureOf,
} from "~/utils/surveyAuthoringErrors";
import type {
  ReferenceableQuestion,
  VisibleIfConditionV1,
} from "~/utils/surveyDocument";
import {
  addFollowUpQuestion,
  addOption,
  addPage,
  addQuestion,
  changeQuestionType,
  commitOptionLabel,
  conditionValueSuggestions,
  duplicatePage,
  duplicateQuestion,
  type FollowUpBranch,
  findHandoffIssues,
  getSpecializedAuthoringContractIssues,
  insertPageAt,
  insertQuestionAt,
  isRequiredSpecializedQuestion,
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
  repairSpecializedSurveyDocument,
  setQuestionVisibleIf,
  setSurveyIntro,
  setSurveySuccess,
  updateOptionLabel,
  updateOptionValue,
} from "~/utils/surveyDocument";
import styles from "./surveyverksted-editor.module.css";

const searchSchema = z.object({ team: z.string().min(1) });
const UNCERTAIN_SAVE_NAVIGATION_PROMPT =
  "Lagringen kan ha blitt fullført. Endringer som ikke er lagret, kan gå tapt. Vil du forlate siden?";

interface EditableDraft {
  name: string;
  surveyId: string;
  document: SurveyDocumentV1;
  presentation: SurveyPresentation;
}

/**
 * What the server holds when a save failed on the way: the request may have
 * reached it. No draft has this fingerprint, so the draft is sent again.
 */
const SAVE_NOT_KNOWN = "";

/**
 * The draft as text, to tell whether it has changed since it was saved. It is
 * read as the API stores it, so a name, survey id or placement note that
 * differs only in spaces at its ends is no change.
 */
const fingerprintOf = (draft: EditableDraft) =>
  JSON.stringify({
    name: draft.name.trim(),
    surveyId: draft.surveyId.trim(),
    document: draft.document,
    presentation: presentationAsStored(draft.presentation),
  });

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
  validateSearch: searchSchema,
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
    // A server from before the display choice existed can answer while a
    // new version is rolled out. Its answer has no presentation.
    queryFn: () =>
      fetchSurveyAuthoringProjectServerFn({ data: { team, projectId } }).then(
        (answer) => {
          if (!isDraftAnswer(answer, team, projectId)) {
            throw new Error("Svaret er ikke utkastet");
          }
          return withPresentation(answer);
        },
      ),
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
    presentation: project.presentation,
  }));
  const [draftVersion, setDraftVersion] = useState(project.draftVersion);
  const [savedFingerprint, setSavedFingerprint] = useState(() =>
    fingerprintOf(project),
  );
  // An API from before the display choice existed does not say which one
  // the draft has. The editor then sends none, so the API keeps the stored
  // choice, and the author cannot change it until the page is opened again.
  // That holds also when a later answer says which choice is stored: the
  // draft here still has the floating panel that was shown in its place.
  const [presentationKnown] = useState(() => !project.presentationUnknown);
  // The choice the API holds, as far as the editor knows.
  const storedPresentationRef = useRef(project.presentation);
  // The width of the preview is a way to look at the survey, not a part of it.
  const [inlineWidth, setInlineWidth] = useState<InlinePreviewWidth>("full");
  const [selectedPageId, setSelectedPageId] = useState(
    project.document.pages[0].id,
  );
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() =>
    initialExpandedIds(project.document.pages[0]),
  );
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null);
  // Bumped when an already-mounted card must take focus again (flow jumps
  // to a question that is expanded on the current page).
  const [focusNonce, setFocusNonce] = useState(0);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  // Live mirror of the preview's answers, reported by the stage dock.
  const [stageAnswers, setStageAnswers] = useState<
    Record<string, LumiSurveyAnswerValue>
  >({});
  // The page the stage shows the survey on, which decides its device type.
  const [stageViewport, setStageViewport] = useState<PreviewViewport>();
  const [repairNoticeVisible, setRepairNoticeVisible] = useState(false);
  const repairNoticeRef = useRef<HTMLDivElement>(null);

  const revisionsQuery = useQuery({
    queryKey: ["survey-authoring-revisions", project.team, project.id],
    queryFn: () =>
      fetchSurveyAuthoringRevisionsServerFn({
        data: { team: project.team, projectId: project.id },
      }),
  });

  const fingerprint = useMemo(() => fingerprintOf(draft), [draft]);
  const hasRequiredMetadata = Boolean(
    draft.name.trim() && draft.surveyId.trim(),
  );

  const saveAttemptsRef = useRef(0);
  const uncertainSaveRef = useRef<Error | null>(null);
  const editorMountedRef = useRef(true);
  // The cached draft can differ from what the server holds: after a
  // conflict, or after a save the server may have stored without this editor
  // knowing it. Opening the draft again then fetches it.
  const cacheMayBeStaleRef = useRef(false);
  const clearDraftCaches = useCallback(() => {
    queryClient.removeQueries({
      queryKey: ["survey-authoring-project", project.team, project.id],
      exact: true,
    });
    void queryClient.invalidateQueries({
      queryKey: ["survey-authoring-projects", project.team],
    });
  }, [project.id, project.team, queryClient]);
  const noteCacheMayBeStale = useCallback(() => {
    cacheMayBeStaleRef.current = true;
    // A request can settle after the author has left the editor.
    if (!editorMountedRef.current) clearDraftCaches();
  }, [clearDraftCaches]);

  useEffect(() => {
    editorMountedRef.current = true;
    return () => {
      editorMountedRef.current = false;
      if (cacheMayBeStaleRef.current) clearDraftCaches();
    };
  }, [clearDraftCaches]);

  // What the server saved: `sent` is the draft that was sent, with the
  // presentation the server holds now.
  const recordSaved = useCallback(
    (saved: SurveyAuthoringProject, sent: EditableDraft) => {
      if (!saved.presentationUnknown) {
        storedPresentationRef.current = saved.presentation;
      }
      cacheMayBeStaleRef.current = false;
      setDraftVersion(saved.draftVersion);
      setSavedFingerprint(fingerprintOf(sent));
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
                  presentation: saved.presentation,
                  draftVersion: saved.draftVersion,
                  updatedAt: saved.updatedAt,
                }
              : candidate,
          ),
      );
    },
    [project.id, project.team, queryClient],
  );

  const saveMutation = useMutation({
    mutationFn: async (
      variables: EditableDraft & { expectedVersion: number },
    ) => {
      const answer: SurveyAuthoringProject =
        await saveSurveyAuthoringDraftServerFn({
          data: {
            team: project.team,
            projectId: project.id,
            expectedVersion: variables.expectedVersion,
            name: variables.name,
            surveyId: variables.surveyId,
            document: variables.document,
            // Left out, the API keeps the choice it has.
            ...(presentationKnown
              ? { presentation: variables.presentation }
              : {}),
          },
        });
      // A save moves the draft one version on. Any other answer, such as an
      // old draft from a proxy, says nothing about what is saved.
      if (
        !isDraftAnswer(answer, project.team, project.id) ||
        answer.draftVersion !== variables.expectedVersion + 1
      ) {
        throw new Error(UNREADABLE_WRITE_ANSWER_MESSAGE);
      }
      const saved = presentationKnown
        ? withStoredPresentation(answer, storedPresentationRef.current)
        : withPresentation(answer);
      if (presentationKnown && !savedAsSent(variables.presentation, saved)) {
        throw new PresentationNotSavedError(saved);
      }
      return saved;
    },
    onSuccess: (saved, variables) => {
      saveAttemptsRef.current = 0;
      recordSaved(saved, variables);
    },
    onError: (error, variables) => {
      saveAttemptsRef.current += 1;
      switch (saveFailureOf(error)) {
        case "partial":
          // The rest of the draft was saved. The choice stays unsaved, so the
          // draft is still changed and is sent again.
          recordSaved((error as PresentationNotSavedError).saved, {
            ...variables,
            presentation: (error as PresentationNotSavedError).saved
              .presentation,
          });
          break;
        case "unknown":
          // The draft is sent again, also if the author has changed it back.
          savedFingerprintRef.current = SAVE_NOT_KNOWN;
          setSavedFingerprint(SAVE_NOT_KNOWN);
          noteCacheMayBeStale();
          break;
        case "uncertain":
          uncertainSaveRef.current = error as Error;
          noteCacheMayBeStale();
          break;
        case "conflict":
          noteCacheMayBeStale();
          break;
      }
    },
  });

  const saveFailure = saveMutation.isError
    ? saveFailureOf(saveMutation.error)
    : null;
  const saveConflict = saveFailure === "conflict";
  const saveUncertain = saveFailure === "uncertain";
  const saveStuck =
    saveFailure !== null &&
    !saveConflict &&
    (!isRetryable(saveFailure) || saveAttemptsRef.current >= 3);

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
    if (uncertainSaveRef.current) throw uncertainSaveRef.current;
    const draft = draftRef.current;
    const fingerprint = fingerprintOf(draft);
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
      // An in-flight save can change the saved draft even after a local revert.
      while (
        activeSaveRef.current ||
        fingerprintOf(draftRef.current) !== savedFingerprintRef.current
      ) {
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
      if (uncertainSaveRef.current) {
        return !window.confirm(UNCERTAIN_SAVE_NAVIGATION_PROMPT);
      }
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
            : saveFailureOf(error) === "uncertain"
              ? UNCERTAIN_SAVE_NAVIGATION_PROMPT
              : "Fikk ikke lagret endringene. Forlate likevel?",
        );
      }
    },
    enableBeforeUnload: () =>
      isDirtyRef.current ||
      savePendingRef.current ||
      Boolean(uncertainSaveRef.current),
  });

  useEffect(() => {
    const failure = saveMutation.isError
      ? saveFailureOf(saveMutation.error)
      : null;
    // Back at what the server holds, nothing is left to save, and a change
    // that could not be saved is gone. A conflict and an uncertain save stay
    // until the page is loaded again.
    if (
      fingerprint === savedFingerprint &&
      failure &&
      failure !== "conflict" &&
      failure !== "uncertain"
    ) {
      saveAttemptsRef.current = 0;
      saveMutation.reset();
      return;
    }
    // After a conflict when sharing, a save meets the same conflict.
    if (
      fingerprint === savedFingerprint ||
      !hasRequiredMetadata ||
      saveMutation.isPending ||
      uncertainSaveRef.current ||
      saveConflictRef.current
    ) {
      return;
    }
    // When only the display choice was not saved, the rest of the draft was.
    // A later change to the rest is saved as usual, also after the tries
    // below, so the message that the rest is saved stays true.
    const restUnsaved =
      saveMutation.error instanceof PresentationNotSavedError &&
      fingerprintOf({
        ...draftRef.current,
        presentation: storedPresentationRef.current,
      }) !== savedFingerprint;
    // Failures another try can fix get a few slower tries. Everything else
    // waits for the manual retry, so a lasting error is not taken for noise
    // on the network.
    if (failure) {
      if (!isRetryable(failure)) return;
      if (saveAttemptsRef.current >= 3 && !restUnsaved) return;
    }

    const timeout = window.setTimeout(
      () => {
        void runSerializedSave().catch(() => {
          // Surfaced via mutation state.
        });
      },
      saveMutation.isError && !restUnsaved ? 3000 : 800,
    );
    return () => window.clearTimeout(timeout);
  }, [
    fingerprint,
    hasRequiredMetadata,
    saveMutation.isPending,
    saveMutation.isError,
    saveMutation.error,
    saveMutation.reset,
    savedFingerprint,
    runSerializedSave,
  ]);

  const pages = draft.document.pages;
  const selectedPage =
    pages.find((page) => page.id === selectedPageId) ?? pages[0];
  const selectedPageNumber = pages.indexOf(selectedPage) + 1;
  const protectedPageIds = useMemo(
    () =>
      new Set(
        draft.document.pages
          .filter((page) =>
            page.questions.some((question) =>
              isRequiredSpecializedQuestion(draft.document.type, question.id),
            ),
          )
          .map((page) => page.id),
      ),
    [draft.document],
  );
  const isDirty = fingerprint !== savedFingerprint;
  // Whether all but the display choice is saved, which the message for a
  // choice that was not saved can then say.
  const restSaved =
    fingerprintOf({ ...draft, presentation: storedPresentationRef.current }) ===
    savedFingerprint;
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
  const specializedContractIssues = useMemo(
    () => getSpecializedAuthoringContractIssues(draft.document),
    [draft.document],
  );

  // Refs keep option handlers stable without stale closures.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // The placement note from before the author chose the floating panel.
  const noteAtTheContentRef = useRef(project.presentation.placementNote);
  const handlePresentationChange = useCallback((next: SurveyPresentation) => {
    const { presentation, noteAtTheContent } = changePresentation(
      draftRef.current.presentation,
      next,
      noteAtTheContentRef.current,
    );
    noteAtTheContentRef.current = noteAtTheContent;
    setDraft((current) => ({ ...current, presentation }));
  }, []);
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
    setRepairNoticeVisible(false);
    setDraft((current) => ({ ...current, document }));
  }, []);

  useEffect(() => {
    if (repairNoticeVisible) repairNoticeRef.current?.focus();
  }, [repairNoticeVisible]);

  const handleRepairSpecializedSurvey = useCallback(() => {
    updateDocument(repairSpecializedSurveyDocument(draftRef.current.document));
    setRepairNoticeVisible(true);
  }, [updateDocument]);

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
    mutationFn: async () => {
      validateSurveyDocumentV1(draft.document);
      const expectedDraftVersion = draftVersion;
      const revision = await createSurveyAuthoringRevisionServerFn({
        data: {
          team: project.team,
          projectId: project.id,
          expectedDraftVersion,
        },
      });
      if (!isRevisionAnswer(revision, project.id, expectedDraftVersion)) {
        throw new Error(UNREADABLE_WRITE_ANSWER_MESSAGE);
      }
      return revision;
    },
    onError: (error) => {
      if (isDraftConflictError(error)) noteCacheMayBeStale();
      // The version may have been shared before the answer failed.
      void queryClient.invalidateQueries({
        queryKey: ["survey-authoring-revisions", project.team, project.id],
      });
    },
    onSuccess: async (revision) => {
      await queryClient.invalidateQueries({
        queryKey: ["survey-authoring-revisions", project.team, project.id],
      });
      // The team list carries each project's newest revision. Write it into
      // the cached list directly: an invalidation alone is undone by the
      // next autosave, whose setQueryData marks the list fresh again with
      // the old revision still on it.
      queryClient.setQueryData<SurveyAuthoringProjectSummary[]>(
        ["survey-authoring-projects", project.team],
        (list) =>
          list?.map((candidate) =>
            candidate.id === project.id
              ? {
                  ...candidate,
                  draftVersion: revision.draftVersion,
                  latestRevision: {
                    id: revision.id,
                    revisionNumber: revision.revisionNumber,
                    draftVersion: revision.draftVersion,
                    createdAt: revision.createdAt,
                  },
                }
              : candidate,
          ),
      );
      await queryClient.invalidateQueries({
        queryKey: ["survey-authoring-projects", project.team],
      });
      await navigate({
        to: "/surveyverksted/revisions/$revisionId",
        params: { revisionId: revision.id },
        search: { team: project.team },
      });
    },
  });

  // Sharing meets a conflict too when the draft was saved somewhere else,
  // for example in another tab. The draft here is then not the one the
  // server holds, also when nothing here is unsaved.
  const shareConflict =
    revisionMutation.isError && isDraftConflictError(revisionMutation.error);
  const draftConflict = saveConflict || shareConflict;

  const handleStageAnswers = useCallback(
    (answers: Record<string, LumiSurveyAnswerValue>) =>
      setStageAnswers(answers),
    [],
  );

  const handleOpenFlow = useCallback(() => setFlowOpen(true), []);

  const flowJumpTimeoutRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (flowJumpTimeoutRef.current !== null) {
        window.clearTimeout(flowJumpTimeoutRef.current);
      }
    },
    [],
  );
  const handleFlowJump = useCallback((pageId: string, questionId: string) => {
    setFlowOpen(false);
    // Suppress the page-switch expansion reset; the jumped-to question is
    // expanded and focused explicitly. Crossing pages starts a fresh set so
    // the previous page's expansions don't linger invisibly.
    previousPageIdRef.current = pageId;
    setSelectedPageId(pageId);
    setExpandedIds((current) =>
      pageId === selectedPageRef.current
        ? new Set([...current, questionId])
        : new Set([questionId]),
    );
    // Focus in a LATER commit: while the modal's native dialog is open the
    // rest of the page is inert (focus() is a no-op), and closing restores
    // focus to the trigger — so the card focus must run after both. The
    // nonce re-triggers the effect for a card that is already mounted.
    flowJumpTimeoutRef.current = window.setTimeout(() => {
      setFocusQuestionId(questionId);
      setFocusNonce((nonce) => nonce + 1);
    }, 0);
  }, []);
  const handleFlowClose = useCallback(() => setFlowOpen(false), []);

  // Which conditional questions the preview shows with its answers now. The
  // display choice is part of it: at the content the preview has the tags of
  // the embed example. So is the width of the page it shows the survey on.
  const liveVisibility = useMemo(
    () =>
      computeLiveVisibility(
        draft.document,
        stageAnswers,
        STAGE_ENVIRONMENT_TAG,
        draft.presentation,
        stageViewport,
      ),
    [draft.document, draft.presentation, stageAnswers, stageViewport],
  );

  const handleAddFollowUp = useCallback(
    (questionId: string, branch: FollowUpBranch) => {
      const result = addFollowUpQuestion(
        draftRef.current.document,
        selectedPageRef.current,
        questionId,
        branch,
      );
      if (!result) return;
      updateDocument(result.document);
      setExpandedIds((current) => new Set([...current, result.questionId]));
      setFocusQuestionId(result.questionId);
    },
    [updateDocument],
  );

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
    const firstQuestion = next.pages.find((page) => page.id === pageId)
      ?.questions[0];
    // Suppress the page-switch expansion reset; the seeded placeholder is
    // expanded and focused explicitly so writing the prompt is one keystroke
    // away.
    previousPageIdRef.current = pageId;
    setSelectedPageId(pageId);
    setExpandedIds(new Set(firstQuestion ? [firstQuestion.id] : []));
    setFocusQuestionId(firstQuestion?.id ?? null);
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

  const conditionSummaries = useMemo(
    () => buildConditionSummaries(draft.document),
    [draft.document],
  );

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
      onCommitLabel: (index: number, label: string) =>
        updateDocument(
          commitOptionLabel(
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
  saveConflictRef.current = draftConflict;
  draftVersionRef.current = draftVersion;
  savedFingerprintRef.current = savedFingerprint;

  const saveState: SaveState = saveUncertain
    ? "uncertain"
    : draftConflict || saveStuck
      ? "error"
      : !hasRequiredMetadata
        ? "missing"
        : saveMutation.isPending || isDirty
          ? "saving"
          : "saved";

  // After a conflict the server holds another draft than the one shown here,
  // also when the author has undone the change that met the conflict.
  const previewReady =
    !isDirty && !saveMutation.isPending && !saveUncertain && !draftConflict;
  const previewHref = previewReady
    ? `/survey-preview?team=${encodeURIComponent(project.team)}&projectId=${encodeURIComponent(project.id)}&version=${draftVersion}`
    : null;

  const handoffIssues = useMemo(
    () => findHandoffIssues(draft.document),
    [draft.document],
  );

  // The same issues the share gate enforces, surfaced early in the flow
  // overview so broken branches are found while editing, not at handoff.
  const flowIssues = useMemo(() => {
    const byQuestion = new Map<string, string[]>();
    const surveyLevel: string[] = [];
    for (const issue of handoffIssues) {
      if (issue.questionId) {
        const list = byQuestion.get(issue.questionId) ?? [];
        list.push(issue.message);
        byQuestion.set(issue.questionId, list);
      } else {
        surveyLevel.push(issue.message);
      }
    }
    return { byQuestion, surveyLevel };
  }, [handoffIssues]);

  const shareStatus: ShareStatus = draftConflict
    ? "conflict"
    : saveUncertain
      ? "save-uncertain"
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
              ? "Velkomstsiden ble fjernet."
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
      ) : shareConflict ? (
        <Alert variant="error" className={styles.saveAlert}>
          Utkastet er endret et annet sted, for eksempel i en annen fane. Last
          siden på nytt før du fortsetter.
        </Alert>
      ) : saveStuck ? (
        <Alert variant="warning" className={styles.saveAlert}>
          {saveUncertain ? (
            saveMutation.error instanceof Error ? (
              saveMutation.error.message
            ) : (
              LUMI_API_WRITE_TIMEOUT_MESSAGE
            )
          ) : (
            <HStack gap="space-12" align="center" wrap>
              <span>
                {saveMutation.error instanceof PresentationNotSavedError ? (
                  restSaved ? (
                    saveMutation.error.message
                  ) : hasRequiredMetadata ? (
                    "Visningsvalget ble ikke lagret. Prøv igjen om litt."
                  ) : (
                    "Visningsvalget ble ikke lagret, og utkastet mangler navn eller survey-ID. De siste endringene lagres når det er rettet."
                  )
                ) : (
                  <>
                    Endringene er ikke lagret:{" "}
                    {saveMutation.error instanceof Error
                      ? saveMutation.error.message
                      : "ukjent feil"}
                  </>
                )}
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
          )}
        </Alert>
      ) : null}

      {specializedContractIssues.length > 0 ? (
        <Alert variant="warning" className={styles.saveAlert}>
          <HStack gap="space-12" align="center" justify="space-between" wrap>
            <span>
              Analyseoppsettet mangler noe som trengs for å kunne dele surveyen.
              Du kan gjenopprette feltene uten å miste andre spørsmål.
            </span>
            <Button
              type="button"
              variant="secondary-neutral"
              size="small"
              onClick={handleRepairSpecializedSurvey}
            >
              Gjenopprett analyseoppsettet
            </Button>
          </HStack>
        </Alert>
      ) : null}

      {repairNoticeVisible && specializedContractIssues.length === 0 ? (
        <div ref={repairNoticeRef} tabIndex={-1}>
          <Alert variant="success" className={styles.saveAlert}>
            Analyseoppsettet er gjenopprettet. Se gjennom feltene før du deler
            surveyen.
          </Alert>
        </div>
      ) : null}

      {advancedMode ? (
        <>
          <Box padding="space-16">
            <Button variant="secondary" onClick={() => setAdvancedMode(false)}>
              Tilbake til enkel redigering
            </Button>
          </Box>
          <div className={styles.editorGrid}>
            <aside className={styles.outline}>
              <PageRail
                pages={pages}
                selectedPageId={selectedPage.id}
                protectedPageIds={protectedPageIds}
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
                surveyType={draft.document.type}
                expandedIds={expandedIds}
                intro={draft.document.intro}
                success={draft.document.success}
                introUndo={screenUndoFor("intro")}
                successUndo={screenUndoFor("success")}
                onChangeIntro={handleChangeIntro}
                onChangeSuccess={handleChangeSuccess}
                focusQuestionId={focusQuestionId}
                focusNonce={focusNonce}
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
                conditionSummaries={conditionSummaries}
                onAddFollowUp={handleAddFollowUp}
                liveVisibility={liveVisibility}
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
                presentation={draft.presentation}
                onPresentationChange={handlePresentationChange}
                presentationUnknown={!presentationKnown}
                inlineWidth={inlineWidth}
                onInlineWidthChange={setInlineWidth}
                onAnswersChange={handleStageAnswers}
                onViewportChange={setStageViewport}
                onOpenFlow={handleOpenFlow}
                flowIssueCount={handoffIssues.length}
              />
            </aside>
          </div>
        </>
      ) : (
        <QuestionEditor
          document={draft.document}
          surveyId={draft.surveyId}
          onChange={updateDocument}
          onAdvanced={() => setAdvancedMode(true)}
          presentation={draft.presentation}
          onPresentationChange={handlePresentationChange}
          presentationUnknown={!presentationKnown}
          inlineWidth={inlineWidth}
          onInlineWidthChange={setInlineWidth}
        />
      )}

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
          // A conflict is told by the status above.
          revisionMutation.isError && !shareConflict
            ? revisionMutation.error instanceof Error
              ? revisionMutation.error.message
              : "Versjonen kunne ikke deles."
            : null
        }
        onFreeze={() => revisionMutation.mutate()}
        onOpenSettings={handleOpenSettingsFromShare}
        saveErrorMessage={
          saveStuck && saveMutation.error instanceof Error
            ? saveMutation.error instanceof PresentationNotSavedError
              ? "visningsvalget ble ikke lagret"
              : saveMutation.error.message
            : null
        }
        onRetrySave={retrySaveNow}
      />

      <FlowOverview
        open={flowOpen}
        onClose={handleFlowClose}
        document={draft.document}
        conditionSummaries={conditionSummaries}
        liveVisibility={liveVisibility}
        hasStageAnswers={Object.keys(stageAnswers).length > 0}
        issuesByQuestion={flowIssues.byQuestion}
        surveyIssues={flowIssues.surveyLevel}
        onJump={handleFlowJump}
      />
    </main>
  );
}
