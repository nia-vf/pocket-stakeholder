/**
 * pocket-stakeholder
 *
 * A virtual feature team in your pocket. Simulates experienced stakeholder roles
 * (Tech Lead, QA, UX Designer) to help solo developers transform ideas into
 * production-ready applications.
 */

// Export types
export type {
  StakeholderAgent,
  StakeholderConfig,
  StakeholderRole,
  FeatureContext,
  InterviewResult,
  UserAnswers,
  Recommendations,
  ParsedSpec,
  ProjectContext,
  IdentifiedDecision,
  DecisionCategory,
  Ambiguity,
  ADRDraft,
  AlternativeOption,
} from './types/index.js';

// Export agents
export { TechLeadAgent, createTechLeadAgent } from './agents/index.js';
export type { TechLeadAgentConfig } from './agents/index.js';

// Export utilities
export { LLMClient, LLMError, createLLMClient } from './utils/index.js';
export type {
  LLMClientConfig,
  LLMMessage,
  CompletionOptions,
  CompletionResult,
} from './utils/index.js';

export {
  parseSpec,
  parseSpecContent,
  readSpecFile,
  loadProjectContext,
  createEmptyParsedSpec,
  SpecParseError,
} from './utils/index.js';
export type { SpecParserOptions } from './utils/index.js';
