import { ErrorMessage } from "@navikt/ds-react";

interface RatingErrorMessageProps {
  id: string;
  isMissing: boolean;
  message: string;
  className?: string;
}

/**
 * Keeps the polite live region mounted so screen readers reliably announce a
 * validation message when it is added, matching Aksel's form-field pattern.
 */
export function RatingErrorMessage({
  id,
  isMissing,
  message,
  className,
}: RatingErrorMessageProps) {
  return (
    <div
      id={id}
      className="aksel-form-field__error"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {isMissing && (
        <ErrorMessage className={className} showIcon>
          {message}
        </ErrorMessage>
      )}
    </div>
  );
}
