/**
 * Pipeline Orchestrator Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineOrchestrator, createPipelineOrchestrator } from '../orchestrator/pipeline.js';
import type { FeatureContext, InterviewResult, StakeholderRole } from '../types/index.js';

// Mock the agent modules
vi.mock('../agents/tech-lead-agent.js', () => ({
  TechLeadAgent: vi.fn().mockImplementation(() => ({
    role: 'tech-lead',
    conductInterview: vi.fn().mockResolvedValue({
      stakeholderRole: 'tech-lead',
      exchanges: [],
      insights: ['Tech insight 1', 'Tech insight 2'],
      identifiedDecisions: [
        {
          title: 'Database Choice',
          category: 'architecture',
          description: 'Choose database technology',
          clarityScore: 0.7,
        },
      ],
      ambiguities: [
        {
          description: 'Scaling requirements unclear',
          suggestedQuestions: ['What is the expected load?'],
        },
      ],
      completedAt: new Date(),
    }),
    generateRecommendations: vi.fn().mockResolvedValue({
      stakeholderRole: 'tech-lead',
      adrs: [],
      generalRecommendations: [],
      warnings: [],
    }),
  })),
}));

vi.mock('../agents/qa-agent.js', () => ({
  QAAgent: vi.fn().mockImplementation(() => ({
    role: 'qa',
    conductInterview: vi.fn().mockResolvedValue({
      stakeholderRole: 'qa',
      exchanges: [],
      insights: ['QA insight 1'],
      identifiedDecisions: [
        {
          title: 'Testing Strategy: API',
          category: 'pattern',
          description: 'Define API testing approach',
          clarityScore: 0.5,
        },
      ],
      ambiguities: [],
      completedAt: new Date(),
    }),
    generateRecommendations: vi.fn().mockResolvedValue({
      stakeholderRole: 'qa',
      adrs: [],
      generalRecommendations: [],
      warnings: [],
    }),
  })),
}));

vi.mock('../agents/ux-agent.js', () => ({
  UXAgent: vi.fn().mockImplementation(() => ({
    role: 'ux',
    conductInterview: vi.fn().mockResolvedValue({
      stakeholderRole: 'ux',
      exchanges: [],
      insights: ['UX insight 1', 'UX insight 2', 'UX insight 3'],
      identifiedDecisions: [
        {
          title: 'UX Decision: Navigation',
          category: 'pattern',
          description: 'Navigation pattern choice',
          clarityScore: 0.6,
        },
      ],
      ambiguities: [
        {
          description: 'User personas not defined',
          suggestedQuestions: ['Who are the target users?'],
        },
      ],
      completedAt: new Date(),
    }),
    generateRecommendations: vi.fn().mockResolvedValue({
      stakeholderRole: 'ux',
      adrs: [],
      generalRecommendations: [],
      warnings: [],
    }),
  })),
}));

describe('PipelineOrchestrator', () => {
  let mockContext: FeatureContext;

  beforeEach(() => {
    mockContext = {
      specPath: '/test/spec.md',
      specContent: '# Test Spec\n\nThis is a test.',
      parsedSpec: {
        title: 'Test Spec',
        overview: 'A test specification',
        otherSections: {},
      },
      projectContext: {
        projectRoot: '/test',
        existingDecisions: [],
      },
    };
  });

  describe('constructor', () => {
    it('should create orchestrator with default config', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(orchestrator.stakeholders).toEqual(['tech-lead', 'qa', 'ux']);
    });

    it('should accept custom stakeholder order', () => {
      const orchestrator = new PipelineOrchestrator({
        stakeholders: ['qa', 'tech-lead'],
      });
      expect(orchestrator.stakeholders).toEqual(['qa', 'tech-lead']);
    });

    it('should initialize agents for configured stakeholders', () => {
      const orchestrator = new PipelineOrchestrator();
      expect(orchestrator.getAgent('tech-lead')).toBeDefined();
      expect(orchestrator.getAgent('qa')).toBeDefined();
      expect(orchestrator.getAgent('ux')).toBeDefined();
    });
  });

  describe('run', () => {
    it('should run all stakeholders in sequence', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.run(mockContext);

      expect(result.interviews).toHaveLength(3);
      expect(result.interviews[0].stakeholderRole).toBe('tech-lead');
      expect(result.interviews[1].stakeholderRole).toBe('qa');
      expect(result.interviews[2].stakeholderRole).toBe('ux');
    });

    it('should aggregate insights from all stakeholders', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.run(mockContext);

      expect(result.combinedInsights).toContain('[Tech Lead] Tech insight 1');
      expect(result.combinedInsights).toContain('[QA] QA insight 1');
      expect(result.combinedInsights).toContain('[UX] UX insight 1');
    });

    it('should aggregate decisions from all stakeholders', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.run(mockContext);

      expect(result.allDecisions).toHaveLength(3);
      expect(result.allDecisions.map((d) => d.title)).toContain('Database Choice');
      expect(result.allDecisions.map((d) => d.title)).toContain('Testing Strategy: API');
      expect(result.allDecisions.map((d) => d.title)).toContain('UX Decision: Navigation');
    });

    it('should aggregate ambiguities from all stakeholders', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.run(mockContext);

      expect(result.allAmbiguities).toHaveLength(2);
    });

    it('should call progress callback with events', async () => {
      const orchestrator = new PipelineOrchestrator();
      const progressEvents: Array<{ type: string; stakeholder?: StakeholderRole }> = [];

      await orchestrator.run(mockContext, {
        onProgress: (event) => {
          progressEvents.push({ type: event.type, stakeholder: event.stakeholder });
        },
      });

      // Should have start and complete for each stakeholder, plus pipeline_complete
      expect(progressEvents.filter((e) => e.type === 'stakeholder_start')).toHaveLength(3);
      expect(progressEvents.filter((e) => e.type === 'stakeholder_complete')).toHaveLength(3);
      expect(progressEvents.filter((e) => e.type === 'pipeline_complete')).toHaveLength(1);
    });

    it('should include completedAt timestamp', async () => {
      const orchestrator = new PipelineOrchestrator();
      const before = new Date();
      const result = await orchestrator.run(mockContext);
      const after = new Date();

      expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.completedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('runSingle', () => {
    it('should run a single stakeholder', async () => {
      const orchestrator = new PipelineOrchestrator();
      const result = await orchestrator.runSingle('tech-lead', mockContext);

      expect(result.stakeholderRole).toBe('tech-lead');
      expect(result.insights).toContain('Tech insight 1');
    });

    it('should throw error for unconfigured stakeholder', async () => {
      const orchestrator = new PipelineOrchestrator({ stakeholders: ['qa'] });

      await expect(orchestrator.runSingle('tech-lead', mockContext)).rejects.toThrow(
        "Stakeholder agent 'tech-lead' is not configured"
      );
    });

    it('should accept previous interview context', async () => {
      const orchestrator = new PipelineOrchestrator();
      const previousInterview: InterviewResult = {
        stakeholderRole: 'tech-lead',
        exchanges: [],
        insights: ['Previous insight'],
        identifiedDecisions: [],
        ambiguities: [],
        completedAt: new Date(),
      };

      // This should not throw - the QA agent receives the previous context
      const result = await orchestrator.runSingle('qa', mockContext, [previousInterview]);
      expect(result.stakeholderRole).toBe('qa');
    });
  });

  describe('createPipelineOrchestrator factory', () => {
    it('should create orchestrator with default config', () => {
      const orchestrator = createPipelineOrchestrator();
      expect(orchestrator.stakeholders).toEqual(['tech-lead', 'qa', 'ux']);
    });

    it('should create orchestrator with custom config', () => {
      const orchestrator = createPipelineOrchestrator({
        stakeholders: ['ux'],
      });
      expect(orchestrator.stakeholders).toEqual(['ux']);
    });
  });
});
