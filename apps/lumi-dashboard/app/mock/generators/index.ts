/**
 * Generators module - re-exports for easy importing.
 *
 * Phase 3 of refactoring: modular data generators.
 * The original generators.ts is preserved for backward compatibility.
 * New development should import from this index.
 *
 * Usage:
 * import { generateSurveyData, SurveyConfig } from "~/mock/generators"
 */

// Re-export from original file for backward compatibility
// These can be migrated to individual files as needed
export {
  generateComplexSurveyData,
  generateDiscoveryMockData,
  generateTaskPriorityMockData,
  generateTopTasksMockData,
} from "../generators";
// Common types
export type { SurveyConfig } from "./common";
// Rating survey generator
export { generateSurveyData } from "./rating";
