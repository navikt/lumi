import { useSearchParams } from "~/hooks/useSearchParams";
import {
  parseChoiceParam,
  stringifyChoiceFilters,
} from "~/utils/choiceFilterUtils";

export function useChoiceFilter() {
  const { params, setParams } = useSearchParams();
  const activeFilters = parseChoiceParam(params.choice);

  const toggleChoice = (fieldId: string, optionId: string) => {
    const current = { ...activeFilters };
    if (current[fieldId] === optionId) {
      delete current[fieldId];
    } else {
      current[fieldId] = optionId;
    }

    setParams({
      choice: stringifyChoiceFilters(current),
      page: "1",
    });
  };

  const removeChoice = (fieldId: string) => {
    if (!(fieldId in activeFilters)) return;

    const current = { ...activeFilters };
    delete current[fieldId];

    setParams({
      choice: stringifyChoiceFilters(current),
      page: "1",
    });
  };

  const clearChoices = () => {
    setParams({ choice: undefined, page: "1" });
  };

  const isActive = (fieldId: string, optionId?: string): boolean => {
    if (optionId === undefined) {
      return fieldId in activeFilters;
    }
    return activeFilters[fieldId] === optionId;
  };

  return {
    activeFilters,
    hasFilters: Object.keys(activeFilters).length > 0,
    toggleChoice,
    removeChoice,
    clearChoices,
    isActive,
  };
}
