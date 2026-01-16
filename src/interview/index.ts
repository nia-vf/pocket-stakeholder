/**
 * Interview Module
 *
 * Exports interview-related functionality including question generation,
 * interview session management, and CLI prompt interfaces.
 */

export {
  InterviewQuestionGenerator,
  createQuestionGenerator,
  selectFollowUps,
  type InterviewQuestion,
  type FollowUpTrigger,
  type QuestionSet,
  type QuestionGeneratorConfig,
} from './question-generator.js';

export {
  InterviewSession,
  createInterviewSession,
  MapAnswerProvider,
  CallbackAnswerProvider,
  type InterviewSessionState,
  type InterviewSessionConfig,
  type InterviewSessionSnapshot,
  type InterviewProgressEvent,
  type ProgressCallback,
  type AnswerProvider,
  type CLIPromptAdapter,
} from './interview-session.js';

export {
  InquirerCLIPrompt,
  SimpleCLIPrompt,
  createCLIPrompt,
  createSimpleCLIPrompt,
  type CLIPromptConfig,
} from './cli-prompt.js';
