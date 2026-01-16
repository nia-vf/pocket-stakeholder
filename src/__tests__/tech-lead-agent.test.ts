import { describe, it, expect, beforeEach } from 'vitest';
import { TechLeadAgent, createTechLeadAgent } from '../agents/tech-lead-agent.js';
import type { FeatureContext, ParsedSpec, ProjectContext } from '../types/index.js';

describe('TechLeadAgent', () => {
  let agent: TechLeadAgent;

  beforeEach(() => {
    agent = new TechLeadAgent();
  });

  describe('constructor', () => {
    it('should create an agent with default config', () => {
      expect(agent.role).toBe('tech-lead');
    });

    it('should accept custom config', () => {
      const customAgent = new TechLeadAgent({
        apiKey: 'test-key',
        model: 'claude-opus-4-20250514',
      });
      expect(customAgent.role).toBe('tech-lead');
    });
  });

  describe('createTechLeadAgent factory', () => {
    it('should create a TechLeadAgent instance', () => {
      const factoryAgent = createTechLeadAgent();
      expect(factoryAgent).toBeInstanceOf(TechLeadAgent);
      expect(factoryAgent.role).toBe('tech-lead');
    });

    it('should pass config to the agent', () => {
      const factoryAgent = createTechLeadAgent({ model: 'claude-opus-4-20250514' });
      expect(factoryAgent.role).toBe('tech-lead');
    });
  });

  describe('conductInterview', () => {
    it('should return an InterviewResult with correct structure', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      expect(result).toHaveProperty('stakeholderRole', 'tech-lead');
      expect(result).toHaveProperty('exchanges');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('identifiedDecisions');
      expect(result).toHaveProperty('ambiguities');
      expect(result).toHaveProperty('completedAt');
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should return arrays for collection properties', async () => {
      const context = createMockFeatureContext();
      const result = await agent.conductInterview(context);

      expect(Array.isArray(result.exchanges)).toBe(true);
      expect(Array.isArray(result.insights)).toBe(true);
      expect(Array.isArray(result.identifiedDecisions)).toBe(true);
      expect(Array.isArray(result.ambiguities)).toBe(true);
    });
  });

  describe('generateRecommendations', () => {
    it('should return a Recommendations object with correct structure', async () => {
      const answers = { answers: new Map<string, string>() };
      const result = await agent.generateRecommendations(answers);

      expect(result).toHaveProperty('stakeholderRole', 'tech-lead');
      expect(result).toHaveProperty('adrs');
      expect(result).toHaveProperty('generalRecommendations');
      expect(result).toHaveProperty('warnings');
    });

    it('should return arrays for collection properties', async () => {
      const answers = { answers: new Map<string, string>() };
      const result = await agent.generateRecommendations(answers);

      expect(Array.isArray(result.adrs)).toBe(true);
      expect(Array.isArray(result.generalRecommendations)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});

/**
 * Helper function to create a mock FeatureContext for testing
 */
function createMockFeatureContext(): FeatureContext {
  const parsedSpec: ParsedSpec = {
    title: 'Test Feature',
    overview: 'A test feature for unit testing',
    features: [
      {
        name: 'Feature 1',
        description: 'First test feature',
        priority: 'P0',
      },
    ],
    requirements: [
      {
        id: 'FR-1',
        description: 'Test requirement',
        type: 'functional',
      },
    ],
    otherSections: {},
  };

  const projectContext: ProjectContext = {
    projectRoot: '/test/project',
    existingDecisions: [],
  };

  return {
    specPath: '/test/specs/test-feature.md',
    specContent: '# Test Feature\n\nTest content',
    parsedSpec,
    projectContext,
  };
}
