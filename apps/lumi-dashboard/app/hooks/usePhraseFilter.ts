import { useSearchParams } from "~/hooks/useSearchParams";
import {
  type PhraseFilterValue,
  parsePhraseParam,
  stringifyPhraseFilter,
} from "~/utils/phraseFilterUtils";

export function usePhraseFilter() {
  const { params, setParams } = useSearchParams();
  const activeFilter: PhraseFilterValue | null = parsePhraseParam(
    params.phrase,
  );

  const setPhrase = (fieldId: string, surface: string) => {
    setParams({
      phrase: stringifyPhraseFilter(fieldId, surface),
      query: undefined,
      page: "1",
    });
  };

  const removePhrase = () => {
    setParams({
      phrase: undefined,
      page: "1",
    });
  };

  return {
    activeFilter,
    setPhrase,
    removePhrase,
  };
}
