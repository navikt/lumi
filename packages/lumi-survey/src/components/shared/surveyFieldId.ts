import { createContext, useContext, useMemo } from "react";

/** Makes the DOM id of one part of the field of a question. */
export type SurveyFieldIdFactory = (questionId: string, part: string) => string;

/**
 * Makes the ids and names of a survey's form fields. Undefined in the dock,
 * where Aksel makes them as it always has.
 */
const SurveyFieldIdContext = createContext<SurveyFieldIdFactory | undefined>(
  undefined,
);

export const SurveyFieldIdProvider = SurveyFieldIdContext.Provider;

/**
 * Makes the id of one part of a question's field: the field itself, its
 * error message, one of its options.
 */
export type SurveyFieldIds = (part: string) => string;

/**
 * Ids for the field of a question that are unique in the whole document, or
 * undefined where the field should make its own.
 *
 * Aksel builds field ids with React's `useId`, which counts from the start in
 * every copy of React. Two apps on one page that each bundle React, such as
 * microfrontends, then give their fields the same ids and radio names, and a
 * click on a label in one survey answers the other. An inline survey can be
 * one of several on a page, so it names its fields itself.
 */
export const useSurveyFieldIds = (
  questionId: string,
): SurveyFieldIds | undefined => {
  const makeId = useContext(SurveyFieldIdContext);
  return useMemo(
    () =>
      makeId === undefined
        ? undefined
        : (part: string) => makeId(questionId, part),
    [makeId, questionId],
  );
};
