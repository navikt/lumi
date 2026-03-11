import { XMarkIcon } from "@navikt/aksel-icons";
import { Button } from "@navikt/ds-react";

export const CloseButton = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) => (
  <Button
    data-color="neutral"
    variant="tertiary"
    size="small"
    icon={<XMarkIcon aria-hidden />}
    onClick={onClick}
    aria-label={label}
    style={{
      borderRadius: "50%",
      width: "32px",
      height: "32px",
      minWidth: "32px",
      padding: 0,
      flexShrink: 0,
    }}
  />
);
