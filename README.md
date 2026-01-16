# pocket-stakeholder

A virtual feature team in your pocket. Simulates experienced stakeholder roles (Tech Lead, QA, UX Designer) to help solo developers transform ideas into production-ready applications.

## Overview

`pocket-stakeholder` is a CLI tool and Node.js library that uses AI to analyze your feature specifications and generate Architecture Decision Records (ADRs). The Tech Lead agent reads your specs, identifies technical decisions that need to be made, conducts interactive interviews when clarification is needed, and documents the decisions in a standardized format.

## Installation

```bash
npm install pocket-stakeholder
```

Or clone and build from source:

```bash
git clone https://github.com/your-org/pocket-stakeholder.git
cd pocket-stakeholder
npm install
npm run build
```

## Prerequisites

- Node.js >= 18.0.0
- An Anthropic API key (Claude)

Set your API key as an environment variable:

```bash
export ANTHROPIC_API_KEY=your-api-key-here
```

## Quick Start

### CLI Usage

Analyze a feature specification and generate ADRs:

```bash
# Interactive mode (prompts for clarification when needed)
pocket-stakeholder tech-lead ./specs/my-feature.md

# Autonomous mode (no prompts, works best with clear specs)
pocket-stakeholder tech-lead ./specs/my-feature.md --autonomous

# Specify output directory for ADRs
pocket-stakeholder tech-lead ./specs/my-feature.md --output ./docs/decisions
```

### Programmatic Usage

```typescript
import {
  TechLeadAgent,
  parseSpec,
  ADRGenerator,
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

## Features

### Tech Lead Agent

The Tech Lead agent is the first stakeholder in the pocket-stakeholder virtual team. It:

- **Parses specifications**: Reads markdown spec files and extracts structured information
- **Identifies decisions**: Detects technical decisions that need to be documented
- **Categorizes decisions**: Tags each decision as architecture, library, pattern, integration, data-model, api-design, security, or performance
- **Detects ambiguities**: Flags areas that need clarification
- **Conducts interviews**: Asks targeted questions to clarify requirements
- **Generates ADRs**: Produces standardized Architecture Decision Records

### Decision Categories

| Category | Description |
|----------|-------------|
| `architecture` | High-level system design choices |
| `library` | Third-party dependency selections |
| `pattern` | Design patterns and coding conventions |
| `integration` | External service and API integrations |
| `data-model` | Database schema and data structure choices |
| `api-design` | API endpoint and interface design |
| `security` | Authentication, authorization, encryption |
| `performance` | Caching, optimization, scaling decisions |

### ADR Format

Generated ADRs follow a standard format:

```markdown
# ADR-001: [Decision Title]

## Status
Proposed

## Context
[What is the issue we're deciding on? What forces are at play?]

## Decision
[What is the change we're making?]

## Consequences
[What are the results of this decision? Both positive and negative.]

## Alternatives Considered
[What other options were evaluated?]
```

## CLI Reference

### `pocket-stakeholder tech-lead <spec-path>`

Analyze a specification and generate Architecture Decision Records.

**Arguments:**
- `<spec-path>` - Path to the specification markdown file (required)

**Options:**
- `-a, --autonomous` - Run in autonomous mode (skip interactive interviews)
- `-o, --output <path>` - Output directory for ADRs (default: `docs/adr`)

**Examples:**

```bash
# Analyze a feature spec interactively
pocket-stakeholder tech-lead specs/user-auth.md

# Run without prompts (for clear specs)
pocket-stakeholder tech-lead specs/simple-feature.md --autonomous

# Output ADRs to a specific directory
pocket-stakeholder tech-lead specs/api-redesign.md --output docs/decisions

# Combine options
pocket-stakeholder tech-lead specs/complex.md -a -o ./adr
```

## Writing Specifications

For best results, structure your specification files with clear sections:

```markdown
# Feature: My Feature Name

## Overview
Brief description of the feature.

## Functional Requirements
| Requirement | Description |
|-------------|-------------|
| **FR-1** | First requirement |
| **FR-2** | Second requirement |

## Non-Functional Requirements
| Requirement | Description |
|-------------|-------------|
| **NFR-1** | Performance requirement |

## Technical Architecture
Any known technical constraints or preferences.

## Dependencies
External services or systems this feature interacts with.
```

## Project Integration

### Directory Structure

`pocket-stakeholder` expects the following directory structure:

```
your-project/
├── specs/
│   ├── SPEC.md              # Main product spec
│   ├── feature.md           # Feature specifications
│   └── feature.decisions.md # Per-feature decisions (optional)
├── docs/
│   └── adr/
│       ├── ADR-001-*.md     # Generated ADRs
│       └── ADR-002-*.md
└── CLAUDE.md                # Project context (optional)
```

### CLAUDE.md Support

If your project contains a `CLAUDE.md` file, the Tech Lead agent will read it to understand project conventions and existing decisions.

## API Documentation

For detailed programmatic API documentation, see [docs/API.md](./docs/API.md).

Key exports:

- **TechLeadAgent** - Main agent class for spec analysis
- **parseSpec** - Parse specification files into structured contexts
- **ADRGenerator** - Generate and write ADR files
- **InterviewSession** - Manage interactive or programmatic interviews
- **InterviewQuestionGenerator** - Generate interview questions from analysis

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Type check
npm run typecheck

# Watch mode for development
npm run dev
```

## License

MIT
