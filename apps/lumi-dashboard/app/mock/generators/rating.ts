/**
 * Rating survey data generator.
 *
 * Generates feedback items for rating-type surveys.
 */

import type { Answer, FeedbackDto } from "~/types/api";
import {
  createContext,
  createRatingAnswer,
  createTextAnswer,
  type SurveyConfig,
} from "./common";

const cryptoApi = globalThis.crypto;
const randomBuffer = new Uint32Array(1);

function randomFloat(): number {
  if (!cryptoApi) {
    throw new Error("Crypto API not available for mock data generation.");
  }
  cryptoApi.getRandomValues(randomBuffer);
  return randomBuffer[0] / 2 ** 32;
}

function pickVariantForRating(rating: number): "A" | "B" {
  const rand = randomFloat();
  if (rating >= 4) {
    return rand < 0.7 ? "A" : "B";
  }
  if (rating <= 2) {
    return rand < 0.7 ? "B" : "A";
  }
  return rand < 0.5 ? "A" : "B";
}

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
    const j = Math.floor(randomFloat() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 3. Generate the requested amount
  for (let i = 0; i < count; i++) {
    const poolItem = pool[i % pool.length];

    // Random date within last 60 days
    const daysAgo = Math.floor(randomFloat() * 60);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const dateStr = date.toISOString().split("T")[0];
    const hour = 7 + Math.floor(randomFloat() * 15);
    const minute = Math.floor(randomFloat() * 60);
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
    const deviceRand = randomFloat();
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

    const metadata = config.metadataGenerator?.() ?? {};
    metadata.abTest = pickVariantForRating(poolItem.rating);

    items.push({
      id: `gen-${config.surveyId}-${i}`,
      submittedAt: timestamp,
      app: config.app,
      surveyId: config.surveyId,
      surveyType: "rating",
      context: createContext(path, device, width, height),
      tags: poolItem.tags,
      metadata,
      answers,
      sensitiveDataRedacted: poolItem.isRedacted,
    });
  }

  return items;
}
