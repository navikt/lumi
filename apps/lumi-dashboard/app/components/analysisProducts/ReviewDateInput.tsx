import { DatePicker, useDatepicker } from "@navikt/ds-react";
import dayjs from "dayjs";
import { useState } from "react";

export function ReviewDateInput({
  initialValue,
  onChange,
  error,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [invalid, setInvalid] = useState(false);
  const { datepickerProps, inputProps } = useDatepicker({
    defaultSelected: initialValue ? dayjs(initialValue).toDate() : undefined,
    fromDate: dayjs().startOf("day").toDate(),
    toDate: dayjs().add(12, "month").toDate(),
    inputFormat: "dd.MM.yyyy",
    onDateChange: (date) =>
      onChange(date ? dayjs(date).format("YYYY-MM-DD") : ""),
    onValidate: (validation) =>
      setInvalid(
        !validation.isValidDate ||
          validation.isBefore ||
          validation.isAfter ||
          validation.isInvalid,
      ),
  });
  return (
    <DatePicker {...datepickerProps}>
      <DatePicker.Input
        {...inputProps}
        label="Dato for ny vurdering"
        description="Vurder behovet på nytt innen ett år. DD.MM.ÅÅÅÅ."
        required
        error={
          error ||
          (invalid
            ? "Velg en gyldig dato fra i dag og inntil ett år frem."
            : undefined)
        }
      />
    </DatePicker>
  );
}
