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
export { QAAgent, createQAAgent } from './agents/index.js';
export { UXAgent, createUXAgent } from './agents/index.js';
export type { TechLeadAgentConfig } from './agents/index.js';
export type { QAAgentConfig } from './agents/index.js';
export type { UXAgentConfig } from './agents/index.js';

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

// Export interview module
export {
  InterviewQuestionGenerator,
  createQuestionGenerator,
  selectFollowUps,
  InterviewSession,
  createInterviewSession,
  MapAnswerProvider,
  CallbackAnswerProvider,
  InquirerCLIPrompt,
  SimpleCLIPrompt,
  createCLIPrompt,
  createSimpleCLIPrompt,
} from './interview/index.js';
export type {
  InterviewQuestion,
  FollowUpTrigger,
  QuestionSet,
  QuestionGeneratorConfig,
  InterviewSessionState,
  InterviewSessionConfig,
  InterviewSessionSnapshot,
  InterviewProgressEvent,
  ProgressCallback,
  AnswerProvider,
  CLIPromptAdapter,
  CLIPromptConfig,
} from './interview/index.js';

// Export ADR module
export {
  ADRGenerator,
  createADRGenerator,
  ADRNumberingSystem,
  renderADRTemplate,
  formatADRNumber,
  generateADRFilename,
  decisionToADRDraft,
} from './adr/index.js';
export type {
  ADRStatus,
  ADRGeneratorConfig,
  RenderedADR,
  WriteResult,
} from './adr/index.js';

// Export orchestrator module
export {
  PipelineOrchestrator,
  createPipelineOrchestrator,
} from './orchestrator/index.js';
export type {
  PipelineConfig,
  PipelineResult,
  PipelineProgressEvent,
  PipelineProgressCallback,
  PipelineRunOptions,
} from './orchestrator/index.js';
