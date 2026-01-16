/**
 * Tests for the ADR Generator module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ADRGenerator,
  createADRGenerator,
  ADRNumberingSystem,
  renderADRTemplate,
  formatADRNumber,
  generateADRFilename,
  decisionToADRDraft,
  type ADRStatus,
  type RenderedADR,
} from '../adr/adr-generator.js';
import type {
  ADRDraft,
  IdentifiedDecision,
  InterviewResult,
  DecisionCategory,
} from '../types/index.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

describe('renderADRTemplate', () => {
  const mockDraft: ADRDraft = {
    title: 'Use TypeScript',
    category: 'architecture',
    context: 'We need to choose a language for the project.',
    decision: 'We will use TypeScript for type safety.',
    consequences: {
      positive: ['Better type safety', 'Improved developer experience'],
      negative: ['Additional build step', 'Learning curve for some developers'],
    },
    alternativesConsidered: [
      {
        name: 'JavaScript',
        description: 'Plain JavaScript without types',
        pros: ['No build step required', 'Familiar to all developers'],
        cons: ['No type safety', 'More runtime errors'],
        rejectionReason: 'Type safety is important for this project',
      },
    ],
  };

  it('should render a complete ADR with all sections', () => {
    const result = renderADRTemplate('001', mockDraft, 'Proposed');

    expect(result).toContain('# ADR-001: Use TypeScript');
    expect(result).toContain('## Status');
    expect(result).toContain('Proposed');
    expect(result).toContain('## Context');
    expect(result).toContain('We need to choose a language for the project.');
    expect(result).toContain('## Decision');
    expect(result).toContain('We will use TypeScript for type safety.');
    expect(result).toContain('## Consequences');
    expect(result).toContain('### Positive');
    expect(result).toContain('- Better type safety');
    expect(result).toContain('### Negative');
    expect(result).toContain('- Additional build step');
    expect(result).toContain('## Alternatives Considered');
    expect(result).toContain('### JavaScript');
  });

  it('should include alternative pros and cons', () => {
    const result = renderADRTemplate('001', mockDraft);

    expect(result).toContain('**Pros:**');
    expect(result).toContain('- No build step required');
    expect(result).toContain('**Cons:**');
    expect(result).toContain('- No type safety');
    expect(result).toContain('**Rejection Reason:**');
    expect(result).toContain('Type safety is important for this project');
  });

  it('should handle empty consequences', () => {
    const draft: ADRDraft = {
      ...mockDraft,
      consequences: { positive: [], negative: [] },
    };

    const result = renderADRTemplate('001', draft);

    expect(result).toContain('- None identified');
  });

  it('should handle no alternatives', () => {
    const draft: ADRDraft = {
      ...mockDraft,
      alternativesConsidered: [],
    };

    const result = renderADRTemplate('001', draft);

    expect(result).toContain('No alternatives were explicitly considered.');
  });

  it('should use default status of Proposed', () => {
    const result = renderADRTemplate('001', mockDraft);

    expect(result).toContain('## Status\nProposed');
  });

  it('should support different status values', () => {
    const statuses: ADRStatus[] = ['Proposed', 'Accepted', 'Deprecated', 'Superseded'];

    for (const status of statuses) {
      const result = renderADRTemplate('001', mockDraft, status);
      expect(result).toContain(`## Status\n${status}`);
    }
  });
});

describe('formatADRNumber', () => {
  it('should pad numbers with leading zeros', () => {
    expect(formatADRNumber(1)).toBe('001');
    expect(formatADRNumber(10)).toBe('010');
    expect(formatADRNumber(100)).toBe('100');
    expect(formatADRNumber(999)).toBe('999');
  });

  it('should handle numbers over 999', () => {
    expect(formatADRNumber(1000)).toBe('1000');
  });

  it('should prepend feature name when provided', () => {
    expect(formatADRNumber(1, 'auth')).toBe('auth-001');
    expect(formatADRNumber(42, 'user-settings')).toBe('user-settings-042');
  });

  it('should sanitize feature names', () => {
    expect(formatADRNumber(1, 'My Feature!')).toBe('my-feature-001');
    expect(formatADRNumber(1, 'Feature @#$% Name')).toBe('feature-name-001');
    expect(formatADRNumber(1, '  Feature  ')).toBe('feature-001');
  });
});

describe('generateADRFilename', () => {
  it('should generate valid filenames', () => {
    expect(generateADRFilename('001', 'Use TypeScript')).toBe('ADR-001-use-typescript.md');
    expect(generateADRFilename('042', 'Choose Database')).toBe('ADR-042-choose-database.md');
  });

  it('should sanitize special characters in title', () => {
    expect(generateADRFilename('001', 'Use Node.js (v18+)')).toBe('ADR-001-use-node-js-v18.md');
    expect(generateADRFilename('001', 'API Design: REST vs GraphQL')).toBe(
      'ADR-001-api-design-rest-vs-graphql.md'
    );
  });

  it('should handle feature-prefixed numbers', () => {
    expect(generateADRFilename('auth-001', 'OAuth Implementation')).toBe(
      'ADR-auth-001-oauth-implementation.md'
    );
  });
});

describe('decisionToADRDraft', () => {
  const mockDecision: IdentifiedDecision = {
    title: 'Choose Database',
    category: 'data-model',
    description: 'Need to select a primary database for the application.',
    clarityScore: 0.7,
    options: ['PostgreSQL', 'MongoDB', 'SQLite'],
  };

  it('should convert a decision to an ADR draft', () => {
    const draft = decisionToADRDraft(mockDecision);

    expect(draft.title).toBe('Choose Database');
    expect(draft.category).toBe('data-model');
    expect(draft.context).toContain('Need to select a primary database');
  });

  it('should convert options to alternatives', () => {
    const draft = decisionToADRDraft(mockDecision);

    expect(draft.alternativesConsidered).toHaveLength(3);
    expect(draft.alternativesConsidered[0].name).toBe('PostgreSQL');
    expect(draft.alternativesConsidered[1].name).toBe('MongoDB');
    expect(draft.alternativesConsidered[2].name).toBe('SQLite');
  });

  it('should handle decision without options', () => {
    const decision: IdentifiedDecision = {
      title: 'Authentication Method',
      category: 'security',
      description: 'Need to choose authentication approach.',
      clarityScore: 0.5,
    };

    const draft = decisionToADRDraft(decision);

    expect(draft.alternativesConsidered).toHaveLength(0);
  });

  it('should incorporate interview context when provided', () => {
    const interview: InterviewResult = {
      stakeholderRole: 'tech-lead',
      exchanges: [
        {
          question: 'What are your scalability requirements for the database?',
          answer: 'We expect to handle millions of records.',
          followUpTriggered: false,
        },
        {
          question: 'Any preferences for Choose Database?',
          answer: 'We prefer PostgreSQL for its reliability.',
          followUpTriggered: false,
        },
      ],
      insights: ['Database choice is critical for scalability'],
      identifiedDecisions: [],
      ambiguities: [],
      completedAt: new Date(),
    };

    const draft = decisionToADRDraft(mockDecision, interview);

    expect(draft.context).toContain('We prefer PostgreSQL');
  });
});

describe('ADRNumberingSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start from configured number', () => {
    const system = new ADRNumberingSystem({ startingNumber: 5 });
    expect(system.peekNextNumber()).toBe('005');
  });

  it('should start from 1 by default', () => {
    const system = new ADRNumberingSystem({});
    expect(system.peekNextNumber()).toBe('001');
  });

  it('should increment numbers correctly', () => {
    const system = new ADRNumberingSystem({ startingNumber: 1 });

    expect(system.getNextNumber()).toBe('001');
    expect(system.getNextNumber()).toBe('002');
    expect(system.getNextNumber()).toBe('003');
  });

  it('should not increment on peek', () => {
    const system = new ADRNumberingSystem({ startingNumber: 1 });

    expect(system.peekNextNumber()).toBe('001');
    expect(system.peekNextNumber()).toBe('001');
    expect(system.getNextNumber()).toBe('001');
    expect(system.peekNextNumber()).toBe('002');
  });

  it('should use feature prefix when global numbering is disabled', () => {
    const system = new ADRNumberingSystem({
      featureName: 'auth',
      globalNumbering: false,
    });

    expect(system.getNextNumber()).toBe('auth-001');
    expect(system.getNextNumber()).toBe('auth-002');
  });

  it('should not use feature prefix when global numbering is enabled', () => {
    const system = new ADRNumberingSystem({
      featureName: 'auth',
      globalNumbering: true,
    });

    expect(system.getNextNumber()).toBe('001');
  });

  it('should reset to a specific number', () => {
    const system = new ADRNumberingSystem({ startingNumber: 1 });

    system.getNextNumber(); // 001
    system.getNextNumber(); // 002
    system.reset(10);

    expect(system.getNextNumber()).toBe('010');
  });

  describe('scanExistingADRs', () => {
    it('should find highest existing ADR number', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([
        'ADR-001-use-typescript.md',
        'ADR-002-choose-database.md',
        'ADR-010-api-design.md',
        'README.md',
        'other-file.txt',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const system = new ADRNumberingSystem({});
      const maxNumber = await system.scanExistingADRs('/docs/adr');

      expect(maxNumber).toBe(10);
      expect(system.getNextNumber()).toBe('011');
    });

    it('should return 0 for empty directory', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const system = new ADRNumberingSystem({ startingNumber: 1 });
      const maxNumber = await system.scanExistingADRs('/docs/adr');

      expect(maxNumber).toBe(0);
      expect(system.getNextNumber()).toBe('001');
    });

    it('should handle non-existent directory', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const system = new ADRNumberingSystem({ startingNumber: 5 });
      const maxNumber = await system.scanExistingADRs('/docs/adr');

      expect(maxNumber).toBe(0);
      expect(system.getNextNumber()).toBe('005');
    });
  });
});

describe('ADRGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createADRGenerator', () => {
    it('should create an ADRGenerator instance', () => {
      const generator = createADRGenerator();
      expect(generator).toBeInstanceOf(ADRGenerator);
    });

    it('should use default output directory', () => {
      const generator = createADRGenerator();
      expect(generator.getOutputDir()).toBe('docs/adr');
    });

    it('should accept custom configuration', () => {
      const generator = createADRGenerator({
        outputDir: 'custom/path',
        startingNumber: 10,
      });
      expect(generator.getOutputDir()).toBe('custom/path');
    });
  });

  describe('renderADR', () => {
    it('should render an ADR with correct number and path', () => {
      const generator = createADRGenerator({ outputDir: 'docs/adr' });
      const draft: ADRDraft = {
        title: 'Test Decision',
        category: 'architecture',
        context: 'Test context',
        decision: 'Test decision',
        consequences: { positive: [], negative: [] },
        alternativesConsidered: [],
      };

      const rendered = generator.renderADR(draft);

      expect(rendered.number).toBe('001');
      expect(rendered.fullTitle).toBe('ADR-001: Test Decision');
      expect(rendered.filename).toBe('ADR-001-test-decision.md');
      expect(rendered.fullPath).toBe(path.join('docs/adr', 'ADR-001-test-decision.md'));
      expect(rendered.content).toContain('# ADR-001: Test Decision');
    });

    it('should increment numbers for multiple renders', () => {
      const generator = createADRGenerator();
      const draft: ADRDraft = {
        title: 'Test',
        category: 'architecture',
        context: '',
        decision: '',
        consequences: { positive: [], negative: [] },
        alternativesConsidered: [],
      };

      const first = generator.renderADR(draft);
      const second = generator.renderADR(draft);
      const third = generator.renderADR(draft);

      expect(first.number).toBe('001');
      expect(second.number).toBe('002');
      expect(third.number).toBe('003');
    });
  });

  describe('renderMultipleADRs', () => {
    it('should render multiple ADRs with sequential numbers', () => {
      const generator = createADRGenerator();
      const drafts: ADRDraft[] = [
        {
          title: 'First Decision',
          category: 'architecture',
          context: '',
          decision: '',
          consequences: { positive: [], negative: [] },
          alternativesConsidered: [],
        },
        {
          title: 'Second Decision',
          category: 'library',
          context: '',
          decision: '',
          consequences: { positive: [], negative: [] },
          alternativesConsidered: [],
        },
      ];

      const rendered = generator.renderMultipleADRs(drafts);

      expect(rendered).toHaveLength(2);
      expect(rendered[0].number).toBe('001');
      expect(rendered[1].number).toBe('002');
    });
  });

  describe('decisionsToADRDrafts', () => {
    it('should convert multiple decisions to drafts', () => {
      const generator = createADRGenerator();
      const decisions: IdentifiedDecision[] = [
        {
          title: 'Database Choice',
          category: 'data-model',
          description: 'Choose database',
          clarityScore: 0.8,
        },
        {
          title: 'API Format',
          category: 'api-design',
          description: 'Choose API format',
          clarityScore: 0.7,
        },
      ];

      const drafts = generator.decisionsToADRDrafts(decisions);

      expect(drafts).toHaveLength(2);
      expect(drafts[0].title).toBe('Database Choice');
      expect(drafts[1].title).toBe('API Format');
    });
  });

  describe('generateFromDecisions', () => {
    it('should run full pipeline from decisions to rendered ADRs', () => {
      const generator = createADRGenerator();
      const decisions: IdentifiedDecision[] = [
        {
          title: 'Use Redis',
          category: 'architecture',
          description: 'Choose caching solution',
          clarityScore: 0.9,
          options: ['Redis', 'Memcached'],
        },
      ];

      const rendered = generator.generateFromDecisions(decisions);

      expect(rendered).toHaveLength(1);
      expect(rendered[0].fullTitle).toBe('ADR-001: Use Redis');
      expect(rendered[0].content).toContain('Choose caching solution');
    });
  });

  describe('writeADRs', () => {
    it('should create output directory and write files', async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const generator = createADRGenerator({ outputDir: 'docs/adr' });
      const adrs: RenderedADR[] = [
        {
          number: '001',
          fullTitle: 'ADR-001: Test',
          content: '# Test content',
          filename: 'ADR-001-test.md',
          fullPath: 'docs/adr/ADR-001-test.md',
        },
      ];

      const result = await generator.writeADRs(adrs);

      expect(result.success).toBe(true);
      expect(result.writtenFiles).toContain('docs/adr/ADR-001-test.md');
      expect(result.errors).toHaveLength(0);
      expect(mockMkdir).toHaveBeenCalledWith('docs/adr', { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        'docs/adr/ADR-001-test.md',
        '# Test content',
        'utf-8'
      );
    });

    it('should handle directory creation failure', async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      mockMkdir.mockRejectedValue(new Error('Permission denied'));

      const generator = createADRGenerator();
      const result = await generator.writeADRs([]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Permission denied');
    });

    it('should handle file write failures', async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockRejectedValue(new Error('Disk full'));

      const generator = createADRGenerator();
      const adrs: RenderedADR[] = [
        {
          number: '001',
          fullTitle: 'ADR-001: Test',
          content: '# Test',
          filename: 'ADR-001-test.md',
          fullPath: 'docs/adr/ADR-001-test.md',
        },
      ];

      const result = await generator.writeADRs(adrs);

      expect(result.success).toBe(false);
      expect(result.errors[0].path).toBe('docs/adr/ADR-001-test.md');
      expect(result.errors[0].error).toContain('Disk full');
    });

    it('should write multiple files and track results', async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const generator = createADRGenerator();
      const adrs: RenderedADR[] = [
        {
          number: '001',
          fullTitle: 'ADR-001: First',
          content: '# First',
          filename: 'ADR-001-first.md',
          fullPath: 'docs/adr/ADR-001-first.md',
        },
        {
          number: '002',
          fullTitle: 'ADR-002: Second',
          content: '# Second',
          filename: 'ADR-002-second.md',
          fullPath: 'docs/adr/ADR-002-second.md',
        },
      ];

      const result = await generator.writeADRs(adrs);

      expect(result.success).toBe(true);
      expect(result.writtenFiles).toHaveLength(2);
      expect(mockWriteFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('initialize', () => {
    it('should scan for existing ADRs on initialization', async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      mockReaddir.mockResolvedValue([
        'ADR-001-first.md',
        'ADR-002-second.md',
        'ADR-005-fifth.md',
      ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

      const generator = createADRGenerator({ outputDir: 'docs/adr' });
      await generator.initialize();

      // After scanning, next number should be 006
      const draft: ADRDraft = {
        title: 'New Decision',
        category: 'architecture',
        context: '',
        decision: '',
        consequences: { positive: [], negative: [] },
        alternativesConsidered: [],
      };

      const rendered = generator.renderADR(draft);
      expect(rendered.number).toBe('006');
    });
  });
});
