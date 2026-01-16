/**
 * Interview Module
 *
 * Exports interview-related functionality including question generation
 * and interview session management.
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
