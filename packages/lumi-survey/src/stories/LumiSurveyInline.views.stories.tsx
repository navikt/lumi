import type { Meta, StoryObj } from "@storybook/react-vite";
import { type CSSProperties, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LumiSurveyInline } from "../components/LumiSurveyInline";
import type { SurveyDocumentV1 } from "../components/surveyTypes";
import { SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";
import { ShadowHost } from "./ShadowHost";
import "./LumiSurveyInline.views.stories.css";

interface ViewArgs {
  /** Height of the survey, in pixels. */
  height: number;
  /** How much a transform scales the scroll area or the iframe. */
  scale?: number;
  /** Height of the scroll area in its own pixels, before the transform. */
  area?: number;
  /** How the element around the survey hides it. */
  hide?: "visibility" | "opacity";
}

const DOCUMENT: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "rating",
  pages: [
    {
      id: "side",
      questions: [
        {
          id: "vurdering",
          type: "rating",
          variant: "emoji",
          prompt: "Hvor lett var det å bruke kalkulatoren?",
        },
      ],
    },
  ],
};

/** The browser tests read the number of views from the document element. */
const showViews = (views: number) => {
  document.documentElement.dataset.views = String(views);
};

/** A survey that shows the number of its views on the document element. */
const CountedSurvey = ({ panelClassName }: { panelClassName?: string }) => {
  const [views, setViews] = useState(0);
  useEffect(() => {
    showViews(views);
  }, [views]);

  return (
    <LumiSurveyInline
      surveyId="views"
      survey={DOCUMENT}
      transport={SUCCESS_TRANSPORT}
      headingLevel="3"
      style={panelClassName ? { panelClassName } : undefined}
      events={{ onViewDock: () => setViews((count) => count + 1) }}
    />
  );
};

/**
 * A survey of a given height. A survey with many questions is taller than
 * the viewport, and that is where counting a view is hard. The panel is what
 * is measured, so the panel is made tall.
 */
const TallSurvey = ({ height }: ViewArgs) => (
  <div
    style={{ "--lumi-storybook-survey-height": `${height}px` } as CSSProperties}
  >
    <CountedSurvey panelClassName="lumi-storybook-tall-survey" />
  </div>
);

const Spacer = ({ height }: { height: number }) => <div style={{ height }} />;

/**
 * The height of the survey where the stylesheet of the page does not reach:
 * in another document, or in a shadow tree.
 */
const HeightStyle = ({ height }: ViewArgs) => (
  <style>{`.lumi-storybook-tall-survey { min-height: ${height}px; }`}</style>
);

/**
 * Not in the Storybook menu. The browser tests in `e2e/` open these stories
 * and scroll the survey into view: the unit tests cannot tell what a browser
 * reports while an element moves.
 */
const meta: Meta<ViewArgs> = {
  title: "Tester/Inline visning",
  tags: ["!dev", "!autodocs"],
  parameters: { layout: "fullscreen" },
  args: { height: 1500 },
  argTypes: { height: { control: "number" } },
};

export default meta;
type Story = StoryObj<ViewArgs>;

/** The survey far down a page that scrolls. */
export const InPage: Story = {
  render: ({ height }) => (
    <>
      <Spacer height={1200} />
      <TallSurvey height={height} />
      <Spacer height={1200} />
    </>
  ),
};

/**
 * A survey of its own height beside a tall column in a flex row. The row
 * stretches the element around the survey to the height of the column,
 * and that empty space is no survey.
 */
export const BesideTallColumn: Story = {
  render: () => (
    <>
      <Spacer height={1000} />
      <div style={{ display: "flex", gap: 16 }}>
        <div data-tall-column style={{ flex: 1, height: 2000 }}>
          Innhold i en høy kolonne
        </div>
        <CountedSurvey />
      </div>
      <Spacer height={1000} />
    </>
  ),
};

/** The survey in a scroll area that is lower than the viewport. */
export const InScrollArea: Story = {
  render: ({ height }) => (
    <div data-scroll-area style={{ height: 660, overflowY: "auto" }}>
      <Spacer height={1000} />
      <TallSurvey height={height} />
      <Spacer height={1000} />
    </div>
  ),
};

/** The survey alone at the top of a page, to be shown in an iframe. */
export const InFrame: Story = {
  render: ({ height }) => <TallSurvey height={height} />,
};

/**
 * The page above in an iframe from another origin: Storybook answers on both
 * `localhost` and `127.0.0.1`, and a browser treats them as two sites.
 */
const OtherOriginFrame = ({ height }: ViewArgs) => {
  const url = new URL(window.location.href);
  url.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
  url.search = `?viewMode=story&id=tester-inline-visning--in-frame&args=height:${height}`;
  return (
    <iframe
      title="Survey fra en annen origin"
      src={url.href}
      style={{
        display: "block",
        width: "100%",
        height: height + 200,
        border: 0,
      }}
    />
  );
};

/**
 * The survey rendered through a React portal into an iframe from the same
 * site, 200 pixels high. The script runs in the page around the iframe.
 */
const FramePortal = ({ height }: ViewArgs) => {
  const [body, setBody] = useState<HTMLElement | null>(null);
  return (
    <>
      <iframe
        title="Iframe med survey fra en portal"
        srcDoc="<!doctype html><html><body style='margin: 0'></body></html>"
        onLoad={(event) =>
          setBody(event.currentTarget.contentDocument?.body ?? null)
        }
        style={{ display: "block", width: "100%", height: 200, border: 0 }}
      />
      {body
        ? createPortal(
            <>
              <HeightStyle height={height} />
              <Spacer height={600} />
              <TallSurvey height={height} />
              <Spacer height={600} />
            </>,
            body,
          )
        : null}
    </>
  );
};

export const InFramePortal: Story = {
  render: ({ height }) => <FramePortal height={height} />,
};

/**
 * The survey at the top of an iframe from the same site, rendered there
 * through a React portal. A transform scales the iframe, and the page
 * scrolls. The iframe is as high as the survey, so it does not scroll.
 */
const ScaledFrame = ({ height, scale = 2 }: ViewArgs) => {
  const [body, setBody] = useState<HTMLElement | null>(null);
  return (
    <>
      <Spacer height={1200} />
      {/* A transform does not move what comes after, so this keeps room. */}
      <div style={{ height: height * scale }}>
        <iframe
          title="Skalert iframe med survey fra en portal"
          srcDoc="<!doctype html><html><body style='margin: 0'></body></html>"
          onLoad={(event) =>
            setBody(event.currentTarget.contentDocument?.body ?? null)
          }
          style={{
            display: "block",
            width: 480,
            height,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
          }}
        />
      </div>
      <Spacer height={1200} />
      {body
        ? createPortal(
            <>
              <HeightStyle height={height} />
              <TallSurvey height={height} />
            </>,
            body,
          )
        : null}
    </>
  );
};

export const InScaledFrame: Story = {
  args: { scale: 2 },
  render: ({ height, scale }) => <ScaledFrame height={height} scale={scale} />,
};

/**
 * The survey far down a page, in an element that hides it with
 * `visibility: hidden` or `opacity: 0`. The element carries
 * `data-hiding`, so a test can show the survey.
 */
export const InHidingElement: Story = {
  args: { hide: "visibility" },
  render: ({ height, hide = "visibility" }) => (
    <>
      <Spacer height={1200} />
      <div
        data-hiding
        style={
          hide === "visibility" ? { visibility: "hidden" } : { opacity: 0 }
        }
      >
        <TallSurvey height={height} />
      </div>
      <Spacer height={1200} />
    </>
  ),
};

/** The survey in a shadow tree, whose host is in a scroll area. */
export const InShadowScrollArea: Story = {
  render: ({ height }) => (
    <div data-scroll-area style={{ height: 220, overflowY: "auto" }}>
      <Spacer height={1000} />
      <ShadowHost>
        <HeightStyle height={height} />
        <TallSurvey height={height} />
      </ShadowHost>
      <Spacer height={1000} />
    </div>
  ),
};

/** The survey in a scroll area that a transform scales up or down. */
export const InScaledScrollArea: Story = {
  args: { scale: 2, area: 200 },
  render: ({ height, scale = 1, area = 200 }) => (
    <div
      data-scroll-area
      style={{
        height: area,
        width: 400,
        overflowY: "auto",
        transform: `scale(${scale})`,
        transformOrigin: "0 0",
      }}
    >
      <Spacer height={1000} />
      <TallSurvey height={height} />
      <Spacer height={1000} />
    </div>
  ),
};

export const InOtherOriginFrame: Story = {
  render: ({ height }) => (
    <>
      <Spacer height={1200} />
      <OtherOriginFrame height={height} />
      <Spacer height={1200} />
    </>
  ),
};
