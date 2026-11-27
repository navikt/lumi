import { BodyLong, BodyShort, Box, Heading, VStack } from "@navikt/ds-react";
import { type ReactNode, useContext, useMemo, useState } from "react";
import {
  LumiSurveyInline,
  type LumiSurveyInlineProps,
} from "../components/LumiSurveyInline";
import type {
  LumiSurveySubmission,
  LumiSurveyTransport,
} from "../core/types.js";
import { ExampleStoryInfoContext } from "./LumiSurveyDockExamplePage";
import "./LumiSurveyInlineExamplePage.css";
import { CodePreview } from "./SurveyCodePreview";

type Layout = "under" | "column" | "repeated";

interface InlineExamplePageProps extends LumiSurveyInlineProps {
  /** Where the example page places the survey. */
  layout?: Layout;
  /** Width of the column in the "column" layout, as a CSS value. */
  columnWidth?: string;
  /** The JSX shown in the code panel. */
  sourceCode: string;
}

/** Stands in for the app's own content. Nothing in it is part of Lumi. */
const HostContent = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Box
    padding="space-20"
    background="default"
    borderRadius="12"
    borderWidth="1"
    borderColor="neutral-subtle"
  >
    <VStack gap="space-8">
      <Heading level="2" size="small">
        {title}
      </Heading>
      {children}
    </VStack>
  </Box>
);

const ExampleNote = ({ children }: { children: ReactNode }) => (
  <BodyShort size="small" className="lumi-storybook-inline-page__muted">
    {children}
  </BodyShort>
);

const Calculator = () => (
  <HostContent title="Kalkulator">
    <BodyLong>Her står resultatet brukeren har regnet ut.</BodyLong>
    <ExampleNote>
      Eksempelinnhold fra appen. Surveyen under spør om denne kalkulatoren.
    </ExampleNote>
  </HostContent>
);

const ARTICLES = [
  { placement: "artikkel-1", title: "Første artikkel" },
  { placement: "artikkel-2", title: "Andre artikkel" },
] as const;

/**
 * A page from an app with the survey placed in its content. The dock example
 * page shows the survey floating above the page; this one shows it as a part
 * of the page.
 */
export const InlineExamplePage = ({
  layout = "under",
  columnWidth = "16rem",
  sourceCode,
  ...props
}: InlineExamplePageProps) => {
  const storyInfo = useContext(ExampleStoryInfoContext);
  const [lastSubmission, setLastSubmission] = useState<LumiSurveySubmission>();

  const previewTransport = useMemo<LumiSurveyTransport>(
    () => ({
      async submit(submission, options) {
        // The preview shows the payload. An `{ endpoint }` transport has no
        // backend in Storybook, so it is not called.
        const inner = props.transport;
        if ("submit" in inner && typeof inner.submit === "function") {
          await inner.submit(submission, options);
        }
        setLastSubmission(submission);
      },
    }),
    [props.transport],
  );

  const survey = <LumiSurveyInline {...props} transport={previewTransport} />;

  return (
    <div className="lumi-storybook-inline-page">
      <div className="lumi-storybook-inline-page__intro">
        <Heading level="1" size="medium">
          {storyInfo.name}
        </Heading>
        <BodyLong>{storyInfo.description}</BodyLong>
      </div>

      {layout === "under" && (
        <div className="lumi-storybook-inline-page__main">
          <Calculator />
          {survey}
        </div>
      )}

      {layout === "column" && (
        <div className="lumi-storybook-inline-page__columns">
          <div className="lumi-storybook-inline-page__main">
            <HostContent title="Oversikt">
              <BodyLong>Her står oversikten brukeren kom for å se.</BodyLong>
              <ExampleNote>
                Eksempelinnhold fra appen. Surveyen står i kolonnen ved siden
                av.
              </ExampleNote>
            </HostContent>
          </div>
          <div
            className="lumi-storybook-inline-page__column"
            style={{ width: columnWidth }}
          >
            {survey}
          </div>
        </div>
      )}

      {layout === "repeated" && (
        <div className="lumi-storybook-inline-page__main">
          {ARTICLES.map((article) => (
            <VStack key={article.placement} gap="space-8">
              <HostContent title={article.title}>
                <BodyLong>Her står teksten i artikkelen.</BodyLong>
                <ExampleNote>Eksempelinnhold fra appen.</ExampleNote>
              </HostContent>
              <LumiSurveyInline
                {...props}
                transport={previewTransport}
                context={{
                  ...props.context,
                  tags: {
                    ...props.context?.tags,
                    placement: article.placement,
                  },
                }}
              />
            </VStack>
          ))}
        </div>
      )}

      <div className="lumi-storybook-inline-page__code">
        <CodePreview
          code={sourceCode}
          title="Slik legger appen inn surveyen"
          badge="LumiSurveyInline"
          tone="current"
        />
        {lastSubmission && (
          <CodePreview
            code={JSON.stringify(lastSubmission.transportPayload, null, 2)}
            title="Siste innsending"
            badge="schemaVersion 2"
            note="Samme transport-payload som fra LumiSurveyDock. context.tags viser hvor på siden svaret kom fra."
            tone="payload"
          />
        )}
      </div>
    </div>
  );
};
