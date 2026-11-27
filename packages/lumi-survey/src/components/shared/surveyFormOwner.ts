import { createContext, useContext } from "react";

const SurveyFormlessContext = createContext(false);

/** Tells the fields that the survey has no `<form>` of its own. */
export const SurveyFormlessProvider = SurveyFormlessContext.Provider;

const NO_FORM_OWNER = { form: "" } as const;
const OWN_FORM = {} as const;

/**
 * Props that set the form owner of a survey field. A survey without a
 * `<form>` of its own can be in a form the app owns. A `form` attribute that
 * names no form gives its fields no form owner, so the app's `FormData`,
 * `form.reset()` and Enter in the app's fields leave the survey alone. In a
 * survey with its own form, Enter in a field sends the answers.
 */
export const useFieldFormOwner = (): { form?: string } =>
  useContext(SurveyFormlessContext) ? NO_FORM_OWNER : OWN_FORM;
