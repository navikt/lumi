/**
 * Rating survey data generator.
 *
 * Generates feedback items for rating-type surveys.
 */

import type { Answer, FeedbackDto } from "~/types/api";
import {
  type SurveyConfig,
  createContext,
  createRatingAnswer,
  createTextAnswer,
} from "./common";

/**
 * Generate rating survey feedback data from topics configuration.
 */
export function generateSurveyData(
  count: number,
  config: SurveyConfig,
): FeedbackDto[] {
  const items: FeedbackDto[] = [];
  const now = new Date();

  // 1. Flatten all topics into a pool of potential items
  type PoolItem = {
    text: string;
    rating: number;
    tags: string[];
    isRedacted: boolean;
  };

  const pool: PoolItem[] = [];

  for (const topic of config.topics) {
    for (const comment of topic.comments) {
      pool.push({
        text: comment,
        rating: topic.rating,
        tags: topic.tags || [],
        isRedacted: !!topic.isRedacted,
      });
    }
  }

  // 2. Shuffle the pool to get random order
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 3. Generate the requested amount
  for (let i = 0; i < count; i++) {
    const poolItem = pool[i % pool.length];

    // Random date within last 60 days
    const daysAgo = Math.floor(Math.random() * 60);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split("T")[0];
    const hour = 7 + Math.floor(Math.random() * 15);
    const minute = Math.floor(Math.random() * 60);
    const timestamp = `${dateStr}T${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}:00Z`;

    // Answers
    const answers: Answer[] = [
      createRatingAnswer(
        "hovedsporsmal",
        config.questions.ratingLabel,
        poolItem.rating,
      ),
    ];

    if (poolItem.text) {
      if (config.questions.textLabel) {
        answers.push(
          createTextAnswer(
            "begrunnelse",
            config.questions.textLabel,
            poolItem.text,
            "Valgfritt",
          ),
        );
      } else if (config.questions.textLabel2) {
        const field = poolItem.rating > 3 ? "nytte" : "forbedringer";
        const label =
          poolItem.rating > 3
            ? "Opplever du at oppfølgingsplanen er et nyttig verktøy?"
            : "Hvis du kunne endre på noe, hva ville det vært?";

        answers.push(createTextAnswer(field, label, poolItem.text));
      }
    }

    // Device distribution
    const deviceRand = Math.random();
    let device: "mobile" | "tablet" | "desktop";
    let width: number;
    let height: number;

    if (deviceRand > 0.6) {
      device = "desktop";
      width = 1920;
      height = 1080;
    } else if (deviceRand > 0.1) {
      device = "mobile";
      width = 375;
      height = 812;
    } else {
      device = "tablet";
      width = 768;
      height = 1024;
    }

    // Correlate low ratings with problem paths
    const problemPaths = ["/opplasting", "/innlogging", "/innsending"];
    const normalPaths = [
      "/oversikt",
      "/status",
      "/historikk",
      "/hjelp",
      "/dokumenter",
    ];

    let path: string;
    if (poolItem.rating <= 2) {
      path = `${config.basePath}${problemPaths[i % problemPaths.length]}`;
    } else {
      path = `${config.basePath}${normalPaths[i % normalPaths.length]}`;
    }

    items.push({
      id: `gen-${config.surveyId}-${i}`,
      submittedAt: timestamp,
      app: config.app,
      surveyId: config.surveyId,
      surveyType: "rating",
      context: createContext(path, device, width, height),
      tags: poolItem.tags,
      metadata: config.metadataGenerator?.(),
      answers,
      sensitiveDataRedacted: poolItem.isRedacted,
    });
  }

  return items;
}
