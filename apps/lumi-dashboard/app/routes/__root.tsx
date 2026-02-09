// Import Aksel and global styles as regular CSS so they are emitted as manifest assets.
import "@navikt/ds-css";
import { Alert, BodyShort, Heading } from "@navikt/ds-react";
import { Theme } from "@navikt/ds-react/Theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import type * as React from "react";
import { useState } from "react";
import lumiLogo from "~/assets/lumi.png";
import { ErrorComponent } from "~/components/shared/ErrorComponent";
import { THEME_INIT_SCRIPT } from "~/config/themeInit";
import { ThemeProvider, useTheme } from "~/context/ThemeContext";
import "~/styles/global.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "robots", content: "noindex" },
      { title: "Lumi Dashboard" },
      {
        name: "description",
        content: "Analytics dashboard for Lumi feedback and surveys.",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        href: lumiLogo,
      },
    ],
  }),
  component: RootComponent,
  errorComponent: ErrorComponent,
  notFoundComponent: RootNotFoundComponent,
});

function RootNotFoundComponent() {
  return (
    <Alert variant="info" className="m-4">
      <Heading spacing size="small" level="3">
        Siden finnes ikke
      </Heading>
      <BodyShort>Vi fant ikke siden du prøvde å åpne.</BodyShort>
    </Alert>
  );
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RootDocument>
          <Outlet />
        </RootDocument>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

declare global {
  interface Window {
    __theme?: "light" | "dark";
  }
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const router = useRouter();
  const isServerRender = typeof document === "undefined";
  const nonce = isServerRender ? router.options.ssr?.nonce : undefined;

  return (
    <html lang="no" suppressHydrationWarning>
      <head>
        {isServerRender ? (
          <meta property="csp-nonce" content={nonce ?? ""} />
        ) : null}
        <script
          nonce={nonce}
          suppressHydrationWarning
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for theme init
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
        <HeadContent />
      </head>
      <body>
        <Theme theme={theme} hasBackground={false} className="app-theme-root">
          {children}
        </Theme>
        <Scripts />
      </body>
    </html>
  );
}
