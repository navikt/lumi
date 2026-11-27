import { describe, expect, it } from "vitest";
import { evaluateBranching } from "../branchingEngine.js";
import { evaluateVisibility } from "../evaluateVisibility.js";
import { ownValue, setOwnValue } from "../ownValue.js";
import { buildTransportPayload } from "../transportPayload.js";
import type { LumiSurveyAnswerValue, LumiSurveyQuestion } from "../types.js";

describe("answers under a question id that every object inherits", () => {
  it("reads only what the object holds itself", () => {
    expect(ownValue({}, "constructor")).toBeUndefined();
    expect(ownValue({}, "toString")).toBeUndefined();
    expect(ownValue(undefined, "toString")).toBeUndefined();
    expect(ownValue(null, "toString")).toBeUndefined();
    expect(ownValue(JSON.parse('{"constructor":"ja"}'), "constructor")).toBe(
      "ja",
    );
  });

  it("stores an answer under __proto__ as an answer, not as a prototype", () => {
    const answers: Record<string, LumiSurveyAnswerValue> = {};
    setOwnValue(answers, "__proto__", ["a", "b"]);
    expect(Object.getPrototypeOf(answers)).toBe(Object.prototype);
    expect(Object.keys(answers)).toEqual(["__proto__"]);
    expect(ownValue(answers, "__proto__")).toEqual(["a", "b"]);
  });

  it("treats null metadata from plain JavaScript as no metadata, as before", () => {
    const tagged = {
      field: "METADATA",
      key: "placement",
      operator: "EXISTS",
      value: "",
    } as const;
    const metadata = null as unknown as Record<string, unknown>;
    expect(evaluateVisibility(tagged, {}, metadata)).toBe(false);
    expect(
      evaluateBranching(
        {
          id: "first",
          type: "text",
          prompt: "Først",
          logic: [{ condition: tagged, action: { type: "SUBMIT" } }],
        },
        undefined,
        metadata,
        [
          { id: "first", type: "text", prompt: "Først" },
          { id: "second", type: "text", prompt: "Så" },
        ],
        0,
      ),
    ).toEqual({ nextIndex: 1, triggeredByRule: false });
  });

  it("sends no answer for such a question that was not answered", () => {
    const questions: LumiSurveyQuestion[] = [
      { id: "constructor", type: "text", prompt: "Kommentar" },
      { id: "toString", type: "text", prompt: "Mer" },
    ];
    const payload = buildTransportPayload(
      "survey",
      { toString: "Hei" },
      questions,
      "key",
      "custom",
      undefined,
      undefined,
      "2026-11-24T12:00:00.000Z",
    );
    expect(payload.answers?.map((answer) => answer.fieldId)).toEqual([
      "toString",
    ]);
  });
});
