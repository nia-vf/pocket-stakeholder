# Feature: Tech Lead Agent

## Overview

The Tech Lead Agent is the first stakeholder in the pocket-stakeholder virtual feature team. It reads product specifications, conducts interviews (with users or other agents) to clarify technical requirements, and produces Architecture Decision Records (ADRs) that document key technical choices.

**Parent Spec:** [SPEC.md](./SPEC.md) - Phase 1: MVP - Single Stakeholder Proof of Concept

## User Stories

### Primary User Story
As a solo developer, I want a simulated Tech Lead to review my feature spec and create architecture documentation, so that I have well-documented technical decisions before implementation.

### Supporting Stories
- As a user, I can point the Tech Lead at a spec file and receive ADRs without extensive manual input
- As a user, I can answer clarifying questions when the Tech Lead encounters ambiguities
- As an orchestrator (ralph-borg), I can invoke the Tech Lead agent programmatically with a spec path
- As a future agent (QA/UX), I can collaborate with Tech Lead through the interview mechanism

## Functional Requirements

### Input
| Requirement | Description |
|-------------|-------------|
| **FR-1** | Accept a path to a specification document (markdown) |
| **FR-2** | Parse and understand the spec content to identify technical decisions needed |
| **FR-3** | Access project context (CLAUDE.md, existing ADRs) for consistency |

### Processing
| Requirement | Description |
|-------------|-------------|
| **FR-4** | Perform autonomous first-pass analysis of the spec |
| **FR-5** | Identify ambiguities or decision points requiring clarification |
| **FR-6** | Conduct interactive interview when clarification needed (with user or other agents) |
| **FR-7** | Interview follows 5-8 core questions + 1-8 follow-ups pattern from SPEC.md |

### Output
| Requirement | Description |
|-------------|-------------|
| **FR-8** | Generate ADRs in standard format (see ADR Format below) |
| **FR-9** | Save ADRs to `specs/<feature>.decisions.md` or `docs/adr/` |
| **FR-10** | Support multiple ADRs per spec when multiple decisions are identified |

### Invocation
| Requirement | Description |
|-------------|-------------|
| **FR-11** | CLI command: `pocket-stakeholder tech-lead <spec-path>` |
| **FR-12** | Programmatic invocation via module export for orchestrator integration |

## ADR Format

Each Architecture Decision Record follows this structure:

```markdown
# ADR-NNN: [Decision Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
[What is the issue we're deciding on? What forces are at play?]

## Decision
[What is the change we're making?]

## Consequences
[What are the results of this decision? Both positive and negative.]

## Alternatives Considered
[What other options were evaluated?]
```

## Non-Functional Requirements

| Requirement | Description |
|-------------|-------------|
| **NFR-1** | First-pass analysis completes without user input when spec is clear |
| **NFR-2** | Interview questions appear within 2 seconds (per SPEC.md) |
| **NFR-3** | ADRs are human-readable and follow consistent formatting |
| **NFR-4** | Agent is stateless between invocations (context loaded fresh each time) |

## Out of Scope (v1)

- **Code generation** - Tech Lead produces documentation only, not implementation code
- Other stakeholder agents (QA, UX) - separate features
- Task generation - ADRs inform tasks but Tech Lead doesn't generate them in v1
- External integrations beyond file I/O

## Dependencies

| Dependency | Description |
|------------|-------------|
| LLM API | Claude API for natural language understanding and generation |
| File system | Read specs, write ADRs |
| Project structure | Expects `specs/` directory per ralph-borg conventions |

## Technical Decisions to Make

The Tech Lead agent will make its own first technical decision: **choosing the implementation stack**. This is intentionally deferred to demonstrate the agent's capability in a self-referential way.

Candidates from SPEC.md:
- Node.js/TypeScript
- Python
- Go

## Success Criteria

1. **Working end-to-end flow**: Given a spec file, the agent reads it, optionally interviews for clarification, and outputs ADR file(s)
2. **Quality ADR output**: Produced ADRs follow the standard format, capture meaningful decisions with rationale, and are useful for future reference
3. **Hybrid interaction**: Can run autonomously on clear specs, prompts for input on ambiguous ones

## Open Questions

- Where should ADRs be stored? (`specs/<feature>.decisions.md` vs `docs/adr/ADR-NNN.md`)
- Should ADR numbering be global or per-feature?
- How does the agent determine which decisions warrant an ADR vs. which are too minor?
