import { Table } from "@navikt/ds-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FeedbackDto } from "~/types/api";
import { FeedbackRow } from "../FeedbackRow";

function makeFeedback(partial: Partial<FeedbackDto> = {}): FeedbackDto {
  return {
    id: "feedback-1",
    submittedAt: "2025-01-01T10:00:00.000Z",
    app: "test-app",
    surveyId: "survey-1",
    answers: [
      {
        fieldId: "comment",
        fieldType: "TEXT",
        question: { label: "Kommentar" },
        value: { type: "text", text: "Min fnr er [FØDSELSNUMMER FJERNET]" },
      },
    ],
    sensitiveDataRedacted: true,
    ...partial,
  };
}

describe("FeedbackRow redaction", () => {
  it("renders the redaction badge and shows the redacted placeholder", () => {
    const feedback = makeFeedback();

    render(
      <Table>
        <Table.Body>
          <FeedbackRow
            feedback={feedback}
            isExpanded={false}
            onToggleExpand={vi.fn()}
            onDelete={vi.fn()}
            isDeleting={false}
          />
        </Table.Body>
      </Table>,
    );

    expect(
      screen.getByText("Min fnr er [FØDSELSNUMMER FJERNET]"),
    ).toBeInTheDocument();

    // The badge itself is rendered inside a Tooltip, but the Tag text is visible.
    expect(screen.getByText("Redigert")).toBeInTheDocument();
  });
});
