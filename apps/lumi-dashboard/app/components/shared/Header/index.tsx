import { BarChartIcon, DownloadIcon, TableIcon } from "@navikt/aksel-icons";
import { Box, Button, Hide, HStack } from "@navikt/ds-react";
import { Link, useLocation } from "@tanstack/react-router";
import lumiLogo from "~/assets/lumi.png";
import { ThemeToggle } from "~/components/shared/ThemeToggle";

export function Header() {
  const logoHeight = 32;
  // `lumi.png` is 1920x1080 (16:9). Keep the correct intrinsic ratio to avoid layout shift.
  const logoWidth = Math.round((logoHeight * 1920) / 1080);
  const location = useLocation();
  const currentPath = location.pathname;

  const handleResetAndNavigate = () => {
    // Force navigation to root and clear search params
    window.location.href = "/";
  };

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
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          height: "64px",
        }}
      >
        {/* Logo and title */}
        <button
          type="button"
          onClick={handleResetAndNavigate}
          aria-label="Lumi Dashboard - gå til forsiden"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: 600,
            fontSize: "1.125rem",
            textDecoration: "none",
            color: "inherit",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <img
            src={lumiLogo}
            alt=""
            width={logoWidth}
            height={logoHeight}
            style={{ height: logoHeight, width: "auto", display: "block" }}
          />
          {/* Hide title text on very small screens */}
          <Hide below="sm" asChild>
            <span>Lumi Dashboard</span>
          </Hide>
        </button>

        {/* Navigation */}
        <HStack gap={{ xs: "space-4", sm: "space-8", md: "space-16" }}>
          <Link to="/" search={(prev) => prev}>
            <Button
              variant={getVariant("/")}
              size="small"
              icon={<BarChartIcon aria-hidden />}
            >
              {/* Hide button text on mobile, show on tablet+ */}
              <Hide below="md" asChild>
                <span>Dashboard</span>
              </Hide>
            </Button>
          </Link>
          <Link to="/feedback" search={(prev) => prev}>
            <Button
              variant={getVariant("/feedback")}
              size="small"
              icon={<TableIcon aria-hidden />}
            >
              <Hide below="md" asChild>
                <span>Tilbakemeldinger</span>
              </Hide>
            </Button>
          </Link>
          <Link to="/export" search={(prev) => prev}>
            <Button
              variant={getVariant("/export")}
              size="small"
              icon={<DownloadIcon aria-hidden />}
            >
              <Hide below="md" asChild>
                <span>Eksporter</span>
              </Hide>
            </Button>
          </Link>

          {/* Divider - hide on very small screens */}
          <Hide below="sm">
            <div
              style={{
                width: "1px",
                height: "32px",
                background: "var(--ax-border-neutral-subtle)",
              }}
            />
          </Hide>

          <ThemeToggle />
        </HStack>
      </HStack>
    </Box>
  );
}
