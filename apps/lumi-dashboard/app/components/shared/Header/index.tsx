import {
  BarChartIcon,
  DownloadIcon,
  PencilWritingIcon,
  TableIcon,
} from "@navikt/aksel-icons";
import { Box, Button, type ButtonProps, Hide, HStack } from "@navikt/ds-react";
import { createLink, Link, useLocation } from "@tanstack/react-router";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  type KeyboardEvent,
  type Ref,
} from "react";
import lumiLogo from "~/assets/lumi.png";
import { ThemeToggle } from "~/components/shared/ThemeToggle";
import styles from "./Header.module.css";

function keepLinkKeyboardSemantics(event: KeyboardEvent<HTMLAnchorElement>) {
  // Aksel Button adds Space activation when rendered as another component.
  // These controls navigate, so keep native link behaviour (Enter only).
  if (event.key === " ") {
    event.preventDefault();
  }
}

type ButtonAnchorProps = ComponentPropsWithoutRef<"a"> &
  Pick<ButtonProps, "variant" | "size" | "icon" | "iconPosition">;

// Aksel supports `as="a"` at runtime, but ButtonProps pins DOM event types to
// HTMLButtonElement. Keep that type bridge local to the custom-link adapter.
const AkselAnchorButton = Button as unknown as (
  props: ButtonAnchorProps & { as: "a"; ref?: Ref<HTMLAnchorElement> },
) => ReturnType<typeof Button>;

const ButtonAnchor = forwardRef<HTMLAnchorElement, ButtonAnchorProps>(
  function ButtonAnchor(props, ref) {
    return (
      <AkselAnchorButton
        as="a"
        {...props}
        ref={ref}
        role="link"
        onKeyUp={keepLinkKeyboardSemantics}
      />
    );
  },
);

const HeaderNavLink = createLink(ButtonAnchor);

export function Header() {
  const logoHeight = 32;
  // `lumi.png` is 1920x1080 (16:9). Keep the correct intrinsic ratio to avoid layout shift.
  const logoWidth = Math.round((logoHeight * 1920) / 1080);
  const location = useLocation();
  const currentPath = location.pathname;

  // Helper to determine button variant based on active path
  const getVariant = (path: string) => {
    if (path === "/") {
      return currentPath === "/" ? "primary" : "tertiary";
    }
    return currentPath.startsWith(path) ? "primary" : "tertiary";
  };

  return (
    <Box
      paddingInline={{ xs: "space-12", sm: "space-16" }}
      background="raised"
      borderWidth="0 0 1 0"
      borderColor="neutral-subtle"
      as="header"
    >
      <HStack
        justify="space-between"
        align="center"
        gap={{ xs: "space-8", md: "space-16" }}
        className={styles.inner}
      >
        {/* Logo and title */}
        <Link
          to="/"
          search={{}}
          aria-label="Lumi Dashboard - gå til forsiden"
          className={styles.brandLink}
        >
          <img
            src={lumiLogo}
            alt=""
            width={logoWidth}
            height={logoHeight}
            className={styles.logo}
          />
          {/* Hide title text on very small screens */}
          <Hide below="sm" asChild>
            <span>Lumi Dashboard</span>
          </Hide>
        </Link>

        {/* Navigation */}
        <HStack gap={{ xs: "space-4", sm: "space-8", md: "space-16" }}>
          <nav aria-label="Hovedmeny">
            <HStack gap={{ xs: "space-4", sm: "space-8", md: "space-16" }}>
              <HeaderNavLink
                to="/"
                search={(prev) => prev}
                variant={getVariant("/")}
                size="small"
                aria-label="Dashboard"
                icon={<BarChartIcon aria-hidden />}
              >
                {/* Hide button text on mobile, show on tablet+ */}
                <Hide below="md" asChild>
                  <span>Dashboard</span>
                </Hide>
              </HeaderNavLink>
              <HeaderNavLink
                to="/feedback"
                search={(prev) => prev}
                variant={getVariant("/feedback")}
                size="small"
                aria-label="Tilbakemeldinger"
                icon={<TableIcon aria-hidden />}
              >
                <Hide below="md" asChild>
                  <span>Tilbakemeldinger</span>
                </Hide>
              </HeaderNavLink>
              <HeaderNavLink
                to="/export"
                search={(prev) => prev}
                variant={getVariant("/export")}
                size="small"
                aria-label="Eksporter"
                icon={<DownloadIcon aria-hidden />}
              >
                <Hide below="md" asChild>
                  <span>Eksporter</span>
                </Hide>
              </HeaderNavLink>
              <HeaderNavLink
                to="/surveyverksted"
                search={{}}
                variant={getVariant("/surveyverksted")}
                size="small"
                aria-label="Surveyverksted"
                icon={<PencilWritingIcon aria-hidden />}
              >
                <Hide below="md" asChild>
                  <span>Surveyverksted</span>
                </Hide>
              </HeaderNavLink>
            </HStack>
          </nav>

          {/* Divider - hide on very small screens */}
          <Hide below="sm">
            <div className={styles.divider} />
          </Hide>

          <ThemeToggle />
        </HStack>
      </HStack>
    </Box>
  );
}
