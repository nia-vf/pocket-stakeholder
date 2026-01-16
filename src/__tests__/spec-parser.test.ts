import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import {
  parseSpec,
  parseSpecContent,
  readSpecFile,
  loadProjectContext,
  createEmptyParsedSpec,
  validateParsedSpec,
  summarizeSpec,
  buildFeatureContext,
  SpecParseError,
} from '../utils/spec-parser.js';

describe('Spec Parser', () => {
  const testDir = join(process.cwd(), '.test-spec-parser');

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('readSpecFile', () => {
    it('should read a spec file successfully', async () => {
      const specPath = join(testDir, 'test-spec.md');
      writeFileSync(specPath, '# Test Spec\n\nContent here');

      const content = await readSpecFile(specPath);
      expect(content).toContain('# Test Spec');
      expect(content).toContain('Content here');
    });

    it('should throw SpecParseError for non-existent file', async () => {
      const specPath = join(testDir, 'non-existent.md');

      await expect(readSpecFile(specPath)).rejects.toThrow(SpecParseError);
      await expect(readSpecFile(specPath)).rejects.toThrow(/not found/);
    });

    it('should throw SpecParseError for empty file', async () => {
      const specPath = join(testDir, 'empty.md');
      writeFileSync(specPath, '');

      await expect(readSpecFile(specPath)).rejects.toThrow(SpecParseError);
      await expect(readSpecFile(specPath)).rejects.toThrow(/empty/);
    });
  });

  describe('parseSpecContent', () => {
    it('should extract title from H1', () => {
      const content = '# My Feature Spec\n\nSome content here';
      const result = parseSpecContent(content);

      expect(result.title).toBe('My Feature Spec');
    });

    it('should extract overview section', () => {
      const content = `# Feature
## Overview
This is the overview of the feature.
## Other Section
Other content`;

      const result = parseSpecContent(content);
      expect(result.overview).toBe('This is the overview of the feature.');
    });

    it('should extract features from list items', () => {
      const content = `# Feature Spec
## Features
- **User Login** - Allow users to authenticate
- **User Registration** - Allow new users to sign up (P0)`;

      const result = parseSpecContent(content);
      expect(result.features).toHaveLength(2);
      expect(result.features![0].name).toBe('User Login');
      expect(result.features![0].description).toContain('Allow users to authenticate');
      expect(result.features![1].priority).toBe('P0');
    });

    it('should extract functional requirements from table format', () => {
      const content = `# Feature
## Functional Requirements
| Requirement | Description |
|-------------|-------------|
| **FR-1** | Accept user input |
| **FR-2** | Validate data |`;

      const result = parseSpecContent(content);
      expect(result.requirements).toHaveLength(2);
      expect(result.requirements![0].id).toBe('FR-1');
      expect(result.requirements![0].description).toBe('Accept user input');
      expect(result.requirements![0].type).toBe('functional');
    });

    it('should extract non-functional requirements', () => {
      const content = `# Feature
## Non-Functional Requirements
| Requirement | Description |
|-------------|-------------|
| **NFR-1** | Response time under 2 seconds |`;

      const result = parseSpecContent(content);
      expect(result.requirements).toHaveLength(1);
      expect(result.requirements![0].id).toBe('NFR-1');
      expect(result.requirements![0].type).toBe('non-functional');
    });

    it('should extract technical architecture section', () => {
      const content = `# Feature
## Technical Architecture
We will use a microservices architecture with REST APIs.

## Other Section
Other content`;

      const result = parseSpecContent(content);
      expect(result.technicalArchitecture).toContain('microservices architecture');
    });

    it('should collect other sections', () => {
      const content = `# Feature
## Overview
The overview.
## Dependencies
- Dependency 1
- Dependency 2

## Open Questions
- Question 1
- Question 2`;

      const result = parseSpecContent(content);
      expect(result.otherSections['Dependencies']).toBeDefined();
      expect(result.otherSections['Open Questions']).toBeDefined();
    });

    it('should handle specs with no optional sections', () => {
      const content = '# Minimal Spec';
      const result = parseSpecContent(content);

      expect(result.title).toBe('Minimal Spec');
      expect(result.overview).toBeUndefined();
      expect(result.features).toBeUndefined();
      expect(result.requirements).toBeUndefined();
    });
  });

  describe('loadProjectContext', () => {
    it('should load CLAUDE.md if present', async () => {
      writeFileSync(join(testDir, 'CLAUDE.md'), '# Project Instructions\n\nBuild with care.');

      const context = await loadProjectContext(testDir);
      expect(context.claudeMd).toContain('Project Instructions');
      expect(context.projectRoot).toBe(testDir);
    });

    it('should return empty context if CLAUDE.md is missing', async () => {
      const context = await loadProjectContext(testDir);
      expect(context.claudeMd).toBeUndefined();
      expect(context.existingDecisions).toEqual([]);
    });

    it('should load existing ADR decisions', async () => {
      // Create docs/adr directory with an ADR
      const adrDir = join(testDir, 'docs', 'adr');
      mkdirSync(adrDir, { recursive: true });
      writeFileSync(
        join(adrDir, 'ADR-001-tech-stack.md'),
        `# ADR-001: Use TypeScript

## Status
Accepted

## Context
We need to choose a programming language.

## Decision
We will use TypeScript.

## Consequences
Better type safety.`
      );

      const context = await loadProjectContext(testDir);
      expect(context.existingDecisions).toHaveLength(1);
      expect(context.existingDecisions[0].id).toBe('ADR-001');
      expect(context.existingDecisions[0].title).toBe('Use TypeScript');
      expect(context.existingDecisions[0].status).toBe('Accepted');
    });
  });

  describe('parseSpec', () => {
    it('should parse a complete spec file', async () => {
      const specContent = `# User Authentication Feature

## Overview
Implement user authentication for the application.

## Features
- **Login** - User can log in with email/password (P0)
- **Logout** - User can log out

## Functional Requirements
| Requirement | Description |
|-------------|-------------|
| **FR-1** | Validate email format |
| **FR-2** | Hash passwords |

## Technical Architecture
Use JWT tokens for session management.
`;

      const specPath = join(testDir, 'auth-feature.md');
      writeFileSync(specPath, specContent);

      const context = await parseSpec(specPath);

      expect(context.specPath).toBe(specPath);
      expect(context.specContent).toBe(specContent);
      expect(context.parsedSpec.title).toBe('User Authentication Feature');
      expect(context.parsedSpec.overview).toContain('Implement user authentication');
      expect(context.parsedSpec.features).toHaveLength(2);
      expect(context.parsedSpec.requirements).toHaveLength(2);
      expect(context.parsedSpec.technicalArchitecture).toContain('JWT tokens');
      expect(context.projectContext.projectRoot).toBe(testDir);
    });

    it('should skip project context when loadProjectContext is false', async () => {
      const specPath = join(testDir, 'simple.md');
      writeFileSync(specPath, '# Simple Spec');
      writeFileSync(join(testDir, 'CLAUDE.md'), '# Instructions');

      const context = await parseSpec(specPath, { loadProjectContext: false });

      expect(context.projectContext.claudeMd).toBeUndefined();
    });

    it('should use custom project root when specified', async () => {
      const specPath = join(testDir, 'spec.md');
      writeFileSync(specPath, '# Spec');

      const customRoot = join(testDir, 'custom');
      mkdirSync(customRoot, { recursive: true });
      writeFileSync(join(customRoot, 'CLAUDE.md'), '# Custom Instructions');

      const context = await parseSpec(specPath, { projectRoot: customRoot });

      expect(context.projectContext.projectRoot).toBe(customRoot);
      expect(context.projectContext.claudeMd).toContain('Custom Instructions');
    });
  });

  describe('createEmptyParsedSpec', () => {
    it('should create an empty spec with default title', () => {
      const spec = createEmptyParsedSpec();
      expect(spec.title).toBe('Untitled');
      expect(spec.otherSections).toEqual({});
    });

    it('should create an empty spec with custom title', () => {
      const spec = createEmptyParsedSpec('Custom Title');
      expect(spec.title).toBe('Custom Title');
    });
  });

  describe('SpecParseError', () => {
    it('should have correct name and message', () => {
      const error = new SpecParseError('Test error');
      expect(error.name).toBe('SpecParseError');
      expect(error.message).toBe('Test error');
    });

    it('should store the cause', () => {
      const cause = new Error('Original error');
      const error = new SpecParseError('Wrapped error', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('validateParsedSpec', () => {
    it('should validate a complete spec as valid', () => {
      const spec = {
        title: 'My Feature',
        overview: 'This is a detailed overview of the feature.',
        features: [{ name: 'Feature 1', description: 'Description 1' }],
        requirements: [{ id: 'FR-1', description: 'Requirement 1', type: 'functional' as const }],
        technicalArchitecture: 'Use microservices architecture.',
        otherSections: {},
      };

      const result = validateParsedSpec(spec);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.completenessScore).toBe(1);
      expect(result.presentSections).toContain('title');
      expect(result.presentSections).toContain('overview');
      expect(result.presentSections).toContain('features');
      expect(result.presentSections).toContain('requirements');
      expect(result.presentSections).toContain('technicalArchitecture');
    });

    it('should return error for spec without title', () => {
      const spec = {
        title: 'Untitled',
        otherSections: {},
      };

      const result = validateParsedSpec(spec);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('missing a title');
    });

    it('should return warnings for missing optional sections', () => {
      const spec = {
        title: 'My Feature',
        otherSections: {},
      };

      const result = validateParsedSpec(spec);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.missingSections).toContain('overview');
      expect(result.missingSections).toContain('features');
      expect(result.missingSections).toContain('requirements');
    });

    it('should warn about brief overview', () => {
      const spec = {
        title: 'My Feature',
        overview: 'Short.',
        otherSections: {},
      };

      const result = validateParsedSpec(spec);

      expect(result.warnings.some((w) => w.includes('brief'))).toBe(true);
    });

    it('should calculate partial completeness score', () => {
      const spec = {
        title: 'My Feature',
        overview: 'This is a detailed overview.',
        otherSections: {},
      };

      const result = validateParsedSpec(spec);

      // Title (0.2) + Overview (0.2) = 0.4
      expect(result.completenessScore).toBe(0.4);
    });
  });

  describe('summarizeSpec', () => {
    it('should create a summary with all sections', () => {
      const spec = {
        title: 'User Authentication',
        overview: 'Implement user authentication for the application.',
        features: [
          { name: 'Login', description: 'User can log in', priority: 'P0' as const },
          { name: 'Logout', description: 'User can log out' },
        ],
        requirements: [
          { id: 'FR-1', description: 'Validate email', type: 'functional' as const },
          { id: 'NFR-1', description: 'Response under 2s', type: 'non-functional' as const },
        ],
        technicalArchitecture: 'Use JWT tokens for session management.',
        otherSections: {
          Dependencies: '- Node.js\n- Express',
        },
      };

      const summary = summarizeSpec(spec);

      expect(summary).toContain('# User Authentication');
      expect(summary).toContain('## Overview');
      expect(summary).toContain('Implement user authentication');
      expect(summary).toContain('## Features');
      expect(summary).toContain('Login (P0)');
      expect(summary).toContain('Logout');
      expect(summary).toContain('## Functional Requirements');
      expect(summary).toContain('FR-1: Validate email');
      expect(summary).toContain('## Non-Functional Requirements');
      expect(summary).toContain('NFR-1: Response under 2s');
      expect(summary).toContain('## Technical Architecture');
      expect(summary).toContain('JWT tokens');
      expect(summary).toContain('## Dependencies');
    });

    it('should handle spec with minimal content', () => {
      const spec = {
        title: 'Minimal Spec',
        otherSections: {},
      };

      const summary = summarizeSpec(spec);

      expect(summary).toContain('# Minimal Spec');
      expect(summary).not.toContain('## Overview');
    });

    it('should truncate long technical architecture', () => {
      const longArch = 'A'.repeat(600);
      const spec = {
        title: 'Spec',
        technicalArchitecture: longArch,
        otherSections: {},
      };

      const summary = summarizeSpec(spec);

      expect(summary).toContain('...');
      expect(summary.length).toBeLessThan(longArch.length + 100);
    });
  });

  describe('buildFeatureContext', () => {
    it('should build context with validation results', async () => {
      const specPath = join(testDir, 'validated-spec.md');
      writeFileSync(
        specPath,
        `# Validated Feature

## Overview
This is the feature overview with enough content.

## Features
- **Login** - User authentication

## Functional Requirements
| Requirement | Description |
|-------------|-------------|
| **FR-1** | Validate input |
`
      );

      const context = await buildFeatureContext(specPath);

      expect(context.validation).toBeDefined();
      expect(context.validation.isValid).toBe(true);
      expect(context.validation.presentSections).toContain('title');
      expect(context.validation.presentSections).toContain('overview');
      expect(context.validation.completenessScore).toBeGreaterThan(0.5);
    });

    it('should throw in strict mode if spec has errors', async () => {
      const specPath = join(testDir, 'invalid-spec.md');
      writeFileSync(specPath, 'No title header here');

      await expect(buildFeatureContext(specPath, { strict: true })).rejects.toThrow(SpecParseError);
    });

    it('should not throw in non-strict mode for spec with errors', async () => {
      const specPath = join(testDir, 'invalid-spec-nonstrict.md');
      writeFileSync(specPath, 'No title header here');

      const context = await buildFeatureContext(specPath);

      expect(context.validation.isValid).toBe(false);
      expect(context.validation.errors.length).toBeGreaterThan(0);
    });
  });
});
