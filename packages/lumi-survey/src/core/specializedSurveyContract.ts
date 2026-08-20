import type { LumiSurveyQuestionType, SurveyType } from "./types";

export interface SpecializedSurveyContractIssue {
  fieldId: string;
  message: string;
}

export const SPECIALIZED_SURVEY_FIELD_IDS = {
  task: "task",
  success: "success",
  blocker: "blocker",
  priority: "priority",
} as const;

/** Field IDs emitted by the deprecated flat builders through version 2.0.1. */
export const LEGACY_SPECIALIZED_SURVEY_FIELD_IDS = {
  discoveryTask: "discoveredTask",
  success: "taskSuccess",
  priority: "priorities",
} as const;

interface RequiredField {
  id: string;
  type: LumiSurveyQuestionType;
  optional?: boolean;
  optionIds?: readonly string[];
}

interface SurveyContractQuestion {
  id: string;
  type: LumiSurveyQuestionType;
  required?: boolean;
  options?: readonly { value: string }[];
  visibleIf?: unknown;
  maxSelections?: number;
}

const outcomeOptionIds = ["yes", "partial", "no"] as const;

const contractNames = {
  discovery: "Hva kom brukeren for å gjøre?",
  topTasks: "Lyktes brukeren med en kjent oppgave?",
  taskPriority: "Hvilke oppgaver er viktigst?",
} as const;

const contracts: Partial<Record<SurveyType, readonly RequiredField[]>> = {
  discovery: [
    { id: SPECIALIZED_SURVEY_FIELD_IDS.task, type: "text" },
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.success,
      type: "singleChoice",
      optionIds: outcomeOptionIds,
    },
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.blocker,
      type: "text",
      optional: true,
    },
  ],
  topTasks: [
    { id: SPECIALIZED_SURVEY_FIELD_IDS.task, type: "singleChoice" },
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.success,
      type: "singleChoice",
      optionIds: outcomeOptionIds,
    },
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.blocker,
      type: "text",
      optional: true,
    },
  ],
  taskPriority: [
    { id: SPECIALIZED_SURVEY_FIELD_IDS.priority, type: "multiChoice" },
  ],
};

const legacyContracts: Partial<Record<SurveyType, readonly RequiredField[]>> = {
  discovery: [
    { id: LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.discoveryTask, type: "text" },
    {
      id: LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.success,
      type: "singleChoice",
      optionIds: outcomeOptionIds,
    },
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.blocker,
      type: "text",
      optional: true,
    },
  ],
  topTasks: [
    { id: SPECIALIZED_SURVEY_FIELD_IDS.task, type: "singleChoice" },
    {
      id: LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.success,
      type: "singleChoice",
      optionIds: outcomeOptionIds,
    },
    {
      id: SPECIALIZED_SURVEY_FIELD_IDS.blocker,
      type: "text",
      optional: true,
    },
  ],
  taskPriority: [
    {
      id: LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.priority,
      type: "multiChoice",
    },
  ],
};

/**
 * Checks the fixed fields that Lumi's specialized dashboards read.
 * Extra questions are allowed; missing or repurposed contract fields are not.
 */
export function getSpecializedSurveyContractIssues(
  surveyType: SurveyType,
  questions: readonly SurveyContractQuestion[],
  options: { allowLegacyFieldIds?: boolean } = {},
): SpecializedSurveyContractIssue[] {
  const canonicalContract = contracts[surveyType];
  if (!canonicalContract) return [];
  const contractName = contractNames[surveyType as keyof typeof contractNames];

  const questionsById = new Map(
    questions.map((question) => [question.id, question]),
  );
  if (options.allowLegacyFieldIds) {
    const aliasPairs: Array<readonly [string, string]> = [];
    if (surveyType === "discovery") {
      aliasPairs.push([
        SPECIALIZED_SURVEY_FIELD_IDS.task,
        LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.discoveryTask,
      ]);
    }
    if (surveyType === "discovery" || surveyType === "topTasks") {
      aliasPairs.push([
        SPECIALIZED_SURVEY_FIELD_IDS.success,
        LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.success,
      ]);
    }
    if (surveyType === "taskPriority") {
      aliasPairs.push([
        SPECIALIZED_SURVEY_FIELD_IDS.priority,
        LEGACY_SPECIALIZED_SURVEY_FIELD_IDS.priority,
      ]);
    }
    const duplicateAlias = aliasPairs.find(
      ([canonical, legacy]) =>
        questionsById.has(canonical) && questionsById.has(legacy),
    );
    if (duplicateAlias) {
      return [
        {
          fieldId: duplicateAlias[0],
          message: `Oppsettet kan ikke inneholde både «${duplicateAlias[0]}» og den eldre ID-en «${duplicateAlias[1]}».`,
        },
      ];
    }
  }
  const legacyContract = legacyContracts[surveyType];
  const hasEveryRequiredField = (candidate: readonly RequiredField[]) =>
    candidate.every(
      (required) => required.optional || questionsById.has(required.id),
    );
  const contract =
    options.allowLegacyFieldIds &&
    legacyContract &&
    !hasEveryRequiredField(canonicalContract) &&
    hasEveryRequiredField(legacyContract)
      ? legacyContract
      : canonicalContract;
  const usesLegacyContract = contract === legacyContract;

  const issues = contract.flatMap((required) => {
    const question = questionsById.get(required.id);
    if (!question) {
      if (required.optional) return [];
      return [
        {
          fieldId: required.id,
          message: `Oppsettet «${contractName}» trenger spørsmålet «${required.id}».`,
        },
      ];
    }
    if (question.type !== required.type) {
      return [
        {
          fieldId: required.id,
          message: `Spørsmålet «${required.id}» har feil type for oppsettet «${contractName}».`,
        },
      ];
    }
    if (required.optionIds) {
      const actualOptionIds =
        question.options?.map((option) => option.value) ?? [];
      const expectedOptionIds = new Set(required.optionIds);
      const actualOptionIdSet = new Set(actualOptionIds);
      if (
        actualOptionIds.length !== expectedOptionIds.size ||
        actualOptionIdSet.size !== expectedOptionIds.size ||
        actualOptionIds.some((optionId) => !expectedOptionIds.has(optionId))
      ) {
        return [
          {
            fieldId: required.id,
            message: `Spørsmålet «${required.id}» må ha nøyaktig svarene Ja, Delvis og Nei for oppsettet «${contractName}».`,
          },
        ];
      }
    }
    if (!required.optional && question.required !== true) {
      return [
        {
          fieldId: required.id,
          message: `Spørsmålet «${required.id}» må være merket «Må besvares» for oppsettet «${contractName}».`,
        },
      ];
    }
    if (!required.optional && question.visibleIf !== undefined) {
      return [
        {
          fieldId: required.id,
          message: `Spørsmålet «${required.id}» må alltid vises i oppsettet «${contractName}».`,
        },
      ];
    }
    return [];
  });

  if (surveyType === "taskPriority" && !usesLegacyContract) {
    const priorityFieldId = contract.find(
      (field) => field.type === "multiChoice" && !field.optional,
    )?.id;
    const priority = priorityFieldId
      ? questionsById.get(priorityFieldId)
      : undefined;
    if (priority?.type === "multiChoice") {
      const optionCount = priority.options?.length ?? 0;
      if (optionCount < 2) {
        issues.push({
          fieldId: priority.id,
          message:
            "Oppsettet «Hvilke oppgaver er viktigst?» trenger minst to oppgaver å velge mellom.",
        });
      }
      if (
        !Number.isInteger(priority.maxSelections) ||
        (priority.maxSelections ?? 0) < 1 ||
        (priority.maxSelections ?? 0) > optionCount
      ) {
        issues.push({
          fieldId: priority.id,
          message:
            "Antallet brukeren kan velge må være mellom 1 og antallet oppgaver i listen.",
        });
      }
    }
  }

  return issues;
}

export function assertSpecializedSurveyContract(
  surveyType: SurveyType,
  questions: readonly SurveyContractQuestion[],
  options: { allowLegacyFieldIds?: boolean } = {},
): void {
  const [firstIssue] = getSpecializedSurveyContractIssues(
    surveyType,
    questions,
    options,
  );
  if (firstIssue) {
    throw new Error(`Lumi: ${firstIssue.message}`);
  }
}
