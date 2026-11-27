import type { Meta, StoryObj } from "@storybook/react-vite";
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LumiSurveyInline } from "../components/LumiSurveyInline";
import type { SurveyDocumentV1, SurveyPageV1 } from "../components/surveyTypes";
import { SUCCESS_TRANSPORT } from "./LumiSurveyDockExamplePage";
import { ShadowHost } from "./ShadowHost";

interface FocusArgs {
  /** The outer of two shadow trees. */
  outer?: ShadowRootMode;
  /** The tree in the outer tree, which the survey is in. */
  inner?: ShadowRootMode;
  /**
   * What scrolls the page: the viewport, or the overflow of `<html>` or of
   * `<body>`, which the viewport takes over.
   */
  scroller?: "viewport" | "root" | "body";
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

/** The answer takes 800 milliseconds to send, as on a real network. */
const Survey = () => (
  <LumiSurveyInline
    surveyId="fokus"
    survey={DOCUMENT}
    transport={SUCCESS_TRANSPORT}
    headingLevel="3"
  />
);

/** Somewhere on the page to move focus to, outside the survey. */
const PageButton = () => <button type="button">Knapp på siden</button>;

/**
 * The survey rendered through a React portal into an iframe from the same
 * site. The script and the button run in the page around the iframe.
 */
const FramePortal = () => {
  const [body, setBody] = useState<HTMLElement | null>(null);
  return (
    <>
      <iframe
        title="Iframe med survey fra en portal"
        srcDoc="<!doctype html><html><body></body></html>"
        onLoad={(event) =>
          setBody(event.currentTarget.contentDocument?.body ?? null)
        }
        style={{ display: "block", width: "100%", height: 600, border: 0 }}
      />
      {body ? createPortal(<Survey />, body) : null}
    </>
  );
};

/**
 * Not in the Storybook menu. The browser tests in `e2e/` open these stories
 * to follow focus: jsdom does not send focus events out of a shadow tree as
 * a browser does.
 */
const meta: Meta<FocusArgs> = {
  title: "Tester/Inline fokus",
  tags: ["!dev", "!autodocs"],
};

export default meta;
type Story = StoryObj<FocusArgs>;

export const InPage: Story = {
  render: () => (
    <>
      <PageButton />
      <Survey />
    </>
  ),
};

export const InShadowTree: Story = {
  render: () => (
    <>
      <PageButton />
      <ShadowHost>
        <Survey />
      </ShadowHost>
    </>
  ),
};

/**
 * The survey in a shadow tree inside another shadow tree. A browser test
 * cannot look into a closed tree, so `window.lumiStoryShadowRoots` holds
 * both trees.
 */
export const InNestedShadowTrees: Story = {
  args: { outer: "closed", inner: "open" },
  render: ({ outer = "closed", inner = "open" }) => (
    <>
      <PageButton />
      <ShadowHost mode={outer}>
        <ShadowHost mode={inner}>
          <Survey />
        </ShadowHost>
      </ShadowHost>
    </>
  ),
};

export const InFrame: Story = {
  render: () => (
    <>
      <PageButton />
      <FramePortal />
    </>
  ),
};

/**
 * The survey in a scroll area of 300 pixels, in the middle of the page. The
 * area has a thick border, which shows nothing of what is in it. A test can
 * change the height of the space above the survey, marked `data-spacer`.
 */
export const InScrollArea: Story = {
  render: () => (
    <>
      <PageButton />
      <div
        data-scroll-area
        style={{ height: 300, overflowY: "auto", border: "10px solid" }}
      >
        <div data-spacer style={{ height: 400 }} />
        <Survey />
        <div style={{ height: 600 }} />
      </div>
    </>
  ),
};

/** As `InScrollArea`, with the scroll area in the survey's shadow tree. */
export const InScrollAreaInShadowTree: Story = {
  render: () => (
    <>
      <PageButton />
      <ShadowHost>
        <div
          data-scroll-area
          style={{ height: 300, overflowY: "auto", border: "10px solid" }}
        >
          <div data-spacer style={{ height: 400 }} />
          <Survey />
          <div style={{ height: 600 }} />
        </div>
      </ShadowHost>
    </>
  ),
};

const TALL_DOCUMENT: SurveyDocumentV1 = {
  authoringSchemaVersion: 1,
  type: "custom",
  pages: [
    {
      id: "side",
      questions: Array.from({ length: 8 }, (_, index) => ({
        id: `sporsmal-${index + 1}`,
        type: "text" as const,
        prompt: `Spørsmål ${index + 1}: Hva vil du si om kalkulatoren?`,
      })) as SurveyPageV1["questions"],
    },
  ],
};

/**
 * Sets the overflow that scrolls the page while the story is shown. With
 * `body`, `<body>` is as tall as the viewport, as on a page with
 * `height: 100%` on it, and the page is longer.
 */
const PageScroller = ({ scroller }: Pick<FocusArgs, "scroller">) => {
  useLayoutEffect(() => {
    const { documentElement: root, body } = document;
    const styles: [CSSStyleDeclaration, string, string][] =
      scroller === "root"
        ? [[root.style, "overflow-y", "scroll"]]
        : scroller === "body"
          ? [
              [root.style, "height", "100%"],
              [body.style, "height", "100%"],
              [body.style, "overflow-y", "auto"],
            ]
          : [];
    const before = styles.map(([style, property]) =>
      style.getPropertyValue(property),
    );
    for (const [style, property, value] of styles) {
      style.setProperty(property, value);
    }
    return () => {
      styles.forEach(([style, property], index) => {
        style.setProperty(property, before[index]);
      });
    };
  }, [scroller]);
  return null;
};

/**
 * A survey taller than the viewport, with more page below it. The receipt is
 * much shorter than the questions it replaces. A test can change the height
 * of the space above the survey, marked `data-spacer`.
 */
export const TallInPage: Story = {
  args: { scroller: "viewport" },
  render: ({ scroller }) => (
    <>
      <PageScroller scroller={scroller} />
      <PageButton />
      <div data-spacer style={{ height: 16 }} />
      <LumiSurveyInline
        surveyId="fokus-hoy"
        survey={TALL_DOCUMENT}
        transport={SUCCESS_TRANSPORT}
        headingLevel="3"
      />
      <div style={{ height: 2000 }}>Innhold under surveyen</div>
    </>
  ),
};
