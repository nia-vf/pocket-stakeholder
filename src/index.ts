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
