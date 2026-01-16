/**
 * End-to-End Test Suite
 *
 * Validates the complete flow: spec → analysis → interview → ADRs
 * This test uses mocked LLM responses to test the integration without API calls.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TechLeadAgent, createTechLeadAgent } from '../agents/tech-lead-agent.js';
import { parseSpecContent, loadProjectContext } from '../utils/spec-parser.js';
import { ADRGenerator } from '../adr/adr-generator.js';
import {
  InterviewSession,
  InterviewQuestionGenerator,
  MapAnswerProvider,
} from '../interview/index.js';
import type {
  FeatureContext,
  IdentifiedDecision,
  InterviewResult,
} from '../types/index.js';
import type { AnalysisResult } from '../utils/spec-analyzer.js';

// Sample test spec content (similar to test-feature.md)
const TEST_SPEC_CONTENT = `# Feature: Notification System

## Overview

A notification system that alerts developers when important events occur in their application.

## User Stories

### Primary User Story
As a developer, I want to receive alerts when critical events occur, so that I can respond quickly.

## Functional Requirements

| Requirement | Description |
|-------------|-------------|
| **FR-1** | Support multiple notification channels (email, SMS, webhook) |
| **FR-2** | Allow users to configure notification preferences |
| **FR-3** | Queue notifications for reliable delivery |

## Non-Functional Requirements

| Requirement | Description |
|-------------|-------------|
| **NFR-1** | Notifications should be delivered within 30 seconds |
| **NFR-2** | System should handle 1000 notifications per minute |

## Open Questions

- Should we use a third-party service or self-hosted solution?
- What retry strategy should be used for failed deliveries?
`;

// Mock analysis result that simulates what the LLM would return
const MOCK_DECISIONS = [
  {
    title: 'Notification Delivery Method',
    description: 'Choose between third-party services (SendGrid, Twilio) or self-hosted SMTP/SMS gateways',
    category: 'architecture' as const,
    clarityScore: 0.4,
    options: ['Third-party services', 'Self-hosted solution', 'Hybrid approach'],
  },
  {
    title: 'Message Queue Selection',
    description: 'Select a message queue for reliable notification delivery',
    category: 'library' as const,
    clarityScore: 0.6,
    options: ['Redis', 'RabbitMQ', 'AWS SQS'],
  },
  {
    title: 'Retry Strategy',
    description: 'Define the retry policy for failed notification deliveries',
    category: 'pattern' as const,
    clarityScore: 0.3,
    options: ['Exponential backoff', 'Fixed interval', 'Circuit breaker'],
  },
];

const MOCK_ANALYSIS_RESULT: AnalysisResult = {
  decisions: MOCK_DECISIONS,
  scoredDecisions: MOCK_DECISIONS.map((d) => ({
    ...d,
    needsClarification: d.clarityScore < 0.7,
    ambiguityLevel: d.clarityScore >= 0.7 ? 'clear' as const : d.clarityScore >= 0.4 ? 'moderate' as const : 'unclear' as const,
  })),
  ambiguities: [
    {
      description: 'The spec mentions multiple channels but does not prioritize them',
      suggestedQuestions: ['Which notification channel is the primary focus for MVP?'],
    },
    {
      description: 'No mention of notification template management',
      suggestedQuestions: ['How should notification templates be stored and managed?'],
    },
  ],
  summary: 'The notification system spec requires decisions on delivery infrastructure, queue selection, and retry strategy.',
  stats: {
    totalDecisions: 3,
    decisionsNeedingClarification: 3,
    clearDecisions: 0,
    totalAmbiguities: 2,
    decisionsByCategory: {
      architecture: 1,
      library: 1,
      pattern: 1,
      integration: 0,
      'data-model': 0,
      'api-design': 0,
      security: 0,
      performance: 0,
    },
    averageClarityScore: 0.43,
  },
};

// Mock the spec-analyzer module
vi.mock('../utils/spec-analyzer.js', () => ({
  SpecAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue(MOCK_ANALYSIS_RESULT),
  })),
}));

describe('End-to-End Flow', () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Create a temporary directory for test outputs
    tempDir = path.join(process.cwd(), '.test-output-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Complete Pipeline: Spec → Analysis → Interview → ADRs', () => {
    it('should process a spec through the complete pipeline', async () => {
      // Step 1: Parse the specification
      const parsedSpec = parseSpecContent(TEST_SPEC_CONTENT);
      expect(parsedSpec.title).toBe('Feature: Notification System');
      // Features and requirements are optional in ParsedSpec
      expect(parsedSpec.requirements?.length ?? 0).toBeGreaterThan(0);

      // Step 2: Create feature context
      const projectContext = await loadProjectContext(process.cwd());
      const featureContext: FeatureContext = {
        specPath: '/test/specs/notification.md',
        specContent: TEST_SPEC_CONTENT,
        parsedSpec,
        projectContext,
      };

      // Step 3: Run Tech Lead agent analysis
      const agent = createTechLeadAgent({ apiKey: 'test-key' });
      const interviewResult = await agent.conductInterview(featureContext);

      expect(interviewResult.stakeholderRole).toBe('tech-lead');
      expect(interviewResult.identifiedDecisions.length).toBe(3);
      expect(interviewResult.ambiguities.length).toBe(2);

      // Verify decision categories
      const categories = interviewResult.identifiedDecisions.map((d) => d.category);
      expect(categories).toContain('architecture');
      expect(categories).toContain('library');
      expect(categories).toContain('pattern');

      // Step 4: Generate interview questions based on analysis
      const analysisResult = agent.getLastAnalysisResult();
      expect(analysisResult).toBeDefined();

      const questionGenerator = new InterviewQuestionGenerator({});
      const questionSet = questionGenerator.generateTechLeadQuestions(analysisResult!);

      expect(questionSet.coreQuestions.length).toBeGreaterThanOrEqual(1);

      // Step 5: Simulate interview with programmatic answers
      const answerMap = new Map<string, string>();
      // Pre-populate answers for any questions that might be asked
      answerMap.set('primary-delivery-method', 'Third-party services for reliability');
      answerMap.set('queue-preference', 'Redis for simplicity');
      answerMap.set('retry-strategy', 'Exponential backoff with max 3 retries');

      const answerProvider = new MapAnswerProvider(answerMap);
      const session = new InterviewSession({
        questionSet,
        answerProvider,
      });

      const exchanges = await session.start();

      // Exchanges may be empty if all questions had pre-populated answers
      expect(Array.isArray(exchanges)).toBe(true);

      // Step 6: Generate ADRs from decisions
      const adrOutputDir = path.join(tempDir, 'adr');
      const adrGenerator = new ADRGenerator({ outputDir: adrOutputDir });
      await adrGenerator.initialize();

      const finalInterviewResult: InterviewResult = {
        ...interviewResult,
        exchanges,
      };

      const adrs = adrGenerator.generateFromDecisions(
        finalInterviewResult.identifiedDecisions,
        finalInterviewResult
      );

      expect(adrs.length).toBe(3);

      // Verify ADR structure
      for (const adr of adrs) {
        expect(adr.number).toMatch(/^\d{3}$/);
        expect(adr.fullTitle).toMatch(/^ADR-\d{3}:/);
        expect(adr.content).toContain('## Status');
        expect(adr.content).toContain('## Context');
        expect(adr.content).toContain('## Decision');
        expect(adr.content).toContain('## Consequences');
        expect(adr.content).toContain('## Alternatives Considered');
        expect(adr.filename).toMatch(/^ADR-\d{3}-.*\.md$/);
      }

      // Step 7: Write ADRs to filesystem
      const writeResult = await adrGenerator.writeADRs(adrs);

      expect(writeResult.success).toBe(true);
      expect(writeResult.writtenFiles.length).toBe(3);
      expect(writeResult.errors.length).toBe(0);

      // Verify files were actually written
      for (const filePath of writeResult.writtenFiles) {
        const exists = await fs.stat(filePath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    it('should handle specs with no ambiguities in autonomous mode', async () => {
      // Create a spec with high clarity scores
      const clearDecision = {
        title: 'Simple Decision',
        description: 'A clear-cut decision with no ambiguity',
        category: 'architecture' as const,
        clarityScore: 0.9,
        options: ['Option A', 'Option B'],
      };
      const clearAnalysisResult: AnalysisResult = {
        decisions: [clearDecision],
        scoredDecisions: [{
          ...clearDecision,
          needsClarification: false,
          ambiguityLevel: 'clear' as const,
        }],
        ambiguities: [],
        summary: 'Clear spec with no ambiguities',
        stats: {
          totalDecisions: 1,
          decisionsNeedingClarification: 0,
          clearDecisions: 1,
          totalAmbiguities: 0,
          decisionsByCategory: {
            architecture: 1,
            library: 0,
            pattern: 0,
            integration: 0,
            'data-model': 0,
            'api-design': 0,
            security: 0,
            performance: 0,
          },
          averageClarityScore: 0.9,
        },
      };

      // Update mock for this test
      const { SpecAnalyzer } = await import('../utils/spec-analyzer.js');
      vi.mocked(SpecAnalyzer).mockImplementation(() => ({
        analyze: vi.fn().mockResolvedValue(clearAnalysisResult),
      }));

      const parsedSpec = parseSpecContent(TEST_SPEC_CONTENT);
      const projectContext = await loadProjectContext(process.cwd());
      const featureContext: FeatureContext = {
        specPath: '/test/specs/clear.md',
        specContent: TEST_SPEC_CONTENT,
        parsedSpec,
        projectContext,
      };

      const agent = new TechLeadAgent({ apiKey: 'test-key' });
      const result = await agent.conductInterview(featureContext);

      // In autonomous mode, high clarity decisions don't require interview
      expect(result.identifiedDecisions.length).toBe(1);
      expect(result.identifiedDecisions[0].clarityScore).toBe(0.9);
      expect(result.ambiguities.length).toBe(0);
    });
  });

  describe('Programmatic Module Usage', () => {
    it('should support programmatic invocation for orchestrator integration', async () => {
      // This test validates FR-12: Programmatic invocation via module export

      // Import all necessary components
      const { TechLeadAgent } = await import('../agents/tech-lead-agent.js');
      const { parseSpecContent: parseSpec, loadProjectContext: loadContext } = await import('../utils/spec-parser.js');
      const { ADRGenerator } = await import('../adr/adr-generator.js');

      // Create context programmatically
      const parsedSpec = parseSpec(TEST_SPEC_CONTENT);
      const projectContext = await loadContext(process.cwd());

      const context: FeatureContext = {
        specPath: '/test/feature.md',
        specContent: TEST_SPEC_CONTENT,
        parsedSpec,
        projectContext,
      };

      // Run agent
      const agent = new TechLeadAgent({ apiKey: 'programmatic-test' });
      const interviewResult = await agent.conductInterview(context);

      // Process results
      expect(interviewResult.stakeholderRole).toBe('tech-lead');
      expect(interviewResult.identifiedDecisions).toBeDefined();
      expect(interviewResult.completedAt).toBeInstanceOf(Date);

      // Generate ADRs programmatically
      const adrOutputDir = path.join(tempDir, 'programmatic-adr');
      const generator = new ADRGenerator({ outputDir: adrOutputDir });
      await generator.initialize();

      const adrs = generator.generateFromDecisions(interviewResult.identifiedDecisions, interviewResult);
      const writeResult = await generator.writeADRs(adrs);

      expect(writeResult.success).toBe(true);
    });

    it('should expose all necessary types for external consumers', async () => {
      // Verify that all types needed for programmatic use are exported
      const mainExports = await import('../index.js');

      // Agent exports
      expect(mainExports.TechLeadAgent).toBeDefined();
      expect(mainExports.createTechLeadAgent).toBeDefined();

      // Utility exports
      expect(mainExports.parseSpec).toBeDefined();
      expect(mainExports.parseSpecContent).toBeDefined();
      expect(mainExports.loadProjectContext).toBeDefined();
      expect(mainExports.createLLMClient).toBeDefined();

      // Interview exports
      expect(mainExports.InterviewSession).toBeDefined();
      expect(mainExports.InterviewQuestionGenerator).toBeDefined();
      expect(mainExports.MapAnswerProvider).toBeDefined();
      expect(mainExports.CallbackAnswerProvider).toBeDefined();

      // ADR exports
      expect(mainExports.ADRGenerator).toBeDefined();
      expect(mainExports.createADRGenerator).toBeDefined();
      expect(mainExports.renderADRTemplate).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed spec content gracefully', () => {
      const malformedSpec = 'This is not a valid markdown spec with headers';

      // Should not throw, but return a spec with empty/default values
      const parsed = parseSpecContent(malformedSpec);

      // Without headers, the title will be 'Untitled Spec'
      expect(parsed.title).toBe('Untitled Spec');
      // Features and requirements are optional, so they should be undefined
      expect(parsed.features).toBeUndefined();
      expect(parsed.requirements).toBeUndefined();
    });

    it('should handle ADR write failures gracefully', async () => {
      const generator = new ADRGenerator({ outputDir: '/nonexistent/readonly/path' });

      const mockDecisions: IdentifiedDecision[] = [
        {
          title: 'Test Decision',
          description: 'Test description',
          category: 'architecture',
          clarityScore: 0.5,
          options: [],
        },
      ];

      const adrs = generator.generateFromDecisions(mockDecisions);
      const writeResult = await generator.writeADRs(adrs);

      // Should fail gracefully with error information
      expect(writeResult.success).toBe(false);
      expect(writeResult.errors.length).toBeGreaterThan(0);
    });
  });
});
