import { describe, expect, it } from "vitest";
import type {
  Answer,
  FieldType,
  RatingAnswer,
  SingleChoiceAnswer,
  TextAnswer,
} from "~/types/api";

describe("API Types", () => {
  describe("Answer type discrimination", () => {
    it("correctly types a RatingAnswer", () => {
      const answer: RatingAnswer = {
        fieldId: "rating-1",
        fieldType: "RATING",
        question: { label: "How satisfied are you?" },
        value: { type: "rating", rating: 4 },
      };

      expect(answer.fieldType).toBe("RATING");
      expect(answer.value.rating).toBe(4);
    });

    it("correctly types a TextAnswer", () => {
      const answer: TextAnswer = {
        fieldId: "feedback",
        fieldType: "TEXT",
        question: { label: "Any comments?" },
        value: { type: "text", text: "Great experience!" },
      };

      expect(answer.fieldType).toBe("TEXT");
      expect(answer.value.text).toBe("Great experience!");
    });

    it("correctly types a SingleChoiceAnswer", () => {
      const answer: SingleChoiceAnswer = {
        fieldId: "category",
        fieldType: "SINGLE_CHOICE",
        question: {
          label: "Select category",
          options: [
            { id: "bug", label: "Bug" },
            { id: "feature", label: "Feature" },
          ],
        },
        value: { type: "singleChoice", selectedOptionId: "bug" },
      };

      expect(answer.fieldType).toBe("SINGLE_CHOICE");
      expect(answer.value.selectedOptionId).toBe("bug");
    });

    it("can discriminate Answer union type by fieldType", () => {
      const answers: Answer[] = [
        {
          fieldId: "rating",
          fieldType: "RATING",
          question: { label: "Rating" },
          value: { type: "rating", rating: 5 },
        },
        {
          fieldId: "feedback",
          fieldType: "TEXT",
          question: { label: "Feedback" },
          value: { type: "text", text: "Hello" },
        },
      ];

      const ratings = answers.filter(
        (a): a is RatingAnswer => a.fieldType === "RATING",
      );
      const texts = answers.filter(
        (a): a is TextAnswer => a.fieldType === "TEXT",
      );

      expect(ratings).toHaveLength(1);
      expect(texts).toHaveLength(1);
      expect(ratings[0].value.rating).toBe(5);
      expect(texts[0].value.text).toBe("Hello");
    });
  });

  describe("FieldType enum values", () => {
    it("has expected field types", () => {
      const fieldTypes: FieldType[] = [
        "RATING",
        "TEXT",
        "SINGLE_CHOICE",
        "MULTI_CHOICE",
        "DATE",
      ];

      expect(fieldTypes).toContain("RATING");
      expect(fieldTypes).toContain("TEXT");
      expect(fieldTypes).toContain("SINGLE_CHOICE");
      expect(fieldTypes).toContain("MULTI_CHOICE");
      expect(fieldTypes).toContain("DATE");
    });
  });
});
