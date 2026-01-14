export interface FeedbackAnswerValue {
  type: string;
  rating?: number;
  text?: string;
  selected?: string | string[];
}

export interface FeedbackAnswer {
  fieldId: string;
  fieldType: string;
  value: FeedbackAnswerValue;
  question?: {
    label?: string;
  };
}

export interface FeedbackItem {
  id: string;
  app?: string;
  surveyId?: string;
  submittedAt?: string;
  answers: FeedbackAnswer[];
}

export function generateCsvExport(items: FeedbackItem[]): Response {
  if (items.length === 0) {
    return new Response("id,app,surveyId,submittedAt\n", {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lumi-export.csv"`,
      },
    });
  }

  // Collect all unique fields with their metadata (label, type)
  const fieldMap = new Map<string, { label: string; type: string }>();
  for (const item of items) {
    for (const answer of item.answers) {
      if (!fieldMap.has(answer.fieldId)) {
        fieldMap.set(answer.fieldId, {
          label: answer.question?.label || answer.fieldId,
          type: answer.fieldType,
        });
      }
    }
  }

  // Helper to extract actual value from answer
  function getAnswerValue(answer: FeedbackAnswer | undefined): string {
    if (!answer || !answer.value) return "";
    const val = answer.value;
    if (val.type === "rating") return String(val.rating);
    if (val.type === "text") return val.text || "";
    if (val.type === "single_choice") return (val.selected as string) || "";
    if (val.type === "multi_choice")
      return ((val.selected as string[]) || []).join(", ");
    return "";
  }

  // Helper to escape CSV values
  function escapeCSV(value: string): string {
    if (!value) return "";
    const escaped = value
      .replace(/"/g, '""')
      .replace(/\n/g, " ")
      .replace(/\r/g, "");
    return `"${escaped}"`;
  }

  // Build CSV with readable headers
  const csvRows: string[] = [];
  const fieldIds = Array.from(fieldMap.keys());

  // Header row with readable names
  const headers = [
    "ID",
    "App",
    "Survey",
    "Tidspunkt",
    ...fieldIds.map((id) => {
      const field = fieldMap.get(id);
      if (!field) return id; // Should not happen based on logic
      // Include field type as suffix for clarity
      const typeLabel =
        field.type === "RATING"
          ? " (vurdering)"
          : field.type === "TEXT"
            ? " (tekst)"
            : "";
      return field.label + typeLabel;
    }),
  ];
  csvRows.push(headers.map((h) => escapeCSV(h)).join(","));

  // Data rows
  for (const item of items) {
    const row: string[] = [
      item.id,
      item.app || "",
      item.surveyId || "",
      item.submittedAt
        ? new Date(item.submittedAt).toLocaleString("no-NO")
        : "",
    ];

    // Add answer values for each field
    for (const fieldId of fieldIds) {
      const answer = item.answers.find((a) => a.fieldId === fieldId);
      row.push(getAnswerValue(answer));
    }

    csvRows.push(row.map((v) => escapeCSV(v)).join(","));
  }

  // Add BOM for Excel UTF-8 support
  const bom = "\uFEFF";
  return new Response(bom + csvRows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lumi-export.csv"`,
    },
  });
}
