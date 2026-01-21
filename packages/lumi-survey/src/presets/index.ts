import type { LumiSurveyConfig } from "../components/surveyTypes.js";
import type {
  EmojiRatingQuestion,
  LumiSurveyQuestion,
  NpsRatingQuestion,
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
      description:
        "Svarene du sender inn er anonyme, og blir brukt til videreutvikling av tjenesten",
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
 * Emphasizes that feedback is anonymous and used for service development.
 */
export const DEFAULT_SURVEY_SERVICE_FEEDBACK: LumiSurveyConfig = {
  type: "rating",
  questions: [
    {
      id: "rating",
      type: "rating",
      variant: "emoji",
      prompt: "Hvordan opplevde du å svare på spørsmålene?",
      description:
        "Svarene du sender inn er anonyme, og blir brukt til videreutvikling av tjenesten",
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
      description:
        "Svarene du sender inn er anonyme, og blir brukt til videreutvikling av tjenesten",
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
  questions: [
    {
      id: "discoveredTask",
      type: "text",
      prompt: "Hva kom du hit for å gjøre i dag?",
      placeholder: "Beskriv med dine egne ord...",
      required: true,
      minRows: 2,
      maxLength: 500,
    } as LumiSurveyQuestion,
    {
      id: "taskSuccess",
      type: "singleChoice",
      prompt: "Fikk du gjort det?",
      options: [
        { value: "yes", label: "Ja" },
        { value: "partial", label: "Delvis" },
        { value: "no", label: "Nei" },
      ],
      required: true,
    } as LumiSurveyQuestion,
    {
      id: "blocker",
      type: "text",
      prompt: "Hva hindret deg?",
      required: false,
      maxLength: 500,
    } as LumiSurveyQuestion,
  ],
};

// ============================================
// Survey Builder Functions
// ============================================

/**
 * Creates a rating survey with customizable prompts.
 * Follow-up questions are automatically hidden until the rating is answered.
 */
export function createRatingSurvey(options: {
  ratingPrompt: string;
  ratingDescription?: string;
  followUpQuestions?: LumiSurveyQuestion[];
}): LumiSurveyConfig {
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

  return {
    type: "rating",
    questions,
  };
}

/**
 * Creates a Discovery survey for free-text task identification.
 * Use this to discover what tasks users come to your site for.
 */
export function createDiscoverySurvey(options?: {
  taskPrompt?: string;
  taskPlaceholder?: string;
  successPrompt?: string;
  blockerPrompt?: string;
  includeBlockerQuestion?: boolean;
}): LumiSurveyConfig {
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

  return {
    type: "discovery",
    questions,
  };
}

/**
 * Creates a Top Tasks survey for measuring task completion success.
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
export function createTopTasksSurvey(options: {
  taskPrompt?: string;
  tasks: Array<{ value: string; label: string }>;
  successPrompt?: string;
  blockerPrompt?: string;
  includeBlockerQuestion?: boolean;
  includeOtherTask?: boolean;
  otherTaskPrompt?: string;
}): LumiSurveyConfig {
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
      // If NOT "other", skip the next question (otherTask) and go to taskSuccess
      logic: options.includeOtherTask
        ? [
            {
              condition: { field: "ANSWER", operator: "NEQ", value: "other" },
              action: { type: "SKIP" },
            },
          ]
        : undefined,
    },
  ];

  // otherTask comes BEFORE taskSuccess (shown only when task === "other")
  if (options.includeOtherTask) {
    questions.push({
      id: "otherTask",
      type: "text",
      prompt: options.otherTaskPrompt ?? "Beskriv hva du prøvde å gjøre",
      required: false,
      maxLength: 500,
    });
  }

  // taskSuccess with branching to skip blocker if "yes"
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
    // If "yes", submit immediately (skip blocker)
    logic:
      options.includeBlockerQuestion !== false
        ? [
            {
              condition: { field: "ANSWER", operator: "EQ", value: "yes" },
              action: { type: "SUBMIT" },
            },
          ]
        : undefined,
  });

  // blocker (shown only when taskSuccess !== "yes")
  if (options.includeBlockerQuestion !== false) {
    questions.push({
      id: "blocker",
      type: "text",
      prompt: options.blockerPrompt ?? "Hva hindret deg?",
      required: false,
      maxLength: 500,
    });
  }

  return {
    type: "topTasks",
    questions,
  };
}

/**
 * Creates a Task Priority survey for ranking which tasks matter most.
 * Classic McGovern methodology: users select their top N tasks from a list.
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
export function createTaskPrioritySurvey(options: {
  prompt?: string;
  tasks: Array<{ value: string; label: string }>;
  maxSelections?: number;
  randomize?: boolean;
  /**
   * Display variant for the task selection.
   * - "combobox": Searchable dropdown with chips (default, recommended for 10+ tasks)
   * - "checkbox": Traditional checkbox list
   */
  variant?: "checkbox" | "combobox";
}): LumiSurveyConfig {
  const maxSelections = options.maxSelections ?? 5;
  // Default to combobox for Task Priority (typically has many options)
  const variant = options.variant ?? "combobox";

  const questions: LumiSurveyQuestion[] = [
    {
      id: "priorities",
      type: "multiChoice",
      prompt:
        options.prompt ??
        `Velg de ${maxSelections} viktigste oppgavene for deg`,
      options: options.tasks,
      required: true,
      randomize: options.randomize ?? true,
      variant,
      maxSelections,
    },
  ];

  return {
    type: "taskPriority",
    questions,
  };
}
