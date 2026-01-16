/**
 * Tests for Interview Question Generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InterviewQuestionGenerator,
  createQuestionGenerator,
  selectFollowUps,
  type InterviewQuestion,
  type QuestionSet,
} from '../interview/question-generator.js';
import type { AnalysisResult, ScoredDecision } from '../utils/spec-analyzer.js';
import type { IdentifiedDecision, Ambiguity } from '../types/index.js';

describe('InterviewQuestionGenerator', () => {
  let generator: InterviewQuestionGenerator;

  beforeEach(() => {
    generator = new InterviewQuestionGenerator();
  });

  describe('generateTechLeadQuestions', () => {
    it('should generate a question set for tech-lead role', () => {
      const analysisResult = createMockAnalysisResult();
      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      expect(questionSet.role).toBe('tech-lead');
      expect(questionSet.coreQuestions).toBeDefined();
      expect(questionSet.followUpQuestions).toBeDefined();
      expect(questionSet.estimatedQuestionCount).toBeDefined();
    });

    it('should generate 5-8 core questions', () => {
      const analysisResult = createMockAnalysisResult();
      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      expect(questionSet.coreQuestions.length).toBeGreaterThanOrEqual(5);
      expect(questionSet.coreQuestions.length).toBeLessThanOrEqual(8);
    });

    it('should generate questions with required properties', () => {
      const analysisResult = createMockAnalysisResult();
      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      for (const question of questionSet.coreQuestions) {
        expect(question.id).toBeDefined();
        expect(question.text).toBeDefined();
        expect(question.type).toBe('core');
        expect(question.category).toBeDefined();
        expect(typeof question.priority).toBe('number');
      }
    });

    it('should prioritize questions for decisions needing clarification', () => {
      const analysisResult = createMockAnalysisResult([
        createMockDecision('Auth Strategy', 'security', 0.3, true),
        createMockDecision('Database Choice', 'data-model', 0.9, false),
      ]);

      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      // First question should relate to the unclear decision
      const authQuestion = questionSet.coreQuestions.find(
        (q) => q.relatedDecisionTitle === 'Auth Strategy'
      );
      expect(authQuestion).toBeDefined();
    });

    it('should include questions for ambiguities', () => {
      const analysisResult = createMockAnalysisResult(
        [],
        [createMockAmbiguity('Scaling requirements unclear')]
      );

      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      const ambiguityQuestion = questionSet.coreQuestions.find(
        (q) => q.relatedAmbiguityDescription === 'Scaling requirements unclear'
      );
      expect(ambiguityQuestion).toBeDefined();
    });

    it('should provide estimated question count', () => {
      const analysisResult = createMockAnalysisResult();
      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      expect(questionSet.estimatedQuestionCount.min).toBeLessThanOrEqual(
        questionSet.estimatedQuestionCount.max
      );
      expect(questionSet.estimatedQuestionCount.min).toBe(
        questionSet.coreQuestions.length
      );
    });
  });

  describe('follow-up questions', () => {
    it('should generate follow-up questions', () => {
      const analysisResult = createMockAnalysisResult([
        createMockDecision('Performance Tuning', 'performance', 0.5, true),
      ]);

      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      expect(questionSet.followUpQuestions.length).toBeGreaterThan(0);
      expect(questionSet.followUpQuestions.length).toBeLessThanOrEqual(8);
    });

    it('should have follow-up triggers defined', () => {
      const analysisResult = createMockAnalysisResult([
        createMockDecision('API Design', 'api-design', 0.4, true),
      ]);

      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      const followUpsWithTriggers = questionSet.followUpQuestions.filter(
        (q) => q.followUpTrigger
      );
      expect(followUpsWithTriggers.length).toBeGreaterThan(0);
    });
  });

  describe('custom configuration', () => {
    it('should respect minimum core questions config', () => {
      const customGenerator = new InterviewQuestionGenerator({
        minCoreQuestions: 6,
      });
      const analysisResult = createMockAnalysisResult();
      const questionSet = customGenerator.generateTechLeadQuestions(analysisResult);

      expect(questionSet.coreQuestions.length).toBeGreaterThanOrEqual(6);
    });

    it('should respect maximum core questions config', () => {
      const customGenerator = new InterviewQuestionGenerator({
        maxCoreQuestions: 6,
      });
      const analysisResult = createMockAnalysisResult([
        createMockDecision('Decision 1', 'architecture', 0.3, true),
        createMockDecision('Decision 2', 'library', 0.3, true),
        createMockDecision('Decision 3', 'pattern', 0.3, true),
        createMockDecision('Decision 4', 'integration', 0.3, true),
        createMockDecision('Decision 5', 'data-model', 0.3, true),
        createMockDecision('Decision 6', 'api-design', 0.3, true),
        createMockDecision('Decision 7', 'security', 0.3, true),
        createMockDecision('Decision 8', 'performance', 0.3, true),
      ]);

      const questionSet = customGenerator.generateTechLeadQuestions(analysisResult);

      expect(questionSet.coreQuestions.length).toBeLessThanOrEqual(6);
    });
  });
});

describe('selectFollowUps', () => {
  it('should return follow-ups triggered by keywords in the answer', () => {
    const followUps: InterviewQuestion[] = [
      {
        id: 'followup-1',
        text: 'What caching strategy?',
        type: 'follow-up',
        category: 'performance',
        priority: 10,
        followUpTrigger: {
          afterQuestionId: 'core-1',
          triggerKeywords: ['performance', 'cache', 'fast'],
        },
      },
      {
        id: 'followup-2',
        text: 'Security requirements?',
        type: 'follow-up',
        category: 'security',
        priority: 11,
        followUpTrigger: {
          afterQuestionId: 'core-1',
          triggerKeywords: ['secure', 'auth'],
        },
      },
    ];

    const answer = 'We need high performance and caching support';
    const result = selectFollowUps(answer, 'core-1', followUps);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('followup-1');
  });

  it('should return follow-ups marked as alwaysAsk', () => {
    const followUps: InterviewQuestion[] = [
      {
        id: 'followup-1',
        text: 'What are the trade-offs?',
        type: 'follow-up',
        category: 'general',
        priority: 10,
        followUpTrigger: {
          afterQuestionId: 'core-1',
          alwaysAsk: true,
        },
      },
    ];

    const answer = 'Any random answer without keywords';
    const result = selectFollowUps(answer, 'core-1', followUps);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('followup-1');
  });

  it('should only return follow-ups for the correct question', () => {
    const followUps: InterviewQuestion[] = [
      {
        id: 'followup-1',
        text: 'Follow-up for question 1',
        type: 'follow-up',
        category: 'general',
        priority: 10,
        followUpTrigger: {
          afterQuestionId: 'core-1',
          alwaysAsk: true,
        },
      },
      {
        id: 'followup-2',
        text: 'Follow-up for question 2',
        type: 'follow-up',
        category: 'general',
        priority: 11,
        followUpTrigger: {
          afterQuestionId: 'core-2',
          alwaysAsk: true,
        },
      },
    ];

    const result = selectFollowUps('answer', 'core-2', followUps);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('followup-2');
  });

  it('should return empty array when no triggers match', () => {
    const followUps: InterviewQuestion[] = [
      {
        id: 'followup-1',
        text: 'What about scaling?',
        type: 'follow-up',
        category: 'performance',
        priority: 10,
        followUpTrigger: {
          afterQuestionId: 'core-1',
          triggerKeywords: ['scale', 'grow'],
        },
      },
    ];

    const answer = 'Simple local deployment only';
    const result = selectFollowUps(answer, 'core-1', followUps);

    expect(result).toHaveLength(0);
  });

  it('should handle case-insensitive keyword matching', () => {
    const followUps: InterviewQuestion[] = [
      {
        id: 'followup-1',
        text: 'What about Performance?',
        type: 'follow-up',
        category: 'performance',
        priority: 10,
        followUpTrigger: {
          afterQuestionId: 'core-1',
          triggerKeywords: ['PERFORMANCE'],
        },
      },
    ];

    const answer = 'We need good performance';
    const result = selectFollowUps(answer, 'core-1', followUps);

    expect(result).toHaveLength(1);
  });
});

describe('createQuestionGenerator', () => {
  it('should create a generator with default config', () => {
    const generator = createQuestionGenerator();
    expect(generator).toBeInstanceOf(InterviewQuestionGenerator);
  });

  it('should create a generator with custom config', () => {
    const generator = createQuestionGenerator({
      minCoreQuestions: 6,
      maxCoreQuestions: 7,
      maxFollowUpQuestions: 4,
    });
    expect(generator).toBeInstanceOf(InterviewQuestionGenerator);
  });
});

// Helper functions to create mock data

function createMockDecision(
  title: string,
  category: IdentifiedDecision['category'],
  clarityScore: number,
  needsClarification: boolean
): ScoredDecision {
  return {
    title,
    category,
    description: `Decision about ${title}`,
    clarityScore,
    needsClarification,
    ambiguityLevel: clarityScore >= 0.7 ? 'clear' : clarityScore >= 0.4 ? 'moderate' : 'unclear',
  };
}

function createMockAmbiguity(description: string): Ambiguity {
  return {
    description,
    suggestedQuestions: [`Can you clarify ${description}?`],
  };
}

function createMockAnalysisResult(
  decisions: ScoredDecision[] = [],
  ambiguities: Ambiguity[] = []
): AnalysisResult {
  // Default decisions if none provided
  const defaultDecisions: ScoredDecision[] =
    decisions.length > 0
      ? decisions
      : [
          createMockDecision('API Design', 'api-design', 0.5, true),
          createMockDecision('Database Schema', 'data-model', 0.7, false),
        ];

  const baseDecisions: IdentifiedDecision[] = defaultDecisions.map((d) => ({
    title: d.title,
    category: d.category,
    description: d.description,
    clarityScore: d.clarityScore,
  }));

  return {
    decisions: baseDecisions,
    scoredDecisions: defaultDecisions,
    ambiguities,
    summary: 'Mock analysis summary',
    stats: {
      totalDecisions: defaultDecisions.length,
      decisionsNeedingClarification: defaultDecisions.filter((d) => d.needsClarification).length,
      clearDecisions: defaultDecisions.filter((d) => !d.needsClarification).length,
      totalAmbiguities: ambiguities.length,
      decisionsByCategory: {
        architecture: 0,
        library: 0,
        pattern: 0,
        integration: 0,
        'data-model': defaultDecisions.filter((d) => d.category === 'data-model').length,
        'api-design': defaultDecisions.filter((d) => d.category === 'api-design').length,
        security: 0,
        performance: 0,
      },
      averageClarityScore: 0.6,
    },
  };
}
