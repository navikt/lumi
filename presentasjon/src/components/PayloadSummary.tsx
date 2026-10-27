import type { LumiSurveyTransportPayload } from "@navikt/lumi-survey";
import { cx } from "../engine/css";
import "./PayloadSummary.css";

type Answer = LumiSurveyTransportPayload["answers"][number];

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function answerText(answer: Answer): string {
  const { value } = answer;
  switch (value.type) {
    case "rating":
      return `${value.rating ?? "?"} av ${value.ratingScale ?? "?"}`;
    case "text":
      return `«${value.text ?? ""}»`;
    case "singleChoice":
      return value.selectedOptionId ?? "";
    case "multiChoice":
      return (value.selectedOptionIds ?? []).join(", ");
    default:
      return "";
  }
}

interface Row {
  key: string;
  value: string;
}

/**
 * The fields people ask about, from the real payload. The rest is left out.
 * Text answers are shown in full, so the room sees everything that was typed.
 */
function rows(payload: LumiSurveyTransportPayload): Row[] {
  const { context } = payload;
  const result: Row[] = [{ key: "surveyId", value: payload.surveyId }];
  for (const answer of payload.answers) {
    result.push({ key: answer.fieldId, value: answerText(answer) });
  }
  if (context?.deviceType) {
    result.push({ key: "deviceType", value: context.deviceType });
  }
  if (context?.userAgent) {
    result.push({ key: "userAgent", value: shorten(context.userAgent, 22) });
  }
  return result;
}

interface PayloadSummaryProps {
  payload: LumiSurveyTransportPayload;
  caption?: string;
  className?: string;
}

export function PayloadSummary({
  payload,
  caption = "Det appen ville sendt til backenden sin",
  className,
}: PayloadSummaryProps) {
  return (
    <figure className={cx("payload-summary", className)}>
      <figcaption className="payload-summary__caption">{caption}</figcaption>
      <dl className="payload-summary__rows">
        {rows(payload).map((row) => (
          <div key={row.key} className="payload-summary__row">
            <dt>{row.key}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
