import type {
  LumiSurveyConfig,
  SurveyDocumentV1,
  SurveyQuestionV1,
} from "../components/surveyTypes.js";
import { SPECIALIZED_SURVEY_FIELD_IDS } from "../core/specializedSurveyContract.js";
import type {
  EmojiRatingQuestion,
  LumiSurveyQuestion,
  NpsRatingQuestion,
  RatingScaleLabel,
  StarRatingQuestion,
  TextQuestion,
  ThumbsRatingQuestion,
} from "../core/types.js";

// ============================================
// Default Survey Presets
// ============================================

/**
 * Default rating survey: 5-point emoji rating with optional text follow-up.
 *
 * @deprecated Use `DEFAULT_RATING_SURVEY_DOCUMENT` for new surveys.
 *
 * @example
 * ```tsx
 * import { LumiSurveyDock, DEFAULT_SURVEY_RATING } from "@navikt/lumi-survey";
 *
 * <LumiSurveyDock
 *   surveyId="my-app-feedback"
 *   survey={DEFAULT_SURVEY_RATING}
 *   transport={transport}
 * />
 * ```
 */
export const DEFAULT_SURVEY_RATING: LumiSurveyConfig = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan var opplevelsen din?",
      description: "Svarene brukes til å videreutvikle tjenesten",
      required: true,
    } as EmojiRatingQuestion,
    {
      id: "feedback",
      type: "text",
      prompt: "Har du andre tilbakemeldinger?",
      description: "Alle tilbakemeldinger er til stor nytte for oss",
      required: false,
      maxLength: 1000,
      // Progressive disclosure: show only after rating is selected
      visibleIf: { field: "ANSWER", questionId: "rating", operator: "EXISTS" },
    } as TextQuestion,
  ],
};

/**
 * Service-oriented rating survey with improved messaging.
 * Emphasizes that feedback is used for service development.
 *
 * @deprecated Use a `SurveyDocumentV1`, for example from
 * `createRatingSurveyDocument`.
 */
export const DEFAULT_SURVEY_SERVICE_FEEDBACK: LumiSurveyConfig = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan opplevde du å svare på spørsmålene?",
      description: "Svarene brukes til å videreutvikle tjenesten",
      required: true,
    } as EmojiRatingQuestion,
    {
      id: "feedback",
      type: "text",
      prompt: "Legg gjerne til en begrunnelse",
      description: "Alle tilbakemeldinger er til stor nytte for oss",
      required: false,
      maxLength: 1000,
      // Progressive disclosure: show only after rating is selected
      visibleIf: { field: "ANSWER", questionId: "rating", operator: "EXISTS" },
    } as TextQuestion,
  ],
};

// ============================================
// New Rating Type Presets
// ============================================

/**
 * Quick thumbs up/down survey: 2-point binary rating.
 * Perfect for "Was this helpful?" type questions.
 *
 * @deprecated Use a `SurveyDocumentV1`, for example from
 * `createRatingSurveyDocument`.
 *
 * @example
 * ```tsx
 * <LumiSurveyDock
 *   surveyId="article-helpful"
 *   survey={DEFAULT_SURVEY_THUMBS}
 *   transport={transport}
 * />
 * ```
 */
export const DEFAULT_SURVEY_THUMBS: LumiSurveyConfig = {
  type: "rating",
  questions: [
    {
      id: "helpful",
      type: "rating",
      variant: "thumbs",
      prompt: "Var dette til hjelp?",
      required: true,
    } as ThumbsRatingQuestion,
    {
      id: "feedback",
      type: "text",
      prompt: "Har du forslag til forbedringer?",
      required: false,
      maxLength: 500,
      visibleIf: { field: "ANSWER", questionId: "helpful", operator: "EXISTS" },
    } as TextQuestion,
  ],
};

/**
 * Star rating survey: 5-point star rating.
 * Common UX pattern for quality ratings.
 *
 * @deprecated Use a `SurveyDocumentV1`, for example from
 * `createRatingSurveyDocument`.
 *
 * @example
 * ```tsx
 * <LumiSurveyDock
 *   surveyId="content-quality"
 *   survey={DEFAULT_SURVEY_STARS}
 *   transport={transport}
 * />
 * ```
 */
export const DEFAULT_SURVEY_STARS: LumiSurveyConfig = {
  type: "rating",
  questions: [
    {
      id: "stars",
      type: "rating",
      variant: "stars",
      prompt: "Hvordan opplevde du å bruke tjenesten?",
      description: "Svarene brukes til å videreutvikle tjenesten",
      required: true,
    } as StarRatingQuestion,
    {
      id: "feedback",
      type: "text",
      prompt: "Legg gjerne til en begrunnelse",
      description: "Alle tilbakemeldinger er til stor nytte for oss",
      required: false,
      maxLength: 1000,
      visibleIf: { field: "ANSWER", questionId: "stars", operator: "EXISTS" },
    } as TextQuestion,
  ],
};

/**
 * NPS (Net Promoter Score) survey: 0-10 scale.
 * Standard methodology for measuring customer loyalty.
 *
 * @deprecated Use a `SurveyDocumentV1`, for example from
 * `createRatingSurveyDocument`.
 * @example
 * ```tsx
 * <LumiSurveyDock
 *   surveyId="nps-survey"
 *   survey={DEFAULT_SURVEY_NPS}
 *   transport={transport}
 * />
 * ```
 */
export const DEFAULT_SURVEY_NPS: LumiSurveyConfig = {
  type: "rating",
  questions: [
    {
      id: "nps",
      type: "rating",
      variant: "nps",
      prompt:
        "Hvor sannsynlig er det at du vil anbefale denne tjenesten til en venn eller kollega?",
      lowLabel: "Lite sannsynlig",
      highLabel: "Svært sannsynlig",
      required: true,
    } as NpsRatingQuestion,
    {
      id: "reason",
      type: "text",
      prompt: "Legg gjerne til en begrunnelse",
      description: "Alle tilbakemeldinger er til stor nytte for oss",
      required: false,
      maxLength: 500,
      visibleIf: { field: "ANSWER", questionId: "nps", operator: "EXISTS" },
    } as TextQuestion,
  ],
};

/**
 * Default discovery survey: Free-text task identification with success question.
 * Use this to discover what tasks users come to your site for.
 *
 * @deprecated Use `DEFAULT_DISCOVERY_SURVEY_DOCUMENT` for new surveys.
 *
 * @example
 * ```tsx
 * import { LumiSurveyDock, DEFAULT_SURVEY_DISCOVERY } from "@navikt/lumi-survey";
 *
 * <LumiSurveyDock
 *   surveyId="discovery-feedback"
 *   survey={DEFAULT_SURVEY_DISCOVERY}
 *   transport={transport}
 * />
 * ```
 */
export const DEFAULT_SURVEY_DISCOVERY: LumiSurveyConfig = {
  type: "discovery",
  questions: createLegacyDiscoveryQuestions(),
};

// ============================================
// Survey Builder Functions
// ============================================

/** @deprecated Use `RatingSurveyDocumentOptions` with `createRatingSurveyDocument`. */
export interface RatingSurveyOptions {
  ratingPrompt: string;
  ratingDescription?: string;
  followUpQuestions?: LumiSurveyQuestion[];
}

type RatingSurveyDocumentPresentation =
  | {
      variant?: "emoji" | "thumbs" | "stars";
      labels?: RatingScaleLabel[];
      lowLabel?: never;
      highLabel?: never;
    }
  | {
      variant: "nps";
      labels?: RatingScaleLabel[];
      lowLabel?: string;
      highLabel?: string;
    };

export type RatingSurveyDocumentOptions = {
  ratingPrompt: string;
  ratingDescription?: string;
  followUpQuestions?: SurveyQuestionV1[];
} & RatingSurveyDocumentPresentation;

function createLegacyRatingQuestions(
  options: RatingSurveyOptions,
): LumiSurveyQuestion[] {
  const questions: LumiSurveyQuestion[] = [
    {
      id: "rating",
      type: "rating",
      prompt: options.ratingPrompt,
      description: options.ratingDescription,
      required: true,
    },
  ];

  if (options.followUpQuestions) {
    // Add visibleIf to follow-up questions for progressive disclosure
    const followUpsWithVisibility = options.followUpQuestions.map((q) => ({
      ...q,
      visibleIf: q.visibleIf ?? {
        field: "ANSWER" as const,
        questionId: "rating",
        operator: "EXISTS" as const,
      },
    }));
    questions.push(...followUpsWithVisibility);
  }

  return questions;
}

function createRatingDocumentQuestions(
  options: RatingSurveyDocumentOptions,
): [SurveyQuestionV1, ...SurveyQuestionV1[]] {
  const commonRating = {
    id: "rating",
    type: "rating" as const,
    prompt: options.ratingPrompt,
    description: options.ratingDescription,
    required: true,
    labels: options.labels,
  };
  const rating: SurveyQuestionV1 =
    options.variant === "nps"
      ? {
          ...commonRating,
          variant: "nps",
          lowLabel: options.lowLabel,
          highLabel: options.highLabel,
        }
      : { ...commonRating, variant: options.variant ?? "emoji" };
  const followUps = (options.followUpQuestions ?? []).map((question) => ({
    ...question,
    visibleIf: question.visibleIf ?? {
      questionId: "rating",
      operator: "EXISTS" as const,
    },
  }));
  return [rating, ...followUps];
}

/**
 * Creates a legacy flat rating survey.
 *
 * @deprecated Use `createRatingSurveyDocument` for new surveys.
 */
export function createRatingSurvey(
  options: RatingSurveyOptions,
): LumiSurveyConfig {
  return { type: "rating", questions: createLegacyRatingQuestions(options) };
}

/**
 * Creates the recommended page-based rating survey. The rating and its
 * progressively disclosed follow-up fields share one explicit page.
 */
export function createRatingSurveyDocument(
  options: RatingSurveyDocumentOptions,
): SurveyDocumentV1 {
  return {
    authoringSchemaVersion: 1,
    type: "rating",
    pages: [
      {
        id: "rating",
        questions: createRatingDocumentQuestions(options),
      },
    ],
  };
}

/** Recommended rating document with a progressively disclosed comment. */
export const DEFAULT_RATING_SURVEY_DOCUMENT = createRatingSurveyDocument({
  ratingPrompt: "Hvordan var opplevelsen din?",
  followUpQuestions: [
    {
      id: "feedback",
      type: "text",
      prompt: "Har du andre tilbakemeldinger?",
      required: false,
      maxLength: 1000,
    },
  ],
});

/** Options shared by the legacy and page-based Discovery builders. */
export interface DiscoverySurveyOptions {
  taskPrompt?: string;
  taskPlaceholder?: string;
  successPrompt?: string;
  blockerPrompt?: string;
  includeBlockerQuestion?: boolean;
}

/**
 * Creates a Discovery survey for free-text task identification.
 * Use this to discover what tasks users come to your site for.
 *
 * @deprecated Use `createDiscoverySurveyDocument` for new surveys.
 */
export function createDiscoverySurvey(
  options?: DiscoverySurveyOptions,
): LumiSurveyConfig {
  return {
    type: "discovery",
    questions: createLegacyDiscoveryQuestions(options),
  };
}

function createLegacyDiscoveryQuestions(
  options?: DiscoverySurveyOptions,
): LumiSurveyQuestion[] {
  const questions: LumiSurveyQuestion[] = [
    {
      id: "discoveredTask",
      type: "text",
      prompt: options?.taskPrompt ?? "Hva kom du hit for å gjøre i dag?",
      placeholder: options?.taskPlaceholder ?? "Beskriv med dine egne ord...",
      required: true,
      minRows: 2,
      maxLength: 500,
    },
    {
      id: "taskSuccess",
      type: "singleChoice",
      prompt: options?.successPrompt ?? "Fikk du gjort det?",
      options: [
        { value: "yes", label: "Ja" },
        { value: "partial", label: "Delvis" },
        { value: "no", label: "Nei" },
      ],
      required: true,
    },
  ];
  if (options?.includeBlockerQuestion !== false) {
    questions.push({
      id: "blocker",
      type: "text",
      prompt: options?.blockerPrompt ?? "Hva hindret deg?",
      required: false,
      maxLength: 500,
    });
  }
  return questions;
}

function createDiscoveryDocumentQuestions(
  options?: DiscoverySurveyOptions,
): LumiSurveyQuestion[] {
  const questions: LumiSurveyQuestion[] = [
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.task,
      type: "text",
      prompt: options?.taskPrompt ?? "Hva kom du hit for å gjøre i dag?",
      placeholder: options?.taskPlaceholder ?? "Beskriv med dine egne ord...",
      required: true,
      minRows: 2,
      maxLength: 500,
    },
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.success,
      type: "singleChoice",
      prompt: options?.successPrompt ?? "Fikk du gjort det?",
      options: [
        { value: "yes", label: "Ja" },
        { value: "partial", label: "Delvis" },
        { value: "no", label: "Nei" },
      ],
      required: true,
    },
  ];

  if (options?.includeBlockerQuestion !== false) {
    questions.push({
      id: SPECIALIZED_SURVEY_FIELD_IDS.blocker,
      type: "text",
      prompt: options?.blockerPrompt ?? "Hva hindret deg?",
      required: false,
      maxLength: 500,
      visibleIf: {
        all: [
          {
            questionId: SPECIALIZED_SURVEY_FIELD_IDS.success,
            operator: "EXISTS",
          },
          {
            questionId: SPECIALIZED_SURVEY_FIELD_IDS.success,
            operator: "NEQ",
            value: "yes",
          },
        ],
      },
    });
  }

  return questions;
}

/** Options shared by the legacy and page-based Top Tasks builders. */
export interface TopTasksSurveyOptions {
  taskPrompt?: string;
  tasks: Array<{ value: string; label: string }>;
  successPrompt?: string;
  blockerPrompt?: string;
  includeBlockerQuestion?: boolean;
  includeOtherTask?: boolean;
  otherTaskPrompt?: string;
}

function assertTaskOptions(
  tasks: readonly { value: string; label: string }[],
  templateName: string,
): void {
  if (tasks.length === 0) {
    throw new Error(`Lumi: ${templateName} needs at least one task`);
  }
  const values = new Set<string>();
  for (const task of tasks) {
    if (!task.value.trim() || !task.label.trim()) {
      throw new Error(
        `Lumi: ${templateName} tasks need a non-blank value and label`,
      );
    }
    if (values.has(task.value)) {
      throw new Error(`Lumi: ${templateName} task values must be unique`);
    }
    values.add(task.value);
  }
}

/**
 * Creates a Top Tasks survey for measuring task completion success.
 *
 * @deprecated Use `createTopTasksSurveyDocument` for new surveys.
 *
 * Note: Tasks must be provided as they are domain-specific.
 * There is no DEFAULT_SURVEY_TOP_TASKS since tasks vary per application.
 *
 * @example
 * ```tsx
 * const survey = createTopTasksSurvey({
 *   tasks: [
 *     { value: "apply", label: "Søke om sykepenger" },
 *     { value: "status", label: "Sjekke status på søknad" },
 *   ]
 * });
 * ```
 */
export function createTopTasksSurvey(
  options: TopTasksSurveyOptions,
): LumiSurveyConfig {
  return {
    type: "topTasks",
    questions: createLegacyTopTasksQuestions(options),
  };
}

function createLegacyTopTasksQuestions(
  options: TopTasksSurveyOptions,
): LumiSurveyQuestion[] {
  const taskOptions = options.includeOtherTask
    ? [...options.tasks, { value: "other", label: "Noe annet" }]
    : options.tasks;
  const questions: LumiSurveyQuestion[] = [
    {
      id: "task",
      type: "singleChoice",
      prompt: options.taskPrompt ?? "Hva prøvde du å gjøre i dag?",
      options: taskOptions,
      required: true,
    },
  ];
  if (options.includeOtherTask) {
    questions.push({
      id: "otherTask",
      type: "text",
      prompt: options.otherTaskPrompt ?? "Beskriv hva du prøvde å gjøre",
      required: false,
      maxLength: 500,
      visibleIf: { questionId: "task", operator: "EQ", value: "other" },
    });
  }
  questions.push({
    id: "taskSuccess",
    type: "singleChoice",
    prompt: options.successPrompt ?? "Klarte du det?",
    options: [
      { value: "yes", label: "Ja" },
      { value: "partial", label: "Delvis" },
      { value: "no", label: "Nei" },
    ],
    required: true,
  });
  if (options.includeBlockerQuestion !== false) {
    questions.push({
      id: "blocker",
      type: "text",
      prompt: options.blockerPrompt ?? "Hva hindret deg?",
      required: false,
      maxLength: 500,
      visibleIf: {
        all: [
          { questionId: "taskSuccess", operator: "EXISTS" },
          { questionId: "taskSuccess", operator: "NEQ", value: "yes" },
        ],
      },
    });
  }
  return questions;
}

function createTopTasksDocumentQuestions(
  options: TopTasksSurveyOptions,
): LumiSurveyQuestion[] {
  assertTaskOptions(options.tasks, "Top Tasks");
  if (
    options.includeOtherTask &&
    options.tasks.some((task) => task.value === "other")
  ) {
    throw new Error(
      'Lumi: Top Tasks reserves the task value "other" when includeOtherTask is enabled',
    );
  }
  const taskOptions = options.includeOtherTask
    ? [...options.tasks, { value: "other", label: "Noe annet" }]
    : options.tasks;

  const questions: LumiSurveyQuestion[] = [
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.task,
      type: "singleChoice",
      prompt: options.taskPrompt ?? "Hva prøvde du å gjøre i dag?",
      options: taskOptions,
      required: true,
    },
  ];

  // otherTask comes before success (shown only when task === "other")
  if (options.includeOtherTask) {
    questions.push({
      id: "otherTask",
      type: "text",
      prompt: options.otherTaskPrompt ?? "Beskriv hva du prøvde å gjøre",
      required: false,
      maxLength: 500,
      visibleIf: {
        questionId: SPECIALIZED_SURVEY_FIELD_IDS.task,
        operator: "EQ",
        value: "other",
      },
    });
  }

  // success with branching to skip blocker if "yes"
  questions.push({
    id: SPECIALIZED_SURVEY_FIELD_IDS.success,
    type: "singleChoice",
    prompt: options.successPrompt ?? "Klarte du det?",
    options: [
      { value: "yes", label: "Ja" },
      { value: "partial", label: "Delvis" },
      { value: "no", label: "Nei" },
    ],
    required: true,
  });

  // blocker (shown only when success !== "yes")
  if (options.includeBlockerQuestion !== false) {
    questions.push({
      id: SPECIALIZED_SURVEY_FIELD_IDS.blocker,
      type: "text",
      prompt: options.blockerPrompt ?? "Hva hindret deg?",
      required: false,
      maxLength: 500,
      visibleIf: {
        all: [
          {
            questionId: SPECIALIZED_SURVEY_FIELD_IDS.success,
            operator: "EXISTS",
          },
          {
            questionId: SPECIALIZED_SURVEY_FIELD_IDS.success,
            operator: "NEQ",
            value: "yes",
          },
        ],
      },
    });
  }

  return questions;
}

/** Options shared by the legacy and page-based Task Priority builders. */
export interface TaskPrioritySurveyOptions {
  prompt?: string;
  /** Stable task identities (`value`) and their user-facing wording (`label`). At least two are required by the document builder. */
  tasks: Array<{ value: string; label: string }>;
  /** Number of tasks a user may select. Defaults to `min(5, tasks.length)` and must be between 1 and the task count. */
  maxSelections?: number;
  /** Randomizes the displayed order. Defaults to true. */
  randomize?: boolean;
  /**
   * Display variant for the task selection.
   * - "combobox": Searchable dropdown with chips (default, recommended for 10+ tasks)
   * - "checkbox": Traditional checkbox list
   */
  variant?: "checkbox" | "combobox";
}

/**
 * Creates a Task Priority survey for ranking which tasks matter most.
 * Classic McGovern methodology: users select their top N tasks from a list.
 *
 * @deprecated Use `createTaskPrioritySurveyDocument` for new surveys.
 *
 * Note: Tasks must be provided as they are domain-specific.
 * There is no DEFAULT_SURVEY_TASK_PRIORITY since tasks vary per application.
 *
 * @param options.tasks - Full list of tasks (20-50 recommended)
 * @param options.maxSelections - How many to select (default: 5)
 * @param options.randomize - Randomize order (default: true, critical for validity)
 *
 * @example
 * ```tsx
 * const survey = createTaskPrioritySurvey({
 *   tasks: [
 *     { value: "apply", label: "Søke om sykepenger" },
 *     { value: "status", label: "Sjekke status" },
 *     // ... 20-50 tasks
 *   ]
 * });
 * ```
 */
export function createTaskPrioritySurvey(
  options: TaskPrioritySurveyOptions,
): LumiSurveyConfig {
  return {
    type: "taskPriority",
    questions: createLegacyTaskPriorityQuestions(options),
  };
}

function createLegacyTaskPriorityQuestions(
  options: TaskPrioritySurveyOptions,
): LumiSurveyQuestion[] {
  const maxSelections =
    options.maxSelections ?? Math.min(5, options.tasks.length);
  return [
    {
      id: "priorities",
      type: "multiChoice",
      prompt:
        options.prompt ??
        `Velg de ${maxSelections} viktigste oppgavene for deg`,
      options: options.tasks,
      required: true,
      randomize: options.randomize ?? true,
      variant: options.variant ?? "combobox",
      maxSelections,
    },
  ];
}

function createTaskPriorityDocumentQuestions(
  options: TaskPrioritySurveyOptions,
): LumiSurveyQuestion[] {
  assertTaskOptions(options.tasks, "Task Priority");
  if (options.tasks.length < 2) {
    throw new Error("Lumi: Task Priority requires at least two tasks");
  }
  const maxSelections =
    options.maxSelections ?? Math.min(5, options.tasks.length);
  if (!Number.isInteger(maxSelections) || maxSelections <= 0) {
    throw new Error(
      "Lumi: Task Priority maxSelections must be a positive integer",
    );
  }
  if (maxSelections > options.tasks.length) {
    throw new Error(
      "Lumi: Task Priority maxSelections cannot exceed the number of tasks",
    );
  }
  // Default to combobox for Task Priority (typically has many options)
  const variant = options.variant ?? "combobox";

  const questions: LumiSurveyQuestion[] = [
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.priority,
      type: "multiChoice",
      prompt: options.prompt ?? "Hvilke oppgaver er viktigst for deg?",
      options: options.tasks,
      required: true,
      randomize: options.randomize ?? true,
      variant,
      maxSelections,
    },
  ];

  return questions;
}

function createSurveyDocument(
  type: NonNullable<SurveyDocumentV1["type"]>,
  questions: LumiSurveyQuestion[],
): SurveyDocumentV1 {
  const [firstQuestion, ...remainingQuestions] = questions;
  if (!firstQuestion) {
    throw new Error("Lumi: A survey template must contain a question");
  }
  const toPage = (question: LumiSurveyQuestion) => ({
    id: question.id,
    questions: [question] as [LumiSurveyQuestion],
  });
  return {
    authoringSchemaVersion: 1,
    type,
    pages: [
      toPage(firstQuestion),
      ...remainingQuestions.map(toPage),
    ] as SurveyDocumentV1["pages"],
  };
}

/**
 * Creates the recommended page-based Discovery survey document.
 * The fixed field IDs form the contract used by Lumi's Discovery analysis.
 */
export function createDiscoverySurveyDocument(
  options?: DiscoverySurveyOptions,
): SurveyDocumentV1 {
  return createSurveyDocument(
    "discovery",
    createDiscoveryDocumentQuestions(options),
  );
}

/** Recommended page-based Discovery survey with Lumi's default wording. */
export const DEFAULT_DISCOVERY_SURVEY_DOCUMENT =
  createDiscoverySurveyDocument();

/**
 * Creates the recommended page-based Top Tasks survey document.
 * Task choices are domain-specific and must be supplied by the consumer.
 */
export function createTopTasksSurveyDocument(
  options: TopTasksSurveyOptions,
): SurveyDocumentV1 {
  return createSurveyDocument(
    "topTasks",
    createTopTasksDocumentQuestions(options),
  );
}

/**
 * Creates the recommended page-based Task Priority survey document.
 * Task choices are domain-specific and must be supplied by the consumer.
 * Provide at least two tasks. `maxSelections` defaults to the smaller of five
 * and the number of tasks, and must stay between one and the task count.
 */
export function createTaskPrioritySurveyDocument(
  options: TaskPrioritySurveyOptions,
): SurveyDocumentV1 {
  return createSurveyDocument(
    "taskPriority",
    createTaskPriorityDocumentQuestions(options),
  );
}
