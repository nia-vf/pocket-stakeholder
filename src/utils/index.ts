/**
 * Utility modules for pocket-stakeholder
 */

export {
  LLMClient,
  LLMError,
  createLLMClient,
  type LLMClientConfig,
  type LLMMessage,
  type CompletionOptions,
  type CompletionResult,
} from './llm-client.js';

export {
  parseSpec,
  parseSpecContent,
  readSpecFile,
  loadProjectContext,
  createEmptyParsedSpec,
  validateParsedSpec,
  summarizeSpec,
  buildFeatureContext,
  SpecParseError,
  type SpecParserOptions,
  type SpecValidationResult,
} from './spec-parser.js';

export {
  SpecAnalyzer,
  createSpecAnalyzer,
  categorizeDecision,
  scoreAmbiguity,
  scoreDecisionAmbiguity,
  scoreDecisions,
  calculateAnalysisStats,
  generateAnalysisSummary,
  TECH_LEAD_ANALYSIS_PROMPT,
  CLARITY_THRESHOLD,
  type SpecAnalyzerConfig,
  type AnalysisResult,
  type ScoredDecision,
  type AmbiguityLevel,
  type AnalysisStats,
} from './spec-analyzer.js';
