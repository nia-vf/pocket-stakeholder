# pocket-stakeholder API Documentation

This document describes the programmatic API for integrating `pocket-stakeholder` into orchestration tools like ralph-borg.

## Quick Start

```typescript
import {
  TechLeadAgent,
  parseSpec,
  ADRGenerator,
  InterviewSession,
  InterviewQuestionGenerator,
  MapAnswerProvider,
} from 'pocket-stakeholder';

// 1. Parse a specification file
const context = await parseSpec('./specs/my-feature.md');

// 2. Create and run the Tech Lead agent
const agent = new TechLeadAgent({ apiKey: process.env.ANTHROPIC_API_KEY });
const interviewResult = await agent.conductInterview(context);

// 3. Generate ADRs from identified decisions
const adrGenerator = new ADRGenerator({ outputDir: './docs/adr' });
await adrGenerator.initialize();
const adrs = adrGenerator.generateFromDecisions(
  interviewResult.identifiedDecisions,
  interviewResult
);
await adrGenerator.writeADRs(adrs);
```

## Core Components

### TechLeadAgent

The main agent class that analyzes specifications and identifies technical decisions.

```typescript
import { TechLeadAgent, createTechLeadAgent } from 'pocket-stakeholder';

// Using constructor
const agent = new TechLeadAgent({
  apiKey: 'your-api-key',  // Optional, defaults to ANTHROPIC_API_KEY env var
  model: 'claude-sonnet-4-20250514',  // Optional, defaults to claude-sonnet-4
});

// Using factory function
const agent = createTechLeadAgent({ apiKey: 'your-api-key' });
```

#### Methods

##### `conductInterview(context: FeatureContext): Promise<InterviewResult>`

Analyzes a specification and identifies technical decisions.

```typescript
const result = await agent.conductInterview(context);

// Result structure:
{
  stakeholderRole: 'tech-lead',
  exchanges: [],  // Q&A exchanges if interview was conducted
  insights: [],   // Key insights identified
  identifiedDecisions: [
    {
      title: 'Authentication Strategy',
      category: 'architecture',
      description: 'Choose between session-based and token-based auth',
      clarityScore: 0.4,  // 0-1, higher = clearer
      options: ['JWT', 'Sessions', 'OAuth2'],
    }
  ],
  ambiguities: [
    {
      description: 'No mention of rate limiting requirements',
      suggestedQuestions: ['What rate limits should apply?'],
    }
  ],
  completedAt: Date,
}
```

##### `getLastAnalysisResult(): AnalysisResult | undefined`

Returns the detailed analysis result from the last `conductInterview` call.

```typescript
const analysisResult = agent.getLastAnalysisResult();
// Use for generating interview questions based on analysis
```

### Spec Parsing

#### `parseSpec(specPath: string, options?: SpecParserOptions): Promise<FeatureContext>`

Reads and parses a specification file into a FeatureContext.

```typescript
import { parseSpec } from 'pocket-stakeholder';

const context = await parseSpec('./specs/feature.md', {
  projectRoot: './project',  // Optional, defaults to spec file's directory
  loadProjectContext: true,  // Load CLAUDE.md and existing ADRs
});
```

#### `parseSpecContent(content: string): ParsedSpec`

Parse spec content directly without reading from file.

```typescript
import { parseSpecContent } from 'pocket-stakeholder';

const parsedSpec = parseSpecContent(`
# My Feature

## Overview
This feature does something important.

## Functional Requirements
| **FR-1** | Must do X |
| **FR-2** | Must do Y |
`);
```

#### `loadProjectContext(projectRoot: string): Promise<ProjectContext>`

Load project context including CLAUDE.md and existing decisions.

```typescript
import { loadProjectContext } from 'pocket-stakeholder';

const projectContext = await loadProjectContext('./my-project');
// Returns: { projectRoot, claudeMd?, existingDecisions }
```

### Interview System

For interactive or programmatic interviews.

#### `InterviewQuestionGenerator`

Generates interview questions based on analysis results.

```typescript
import { InterviewQuestionGenerator } from 'pocket-stakeholder';

const generator = new InterviewQuestionGenerator({
  // Optional configuration
});

const analysisResult = agent.getLastAnalysisResult();
const questionSet = generator.generateTechLeadQuestions(analysisResult);
```

#### `InterviewSession`

Manages an interview session with various answer providers.

```typescript
import {
  InterviewSession,
  MapAnswerProvider,
  CallbackAnswerProvider,
} from 'pocket-stakeholder';

// Option 1: Pre-defined answers (for automated pipelines)
const answerProvider = new MapAnswerProvider(new Map([
  ['auth-strategy', 'We prefer JWT for our microservices architecture'],
  ['rate-limiting', 'Standard tier: 100 req/min, Premium: 1000 req/min'],
]));

// Option 2: Callback-based answers (for integration with other systems)
const answerProvider = new CallbackAnswerProvider(async (question) => {
  // Fetch answer from another LLM, user input system, etc.
  return await getAnswerFromSomewhere(question);
});

const session = new InterviewSession({
  questionSet,
  answerProvider,
});

const exchanges = await session.start();
```

### ADR Generation

#### `ADRGenerator`

Generates and writes Architecture Decision Records.

```typescript
import { ADRGenerator, createADRGenerator } from 'pocket-stakeholder';

const generator = new ADRGenerator({
  outputDir: './docs/adr',     // Where to write ADRs
  startingNumber: 1,            // First ADR number
  globalNumbering: true,        // Use global numbering vs per-feature
  featureName: 'auth',          // For per-feature numbering
});

// Initialize (scans existing ADRs for numbering)
await generator.initialize();

// Generate ADRs from decisions
const adrs = generator.generateFromDecisions(
  interviewResult.identifiedDecisions,
  interviewResult  // Optional: adds interview context to ADRs
);

// Write to filesystem
const result = await generator.writeADRs(adrs);
// result: { success: boolean, writtenFiles: string[], errors: [] }
```

## Type Definitions

### FeatureContext

```typescript
interface FeatureContext {
  specPath: string;           // Path to the spec file
  specContent: string;        // Raw spec content
  parsedSpec: ParsedSpec;     // Structured spec data
  projectContext: ProjectContext;
  previousInterviews?: InterviewResult[];
}
```

### ParsedSpec

```typescript
interface ParsedSpec {
  title: string;
  overview?: string;
  features?: SpecFeature[];
  requirements?: SpecRequirement[];
  technicalArchitecture?: string;
  otherSections: Record<string, string>;
}
```

### IdentifiedDecision

```typescript
interface IdentifiedDecision {
  title: string;
  category: DecisionCategory;  // 'architecture' | 'library' | 'pattern' | etc.
  description: string;
  clarityScore: number;        // 0-1
  options?: string[];
}

type DecisionCategory =
  | 'architecture'
  | 'library'
  | 'pattern'
  | 'integration'
  | 'data-model'
  | 'api-design'
  | 'security'
  | 'performance';
```

### InterviewResult

```typescript
interface InterviewResult {
  stakeholderRole: StakeholderRole;
  exchanges: InterviewExchange[];
  insights: string[];
  identifiedDecisions: IdentifiedDecision[];
  ambiguities: Ambiguity[];
  completedAt: Date;
}
```

## Complete Example: ralph-borg Integration

```typescript
import {
  TechLeadAgent,
  parseSpec,
  ADRGenerator,
  InterviewSession,
  InterviewQuestionGenerator,
  MapAnswerProvider,
  type FeatureContext,
  type InterviewResult,
} from 'pocket-stakeholder';

/**
 * Run Tech Lead agent on a specification
 *
 * @param specPath Path to the specification file
 * @param options Configuration options
 * @returns Generated ADR paths
 */
export async function runTechLead(
  specPath: string,
  options: {
    outputDir?: string;
    autonomous?: boolean;
    answers?: Map<string, string>;
  } = {}
): Promise<string[]> {
  // Step 1: Parse the specification
  const context = await parseSpec(specPath);

  // Step 2: Run analysis
  const agent = new TechLeadAgent();
  const interviewResult = await agent.conductInterview(context);

  // Step 3: Optionally conduct interview for ambiguous decisions
  let finalResult = interviewResult;

  if (!options.autonomous && interviewResult.ambiguities.length > 0) {
    const analysisResult = agent.getLastAnalysisResult();
    if (analysisResult) {
      const generator = new InterviewQuestionGenerator({});
      const questionSet = generator.generateTechLeadQuestions(analysisResult);

      if (questionSet.coreQuestions.length > 0) {
        // Use provided answers or skip if none available
        if (options.answers) {
          const answerProvider = new MapAnswerProvider(options.answers);
          const session = new InterviewSession({
            questionSet,
            answerProvider,
          });

          const exchanges = await session.start();
          finalResult = {
            ...interviewResult,
            exchanges,
          };
        }
      }
    }
  }

  // Step 4: Generate and write ADRs
  const adrGenerator = new ADRGenerator({
    outputDir: options.outputDir ?? 'docs/adr',
  });
  await adrGenerator.initialize();

  const adrs = adrGenerator.generateFromDecisions(
    finalResult.identifiedDecisions,
    finalResult
  );

  const writeResult = await adrGenerator.writeADRs(adrs);

  if (!writeResult.success) {
    throw new Error(`Failed to write ADRs: ${writeResult.errors.map(e => e.error).join(', ')}`);
  }

  return writeResult.writtenFiles;
}

// Usage
const adrPaths = await runTechLead('./specs/new-feature.md', {
  outputDir: './docs/adr',
  autonomous: false,
  answers: new Map([
    ['preferred-auth', 'JWT with refresh tokens'],
  ]),
});

console.log('Generated ADRs:', adrPaths);
```

## Error Handling

```typescript
import { SpecParseError, LLMError } from 'pocket-stakeholder';

try {
  const context = await parseSpec('./specs/feature.md');
  const agent = new TechLeadAgent();
  await agent.conductInterview(context);
} catch (error) {
  if (error instanceof SpecParseError) {
    console.error('Failed to parse spec:', error.message);
    // error.cause may contain the underlying error
  } else if (error instanceof LLMError) {
    console.error('LLM API error:', error.message);
    // Handle API errors (rate limits, auth, etc.)
  } else {
    throw error;
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key for LLM calls | Required if not passed to constructor |

## CLI Reference

In addition to the programmatic API, a CLI is available:

```bash
# Basic usage
pocket-stakeholder tech-lead ./specs/feature.md

# Autonomous mode (skip interviews)
pocket-stakeholder tech-lead ./specs/feature.md --autonomous

# Custom output directory
pocket-stakeholder tech-lead ./specs/feature.md --output ./docs/decisions
```
