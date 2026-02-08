// Import Aksel Darkside styles (supports light/dark mode)
import akselStyles from "@navikt/ds-css?url";
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
import globalStyles from "~/styles/global.css?url";

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
      { rel: "stylesheet", href: akselStyles },
      { rel: "stylesheet", href: globalStyles },
      {
        rel: "icon",
        type: "image/png",
        href: lumiLogo,
      },
    ],
  }),
  component: RootComponent,
  errorComponent: ErrorComponent,
});

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
  const nonce = (() => {
    const routerNonce = router.options.ssr?.nonce;
    if (routerNonce) {
      return routerNonce;
    }

    if (typeof document === "undefined") {
      return undefined;
    }

    const metaNonce = document
      .querySelector('meta[property="csp-nonce"]')
      ?.getAttribute("content");

    return metaNonce || undefined;
  })();

  // Use window.__theme as fallback during initial client render to prevent FOUC
  // The blocking script sets this variable before React loads
  const effectiveTheme =
    theme ?? (typeof window !== "undefined" ? window.__theme : undefined);

  return (
    <html lang="no" suppressHydrationWarning>
      <head>
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
        <Theme
          theme={effectiveTheme}
          hasBackground={false}
          className="app-theme-root"
        >
          {children}
        </Theme>
        <Scripts />
      </body>
    </html>
  );
}
