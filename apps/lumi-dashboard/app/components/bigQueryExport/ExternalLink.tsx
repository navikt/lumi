import { ExternalLinkIcon } from "@navikt/aksel-icons";
import { Button, type ButtonProps, Link } from "@navikt/ds-react";
import type { KeyboardEvent, ReactNode } from "react";

/** The icon also tells screen reader users that the link opens a new tab. */
function NewTabIcon() {
  return <ExternalLinkIcon title="åpnes i ny fane" />;
}

/** A text link that opens in a new tab. */
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} target="_blank" rel="noreferrer">
      {children} <NewTabIcon />
    </Link>
  );
}

function keepLinkKeyboardSemantics(event: KeyboardEvent<HTMLElement>) {
  // Aksel Button adds Space activation when rendered as another element.
  // A link opens with Enter only.
  if (event.key === " ") event.preventDefault();
}

/**
 * A link that looks like a button and opens in a new tab. Aksel gives
 * `as="a"` the role button, so set it back to link, as the header does.
 */
export function ExternalLinkButton({
  href,
  variant = "secondary",
  children,
}: {
  href: string;
  variant?: ButtonProps["variant"];
  children: ReactNode;
}) {
  return (
    <Button
      as="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      role="link"
      onKeyUp={keepLinkKeyboardSemantics}
      variant={variant}
      size="small"
      icon={<NewTabIcon />}
      iconPosition="right"
    >
      {children}
    </Button>
  );
}
