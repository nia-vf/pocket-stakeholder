/**
 * Interview Session Manager
 *
 * Manages the state and flow of an interview session, supporting both
 * interactive CLI prompts and programmatic answer injection for
 * agent-to-agent interviews.
 */

import type { StakeholderRole, InterviewExchange } from '../types/index.js';
import type { InterviewQuestion, QuestionSet } from './question-generator.js';
import { selectFollowUps } from './question-generator.js';

/**
 * State of an interview session
 */
export type InterviewSessionState =
  | 'idle'
  | 'ready'
  | 'in_progress'
  | 'awaiting_answer'
  | 'completed'
  | 'cancelled';

/**
 * Answer provider interface for programmatic answer injection
 */
export interface AnswerProvider {
  /**
   * Provide an answer for a given question
   * @param question The question being asked
   * @returns The answer string, or null to skip/cancel
   */
  provideAnswer(question: InterviewQuestion): Promise<string | null>;
}

/**
 * CLI prompt adapter interface
 */
export interface CLIPromptAdapter {
  /**
   * Prompt the user for an answer via CLI
   * @param question The question to ask
   * @returns The user's answer
   */
  prompt(question: InterviewQuestion): Promise<string>;

  /**
   * Display a message to the user
   * @param message The message to display
   */
  display(message: string): void;
}

/**
 * Configuration for an interview session
 */
export interface InterviewSessionConfig {
  /** The question set to use for the interview */
  questionSet: QuestionSet;

  /** Optional answer provider for programmatic interviews */
  answerProvider?: AnswerProvider;

  /** Optional CLI adapter for interactive interviews */
  cliAdapter?: CLIPromptAdapter;

  /** Maximum follow-up questions to ask (default: 8) */
  maxFollowUps?: number;

  /** Timeout for waiting for answers in milliseconds (default: 300000 = 5 min) */
  answerTimeout?: number;
}

/**
 * Snapshot of session state for persistence/recovery
 */
export interface InterviewSessionSnapshot {
  role: StakeholderRole;
  state: InterviewSessionState;
  exchanges: InterviewExchange[];
  currentQuestionIndex: number;
  askedFollowUpIds: string[];
  remainingCoreQuestionIds: string[];
  remainingFollowUpIds: string[];
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Event emitted during interview progress
 */
export interface InterviewProgressEvent {
  type: 'question_asked' | 'answer_received' | 'followup_triggered' | 'session_completed';
  question?: InterviewQuestion;
  answer?: string;
  questionsRemaining: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (event: InterviewProgressEvent) => void;

/**
 * InterviewSession manages the state and flow of a single interview.
 *
 * Features:
 * - State machine for tracking interview progress
 * - Support for both CLI and programmatic answer providers
 * - Follow-up question triggering based on answers
 * - Session persistence via snapshots
 * - Progress callbacks for UI updates
 */
/**
 * Internal config type with required numeric fields but optional adapters
 */
interface InternalSessionConfig {
  questionSet: QuestionSet;
  answerProvider?: AnswerProvider;
  cliAdapter?: CLIPromptAdapter;
  maxFollowUps: number;
  answerTimeout: number;
}

export class InterviewSession {
  private readonly config: InternalSessionConfig;
  private state: InterviewSessionState = 'idle';
  private exchanges: InterviewExchange[] = [];
  private currentQuestionIndex = 0;
  private askedFollowUpIds = new Set<string>();
  private remainingCoreQuestions: InterviewQuestion[] = [];
  private pendingFollowUps: InterviewQuestion[] = [];
  private startedAt?: Date;
  private completedAt?: Date;
  private progressCallback?: ProgressCallback;

  constructor(config: InterviewSessionConfig) {
    const internalConfig: InternalSessionConfig = {
      questionSet: config.questionSet,
      maxFollowUps: config.maxFollowUps ?? 8,
      answerTimeout: config.answerTimeout ?? 300000,
    };
    if (config.answerProvider) {
      internalConfig.answerProvider = config.answerProvider;
    }
    if (config.cliAdapter) {
      internalConfig.cliAdapter = config.cliAdapter;
    }
    this.config = internalConfig;

    // Initialize remaining questions from the question set
    this.remainingCoreQuestions = [...config.questionSet.coreQuestions];
    this.state = 'ready';
  }

  /**
   * Get the current session state
   */
  getState(): InterviewSessionState {
    return this.state;
  }

  /**
   * Get the stakeholder role for this interview
   */
  getRole(): StakeholderRole {
    return this.config.questionSet.role;
  }

  /**
   * Get all exchanges recorded so far
   */
  getExchanges(): InterviewExchange[] {
    return [...this.exchanges];
  }

  /**
   * Get the current question being asked (if any)
   */
  getCurrentQuestion(): InterviewQuestion | undefined {
    if (this.state !== 'awaiting_answer') {
      return undefined;
    }
    return this.remainingCoreQuestions[0] ?? this.pendingFollowUps[0];
  }

  /**
   * Get number of questions remaining
   */
  getQuestionsRemaining(): number {
    return this.remainingCoreQuestions.length + this.pendingFollowUps.length;
  }

  /**
   * Check if the session has been cancelled
   */
  private isCancelled(): boolean {
    return this.state === 'cancelled';
  }

  /**
   * Set a progress callback to receive updates during the interview
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Start the interview session
   *
   * Runs through all core questions and triggered follow-ups,
   * using either the CLI adapter or answer provider.
   *
   * @returns The exchanges from the completed interview
   */
  async start(): Promise<InterviewExchange[]> {
    if (this.state !== 'ready') {
      throw new Error(`Cannot start interview in state: ${this.state}`);
    }

    if (!this.config.cliAdapter && !this.config.answerProvider) {
      throw new Error('Either cliAdapter or answerProvider must be provided');
    }

    this.state = 'in_progress';
    this.startedAt = new Date();
    this.exchanges = [];

    try {
      // Process all core questions
      while (this.remainingCoreQuestions.length > 0) {
        const question = this.remainingCoreQuestions.shift()!;
        await this.processQuestion(question);

        // Check if cancelled after async operation
        if (this.isCancelled()) {
          break;
        }
      }

      // Process any pending follow-ups
      while (this.pendingFollowUps.length > 0 && !this.isCancelled()) {
        const followUp = this.pendingFollowUps.shift()!;
        if (!this.askedFollowUpIds.has(followUp.id)) {
          await this.processQuestion(followUp);
          this.askedFollowUpIds.add(followUp.id);
        }
      }

      if (!this.isCancelled()) {
        this.state = 'completed';
      }
      this.completedAt = new Date();

      this.emitProgress({
        type: 'session_completed',
        questionsRemaining: 0,
      });

      return this.exchanges;
    } catch (error) {
      this.state = 'cancelled';
      throw error;
    }
  }

  /**
   * Process a single question: ask it and record the answer
   */
  private async processQuestion(question: InterviewQuestion): Promise<void> {
    this.state = 'awaiting_answer';

    this.emitProgress({
      type: 'question_asked',
      question,
      questionsRemaining: this.getQuestionsRemaining(),
    });

    // Get the answer
    let answer: string | null = null;

    if (this.config.answerProvider) {
      answer = await this.config.answerProvider.provideAnswer(question);
    } else if (this.config.cliAdapter) {
      answer = await this.config.cliAdapter.prompt(question);
    }

    // Handle null/cancelled answer
    if (answer === null) {
      this.state = 'cancelled';
      return;
    }

    // Record the exchange
    const exchange: InterviewExchange = {
      question: question.text,
      answer,
      followUpTriggered: false,
    };

    this.emitProgress({
      type: 'answer_received',
      question,
      answer,
      questionsRemaining: this.getQuestionsRemaining(),
    });

    // Check for triggered follow-ups
    const triggeredFollowUps = selectFollowUps(
      answer,
      question.id,
      this.config.questionSet.followUpQuestions
    );

    if (triggeredFollowUps.length > 0 && this.askedFollowUpIds.size < this.config.maxFollowUps) {
      exchange.followUpTriggered = true;

      for (const followUp of triggeredFollowUps) {
        if (!this.askedFollowUpIds.has(followUp.id)) {
          this.pendingFollowUps.push(followUp);
          this.emitProgress({
            type: 'followup_triggered',
            question: followUp,
            questionsRemaining: this.getQuestionsRemaining(),
          });
        }
      }
    }

    this.exchanges.push(exchange);
    this.currentQuestionIndex++;
    this.state = 'in_progress';
  }

  /**
   * Emit a progress event if callback is registered
   */
  private emitProgress(event: InterviewProgressEvent): void {
    if (this.progressCallback) {
      this.progressCallback(event);
    }
  }

  /**
   * Submit an answer programmatically (for use when awaiting_answer)
   *
   * This is useful for integrations where the interview is driven
   * externally rather than through start().
   */
  async submitAnswer(answer: string): Promise<void> {
    if (this.state !== 'awaiting_answer') {
      throw new Error(`Cannot submit answer in state: ${this.state}`);
    }

    const question = this.getCurrentQuestion();
    if (!question) {
      throw new Error('No current question to answer');
    }

    // Record the exchange
    const exchange: InterviewExchange = {
      question: question.text,
      answer,
      followUpTriggered: false,
    };

    // Check for triggered follow-ups
    const triggeredFollowUps = selectFollowUps(
      answer,
      question.id,
      this.config.questionSet.followUpQuestions
    );

    if (triggeredFollowUps.length > 0) {
      exchange.followUpTriggered = true;
      for (const followUp of triggeredFollowUps) {
        if (!this.askedFollowUpIds.has(followUp.id)) {
          this.pendingFollowUps.push(followUp);
        }
      }
    }

    this.exchanges.push(exchange);

    // Remove the answered question from the appropriate queue
    if (this.remainingCoreQuestions[0]?.id === question.id) {
      this.remainingCoreQuestions.shift();
    } else {
      const idx = this.pendingFollowUps.findIndex((q) => q.id === question.id);
      if (idx >= 0) {
        this.pendingFollowUps.splice(idx, 1);
        this.askedFollowUpIds.add(question.id);
      }
    }

    this.currentQuestionIndex++;
    this.state = this.getQuestionsRemaining() > 0 ? 'in_progress' : 'completed';
  }

  /**
   * Advance to the next question without answering (skip)
   */
  skipCurrentQuestion(): void {
    if (this.state !== 'awaiting_answer' && this.state !== 'in_progress') {
      throw new Error(`Cannot skip question in state: ${this.state}`);
    }

    if (this.remainingCoreQuestions.length > 0) {
      this.remainingCoreQuestions.shift();
    } else if (this.pendingFollowUps.length > 0) {
      this.pendingFollowUps.shift();
    }

    this.state = this.getQuestionsRemaining() > 0 ? 'in_progress' : 'completed';
  }

  /**
   * Cancel the interview session
   */
  cancel(): void {
    this.state = 'cancelled';
    this.completedAt = new Date();
  }

  /**
   * Create a snapshot of the current session state for persistence
   */
  createSnapshot(): InterviewSessionSnapshot {
    const snapshot: InterviewSessionSnapshot = {
      role: this.config.questionSet.role,
      state: this.state,
      exchanges: [...this.exchanges],
      currentQuestionIndex: this.currentQuestionIndex,
      askedFollowUpIds: [...this.askedFollowUpIds],
      remainingCoreQuestionIds: this.remainingCoreQuestions.map((q) => q.id),
      remainingFollowUpIds: this.pendingFollowUps.map((q) => q.id),
    };
    if (this.startedAt) {
      snapshot.startedAt = this.startedAt;
    }
    if (this.completedAt) {
      snapshot.completedAt = this.completedAt;
    }
    return snapshot;
  }

  /**
   * Restore session state from a snapshot
   */
  restoreFromSnapshot(snapshot: InterviewSessionSnapshot): void {
    if (this.state !== 'ready' && this.state !== 'idle') {
      throw new Error(`Cannot restore snapshot in state: ${this.state}`);
    }

    this.state = snapshot.state;
    this.exchanges = [...snapshot.exchanges];
    this.currentQuestionIndex = snapshot.currentQuestionIndex;
    this.askedFollowUpIds = new Set(snapshot.askedFollowUpIds);
    if (snapshot.startedAt) {
      this.startedAt = snapshot.startedAt;
    }
    if (snapshot.completedAt) {
      this.completedAt = snapshot.completedAt;
    }

    // Restore question queues from IDs
    this.remainingCoreQuestions = snapshot.remainingCoreQuestionIds
      .map((id) => this.config.questionSet.coreQuestions.find((q) => q.id === id))
      .filter((q): q is InterviewQuestion => q !== undefined);

    this.pendingFollowUps = snapshot.remainingFollowUpIds
      .map((id) => this.config.questionSet.followUpQuestions.find((q) => q.id === id))
      .filter((q): q is InterviewQuestion => q !== undefined);
  }
}

/**
 * Programmatic answer provider that uses a pre-defined map of answers
 *
 * Useful for testing or agent-to-agent interviews where answers are known.
 */
export class MapAnswerProvider implements AnswerProvider {
  private readonly answers: Map<string, string>;
  private readonly defaultAnswer: string | null;

  /**
   * @param answers Map of question ID to answer
   * @param defaultAnswer Optional default answer for unmapped questions
   */
  constructor(answers: Map<string, string> | Record<string, string>, defaultAnswer?: string) {
    this.answers = answers instanceof Map ? answers : new Map(Object.entries(answers));
    this.defaultAnswer = defaultAnswer ?? null;
  }

  async provideAnswer(question: InterviewQuestion): Promise<string | null> {
    const answer = this.answers.get(question.id);
    if (answer !== undefined) {
      return answer;
    }

    // Try matching by question text
    for (const [key, value] of this.answers) {
      if (question.text.includes(key) || key.includes(question.text)) {
        return value;
      }
    }

    return this.defaultAnswer;
  }
}

/**
 * Programmatic answer provider that uses a callback function
 *
 * Useful for dynamic answer generation, e.g., from another LLM agent.
 */
export class CallbackAnswerProvider implements AnswerProvider {
  private readonly callback: (question: InterviewQuestion) => Promise<string | null>;

  constructor(callback: (question: InterviewQuestion) => Promise<string | null>) {
    this.callback = callback;
  }

  async provideAnswer(question: InterviewQuestion): Promise<string | null> {
    return this.callback(question);
  }
}

/**
 * Factory function to create an interview session
 */
export function createInterviewSession(config: InterviewSessionConfig): InterviewSession {
  return new InterviewSession(config);
}
