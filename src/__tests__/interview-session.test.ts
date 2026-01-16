/**
 * Tests for InterviewSession and related functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InterviewSession,
  createInterviewSession,
  MapAnswerProvider,
  CallbackAnswerProvider,
  type InterviewSessionConfig,
  type CLIPromptAdapter,
  type AnswerProvider,
  type InterviewProgressEvent,
} from '../interview/interview-session.js';
import type { InterviewQuestion, QuestionSet } from '../interview/question-generator.js';

/**
 * Create a mock question set for testing
 */
function createMockQuestionSet(): QuestionSet {
  return {
    role: 'tech-lead',
    coreQuestions: [
      {
        id: 'core-1',
        text: 'What are the architectural constraints?',
        type: 'core',
        category: 'architecture',
        priority: 1,
      },
      {
        id: 'core-2',
        text: 'What performance requirements exist?',
        type: 'core',
        category: 'performance',
        priority: 2,
      },
      {
        id: 'core-3',
        text: 'How should this integrate with existing systems?',
        type: 'core',
        category: 'integration',
        priority: 3,
      },
    ],
    followUpQuestions: [
      {
        id: 'followup-1',
        text: 'Can you elaborate on the performance requirements?',
        type: 'follow-up',
        category: 'performance',
        priority: 10,
        followUpTrigger: {
          afterQuestionId: 'core-2',
          triggerKeywords: ['latency', 'fast', 'slow'],
        },
      },
      {
        id: 'followup-2',
        text: 'What caching strategy would you prefer?',
        type: 'follow-up',
        category: 'performance',
        priority: 11,
        followUpTrigger: {
          afterQuestionId: 'core-2',
          alwaysAsk: true,
        },
      },
    ],
    estimatedQuestionCount: {
      min: 3,
      max: 5,
    },
  };
}

/**
 * Create a mock CLI adapter for testing
 */
function createMockCLIAdapter(answers: string[]): CLIPromptAdapter {
  let answerIndex = 0;
  return {
    prompt: vi.fn(async () => answers[answerIndex++] ?? ''),
    display: vi.fn(),
  };
}

describe('InterviewSession', () => {
  let questionSet: QuestionSet;

  beforeEach(() => {
    questionSet = createMockQuestionSet();
  });

  describe('construction and initialization', () => {
    it('should initialize in ready state', () => {
      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({}),
      });

      expect(session.getState()).toBe('ready');
      expect(session.getRole()).toBe('tech-lead');
    });

    it('should calculate questions remaining correctly', () => {
      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({}),
      });

      expect(session.getQuestionsRemaining()).toBe(3); // 3 core questions
    });

    it('should return empty exchanges initially', () => {
      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({}),
      });

      expect(session.getExchanges()).toEqual([]);
    });
  });

  describe('start() with answer provider', () => {
    it('should process all core questions', async () => {
      const answers = new Map([
        ['core-1', 'Must be microservices'],
        ['core-2', 'Low latency required'],
        ['core-3', 'REST API integration'],
      ]);

      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider(answers),
        maxFollowUps: 0, // Disable follow-ups for this test
      });

      const exchanges = await session.start();

      expect(session.getState()).toBe('completed');
      expect(exchanges.length).toBe(3);
      expect(exchanges[0].question).toBe('What are the architectural constraints?');
      expect(exchanges[0].answer).toBe('Must be microservices');
    });

    it('should trigger follow-up questions based on keywords', async () => {
      const answers = new Map([
        ['core-1', 'Must be microservices'],
        ['core-2', 'Need fast response with low latency'], // Contains trigger keyword
        ['core-3', 'REST API integration'],
        ['followup-1', 'Under 100ms'],
        ['followup-2', 'Use Redis'],
      ]);

      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider(answers),
      });

      const exchanges = await session.start();

      expect(session.getState()).toBe('completed');
      // Should have core questions + triggered follow-ups
      expect(exchanges.length).toBeGreaterThanOrEqual(4);

      // Check that follow-up was triggered
      const hasFollowUp = exchanges.some(
        (e) => e.followUpTriggered || e.question.includes('elaborate')
      );
      expect(hasFollowUp).toBe(true);
    });

    it('should handle null answers by cancelling', async () => {
      const session = createInterviewSession({
        questionSet,
        answerProvider: new CallbackAnswerProvider(async () => null),
      });

      await session.start();

      expect(session.getState()).toBe('cancelled');
      expect(session.getExchanges().length).toBe(0);
    });
  });

  describe('start() with CLI adapter', () => {
    it('should prompt user for each question', async () => {
      const cliAdapter = createMockCLIAdapter([
        'Monolithic architecture',
        'Standard performance',
        'Direct database access',
      ]);

      const session = createInterviewSession({
        questionSet,
        cliAdapter,
        maxFollowUps: 0,
      });

      const exchanges = await session.start();

      expect(cliAdapter.prompt).toHaveBeenCalledTimes(3);
      expect(exchanges.length).toBe(3);
      expect(exchanges[0].answer).toBe('Monolithic architecture');
    });
  });

  describe('progress callbacks', () => {
    it('should emit progress events', async () => {
      const events: InterviewProgressEvent[] = [];
      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({
          'core-1': 'Answer 1',
          'core-2': 'Answer 2',
          'core-3': 'Answer 3',
        }),
        maxFollowUps: 0,
      });

      session.onProgress((event) => events.push(event));

      await session.start();

      // Should have question_asked and answer_received for each question
      const questionAsked = events.filter((e) => e.type === 'question_asked');
      const answerReceived = events.filter((e) => e.type === 'answer_received');
      const completed = events.filter((e) => e.type === 'session_completed');

      expect(questionAsked.length).toBe(3);
      expect(answerReceived.length).toBe(3);
      expect(completed.length).toBe(1);
    });
  });

  describe('snapshot and restore', () => {
    it('should create a valid snapshot', async () => {
      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({
          'core-1': 'Answer 1',
          'core-2': 'Answer 2',
          'core-3': 'Answer 3',
        }),
        maxFollowUps: 0,
      });

      await session.start();
      const snapshot = session.createSnapshot();

      expect(snapshot.role).toBe('tech-lead');
      expect(snapshot.state).toBe('completed');
      expect(snapshot.exchanges.length).toBe(3);
      expect(snapshot.completedAt).toBeDefined();
    });

    it('should restore from snapshot', () => {
      const session1 = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({}),
      });

      // Manually create a partial snapshot
      const snapshot = {
        role: 'tech-lead' as const,
        state: 'in_progress' as const,
        exchanges: [
          { question: 'Q1', answer: 'A1', followUpTriggered: false },
        ],
        currentQuestionIndex: 1,
        askedFollowUpIds: [],
        remainingCoreQuestionIds: ['core-2', 'core-3'],
        remainingFollowUpIds: [],
      };

      const session2 = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({}),
      });

      session2.restoreFromSnapshot(snapshot);

      expect(session2.getState()).toBe('in_progress');
      expect(session2.getExchanges().length).toBe(1);
      expect(session2.getQuestionsRemaining()).toBe(2);
    });
  });

  describe('cancel()', () => {
    it('should cancel the session', () => {
      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({}),
      });

      session.cancel();

      expect(session.getState()).toBe('cancelled');
    });
  });

  describe('error handling', () => {
    it('should throw if started without adapter or provider', async () => {
      const session = createInterviewSession({
        questionSet,
      });

      await expect(session.start()).rejects.toThrow(
        'Either cliAdapter or answerProvider must be provided'
      );
    });

    it('should throw if started when not ready', async () => {
      const session = createInterviewSession({
        questionSet,
        answerProvider: new MapAnswerProvider({ 'core-1': 'a', 'core-2': 'b', 'core-3': 'c' }),
        maxFollowUps: 0,
      });

      await session.start();

      await expect(session.start()).rejects.toThrow('Cannot start interview in state');
    });
  });
});

describe('MapAnswerProvider', () => {
  it('should return answers from map by question ID', async () => {
    const provider = new MapAnswerProvider({
      'q1': 'Answer 1',
      'q2': 'Answer 2',
    });

    const question: InterviewQuestion = {
      id: 'q1',
      text: 'Test question',
      type: 'core',
      category: 'general',
      priority: 1,
    };

    const answer = await provider.provideAnswer(question);
    expect(answer).toBe('Answer 1');
  });

  it('should return default answer for unknown questions', async () => {
    const provider = new MapAnswerProvider({}, 'Default answer');

    const question: InterviewQuestion = {
      id: 'unknown',
      text: 'Unknown question',
      type: 'core',
      category: 'general',
      priority: 1,
    };

    const answer = await provider.provideAnswer(question);
    expect(answer).toBe('Default answer');
  });

  it('should return null for unknown questions without default', async () => {
    const provider = new MapAnswerProvider({});

    const question: InterviewQuestion = {
      id: 'unknown',
      text: 'Unknown question',
      type: 'core',
      category: 'general',
      priority: 1,
    };

    const answer = await provider.provideAnswer(question);
    expect(answer).toBeNull();
  });

  it('should accept Map constructor argument', async () => {
    const map = new Map([['q1', 'Map answer']]);
    const provider = new MapAnswerProvider(map);

    const question: InterviewQuestion = {
      id: 'q1',
      text: 'Test',
      type: 'core',
      category: 'general',
      priority: 1,
    };

    const answer = await provider.provideAnswer(question);
    expect(answer).toBe('Map answer');
  });
});

describe('CallbackAnswerProvider', () => {
  it('should call the callback with the question', async () => {
    const callback = vi.fn(async (q: InterviewQuestion) => `Answer to: ${q.text}`);
    const provider = new CallbackAnswerProvider(callback);

    const question: InterviewQuestion = {
      id: 'q1',
      text: 'What is your name?',
      type: 'core',
      category: 'general',
      priority: 1,
    };

    const answer = await provider.provideAnswer(question);

    expect(callback).toHaveBeenCalledWith(question);
    expect(answer).toBe('Answer to: What is your name?');
  });

  it('should return null when callback returns null', async () => {
    const provider = new CallbackAnswerProvider(async () => null);

    const question: InterviewQuestion = {
      id: 'q1',
      text: 'Test',
      type: 'core',
      category: 'general',
      priority: 1,
    };

    const answer = await provider.provideAnswer(question);
    expect(answer).toBeNull();
  });
});
