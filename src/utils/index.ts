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
