# pocket-stakeholder Product Specification

## Overview

**Product Name:** pocket-stakeholder
**Version:** 0.1.0
**Status:** Draft

### Vision

A virtual feature team in your pocket. pocket-stakeholder simulates experienced stakeholder roles (Tech Lead, QA, UX Designer) to help solo developers transform ideas into production-ready applications. It provides the expertise of a full team without the resources typically required.

### Problem Statement

**Problem:** Solo developers and founders often lack access to the diverse expertise a feature team provides—technical architecture review, quality assurance thinking, and UX design input. This leads to:
- Decisions made in isolation without expert perspectives
- Blind spots in architecture, testing, and user experience
- Features that work technically but miss edge cases or UX issues
- No structured process to refine ideas before implementation

**Who has this problem:** Individuals building applications without the resources or team to support full feature development—solo developers, early-stage founders, indie hackers, and hobbyists building serious projects.

### Target Users

| User Type | Description | Primary Need |
|-----------|-------------|--------------|
| Solo developers | Building side projects or personal tools | Expert input without hiring |
| Early-stage founders | Pre-funding, building MVP alone | Team-level rigor on a solo budget |
| Indie hackers | Bootstrapping products independently | Quality validation before shipping |
| Learning developers | Building projects to grow skills | Mentorship-style guidance |

## Core Concepts

### The Virtual Feature Team

pocket-stakeholder simulates three key stakeholder roles (MVP):

| Role | Responsibility | Input Style |
|------|----------------|-------------|
| **Tech Lead/Architect** | Technical decisions, architecture review, code quality, scalability | Asks about trade-offs, constraints, future needs |
| **QA/Tester** | Edge cases, test coverage, failure modes, validation | Challenges assumptions, explores "what if" scenarios |
| **UX Designer** | User flows, interface decisions, accessibility, experience | Focuses on user goals, friction points, clarity |

**Future:** Product Owner role (requirements, prioritization, acceptance) can be added once the core pipeline is proven.

### The Stakeholder Pipeline

An interview-driven flow where simulated stakeholders engage with the user to refine decisions:

```
┌─────────────────────────────────────────────────────────────┐
│                    STAKEHOLDER PIPELINE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Input (feature/decision/question)                      │
│  ─ OR ─                                                      │
│  Orchestrator Input (ralph-borg features/sub-features)       │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │       COMPLEXITY DETECTION              │                │
│  │  • Simple? → Suggest Quick Mode         │                │
│  │  • Large?  → Trigger Decomposition      │                │
│  └─────────────────────────────────────────┘                │
│       │                                                      │
│       ▼ (if large)                                           │
│  ┌─────────────────────────────────────────┐                │
│  │       FEATURE DECOMPOSITION             │                │
│  │  Break into sub-features, run pipeline  │                │
│  │  for each, aggregate outputs            │                │
│  └─────────────────────────────────────────┘                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │       STAKEHOLDER SELECTION             │                │
│  │  Suggest relevant agents, allow skips   │                │
│  │  with blind spot warnings               │                │
│  └─────────────────────────────────────────┘                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │       SMART CONTEXT RETRIEVAL           │                │
│  │  Query relevant past decisions          │                │
│  └─────────────────────────────────────────┘                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │    SEQUENTIAL STAKEHOLDER INTERVIEWS    │                │
│  │    (5-8 core + 1-8 follow-up questions) │                │
│  │                                          │                │
│  │  1. Tech Lead ──► User answers           │                │
│  │         │                                │                │
│  │         ▼ (insights passed forward)      │                │
│  │  2. QA ─────────► User answers           │                │
│  │         │                                │                │
│  │         ▼ (insights passed forward)      │                │
│  │  3. UX ─────────► User answers           │                │
│  │                                          │                │
│  └─────────────────────────────────────────┘                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │       CONFLICT RESOLUTION (if needed)   │                │
│  │  • Surface to user, OR                  │                │
│  │  • Facilitated synthesis                │                │
│  └─────────────────────────────────────────┘                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────┐                │
│  │              OUTPUTS                     │                │
│  │  • Spec documents (what to build)       │                │
│  │  • Decision records (why this way)      │                │
│  │  • Implementation tasks (feature chunks)│                │
│  └─────────────────────────────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Pipeline Triggers

The stakeholder pipeline can be invoked:

| Trigger | Use Case |
|---------|----------|
| **New feature request** | "I want to add user authentication" |
| **Before implementation** | Validate approach before writing code |
| **Key decision points** | "Should I use REST or GraphQL?" |
| **Continuous consultation** | Stakeholders available anytime for input |

## Features

### Core Features (MVP)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Tech Lead Interview** | Simulated architect asks about technical decisions, trade-offs, constraints | P0 |
| **QA Interview** | Simulated tester explores edge cases, failure modes, validation needs | P0 |
| **UX Interview** | Simulated designer reviews user flows, experience, and interface decisions | P0 |
| **Spec Generation** | Produces feature specification from interview outcomes | P0 |
| **Decision Records** | Documents decisions with rationale for future reference | P0 |
| **Task Generation** | Creates actionable implementation tasks (feature chunks) from specs | P0 |
| **CLI Interface** | Terminal-based interaction that fits developer workflow | P0 |
| **Smart Context Retrieval** | Agents query relevant past decisions based on current topic | P0 |
| **Quick Mode** | Auto-detects simple features and offers abbreviated interviews | P0 |
| **Conflict Resolution** | Surfaces stakeholder conflicts or facilitates resolution (user choice) | P0 |
| **Stakeholder Skipping** | Skip agents with warnings and smart relevance suggestions | P0 |
| **Feature Decomposition** | Detects large scope, prompts breakdown into sub-features | P0 |
| **Orchestrator Integration** | Consumes features/sub-features from ralph-borg or similar tools | P1 |

### Future Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Product Owner Role** | Automate requirements gathering and prioritization | P1 |
| **Chat Interface** | Conversational UI alternative to CLI | P2 |
| **Integration Hooks** | Connect with external tools (GitHub, Linear, etc.) | P2 |
| **Custom Stakeholders** | User-defined roles with custom interview questions | P2 |
| **Learning Mode** | Explains reasoning to help users learn decision-making | P3 |

## Technical Architecture

### Design Principles

1. **Decoupled** - Works standalone or with orchestrators like ralph-borg
2. **Pluggable** - Stakeholder roles can be added, removed, or customized
3. **CLI-first** - Terminal interface close to the codebase
4. **Document-centric** - Outputs are markdown specs that integrate with spec workflows

### Technology Options

#### Runtime Options
- Option A: Node.js/TypeScript - Fast iteration, broad ecosystem, good for CLI tools
- Option B: Python - Strong AI/LLM libraries, easy prototyping
- Option C: Go - Fast CLI startup, single binary distribution

#### LLM Integration Options
- Option A: Direct API (Anthropic Claude) - Most control, direct prompting
- Option B: LangChain/LlamaIndex - Abstraction layer, easier chaining
- Option C: Agent frameworks (AutoGen, CrewAI) - Built-in multi-agent patterns

#### Storage Options
- Option A: File-based (markdown/JSON) - Simple, version-controlled, portable
- Option B: SQLite - Queryable, still local and portable
- Option C: Vector DB - Enables semantic search over past decisions

### System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     pocket-stakeholder                    │
├──────────────────────────────────────────────────────────┤
│  CLI Layer                                                │
│  ├── Command parser                                       │
│  ├── Interactive prompts                                  │
│  └── Output formatter                                     │
├──────────────────────────────────────────────────────────┤
│  Orchestrator                                             │
│  ├── Pipeline coordinator                                 │
│  ├── Interview sequencer (Tech Lead → QA → UX)           │
│  ├── Complexity detector (quick mode / decomposition)    │
│  ├── Feature decomposer                                   │
│  ├── Stakeholder selector (skip logic + suggestions)     │
│  ├── Conflict resolver                                    │
│  └── Output aggregator                                    │
├──────────────────────────────────────────────────────────┤
│  Context Layer                                            │
│  ├── Smart retrieval engine                               │
│  ├── Decision index                                       │
│  └── Project state tracker                                │
├──────────────────────────────────────────────────────────┤
│  Stakeholder Agents                                       │
│  ├── TechLeadAgent                                        │
│  ├── QAAgent                                              │
│  ├── UXAgent                                              │
│  └── (Future: ProductOwnerAgent)                          │
├──────────────────────────────────────────────────────────┤
│  Output Generators                                        │
│  ├── SpecGenerator                                        │
│  ├── DecisionRecordGenerator                              │
│  └── TaskGenerator (feature chunks)                       │
├──────────────────────────────────────────────────────────┤
│  Integration Layer (optional)                             │
│  ├── ralph-borg adapter                                   │
│  ├── Standalone mode                                      │
│  └── External plugin interface                            │
└──────────────────────────────────────────────────────────┘
```

### API Design

#### Internal Agent Interface

Each stakeholder agent implements:

```
interface StakeholderAgent {
  role: string
  conduct_interview(context: FeatureContext): InterviewResult
  generate_recommendations(answers: UserAnswers): Recommendations
}
```

#### Output Formats

| Output | Format | Location |
|--------|--------|----------|
| Feature Spec | Markdown | `specs/<feature>.md` |
| Decision Record | Markdown | `specs/<feature>.decisions.md` |
| Implementation Tasks | Markdown checklist | `specs/<feature>.implementation.md` |

## Non-Functional Requirements

### Performance
- Interview questions should appear within 2 seconds
- Full pipeline (all 3 stakeholders) should complete within reasonable interaction time
- CLI startup should be fast (<1 second)

### Security
- API keys stored securely (environment variables or secure config)
- No sensitive data transmitted beyond LLM API calls
- Local-first: all outputs stored in user's filesystem

### Extensibility
- New stakeholder roles addable without core changes
- Interview questions configurable per role
- Output generators pluggable

### Integration
- Works with existing spec workflow (specs/*.md)
- Compatible with ralph-borg commands
- Can operate standalone with own orchestration

## Roadmap

### Phase 1: MVP - Single Stakeholder Proof of Concept
- [x] Design agent interface and interview flow
- [x] Implement Tech Lead agent with interview capability
- [x] Build basic CLI for invoking pipeline
- [x] Generate ADR documents from interview output
- [x] Test end-to-end flow with real feature

### Phase 2: Full Virtual Team
- [x] Add QA agent with testing-focused interview
- [x] Add UX agent with design-focused interview
- [x] Implement pipeline orchestrator for multi-agent flow
- [ ] Add decision record generation
- [ ] Add implementation task generation

### Phase 3: Integration & Polish
- [ ] Build ralph-borg adapter
- [ ] Add standalone orchestrator mode
- [ ] Improve CLI UX (progress, formatting, help)
- [ ] Add configuration for customizing agents
- [ ] Documentation and examples

### Phase 4: Enhancement
- [ ] Product Owner agent (optional role)
- [ ] Chat interface option
- [ ] External tool integrations
- [ ] Custom stakeholder role builder

## Design Decisions

Resolved questions that shape the implementation:

### Interview Sequencing
**Decision:** Sequential interviews

Stakeholders interview one at a time in order: Tech Lead → QA → UX. This allows later stakeholders to build on earlier insights (e.g., QA can challenge Tech Lead's architectural decisions, UX can consider technical constraints).

### Project Context
**Decision:** Smart retrieval

Agents don't load full project history by default. Instead, they query for relevant past decisions based on the current topic. This keeps context focused and avoids noise while ensuring consistency with prior choices.

### Quick Mode
**Decision:** Auto-detect with suggestion

The system analyzes incoming feature requests and detects simple changes (e.g., "add a button", "fix typo in validation message"). For simple features, it suggests quick mode which runs abbreviated interviews. User can override and request full interviews if desired.

### Conflict Resolution
**Decision:** User-configurable approach

When stakeholders have conflicting recommendations, the user can choose their preferred resolution mode:
- **Surface to user** - Present conflicts explicitly, user makes final call
- **Facilitated resolution** - Run a synthesis step where agents discuss and propose a compromise

Default behavior is configurable per project or per session.

### Task Granularity
**Decision:** Feature chunks

Generated implementation tasks are logical groupings that represent a coherent unit of work (e.g., "Implement form validation", "Add authentication middleware"). Not so small as to be trivial, not so large as to be vague. Each task should be completable in a focused work session.

### Interview Length
**Decision:** Adaptive with depth (5-8 core + 1-8 follow-ups)

Each stakeholder asks 5-8 core questions covering their domain essentials. Based on feature complexity and user answers, 1-8 follow-up questions are asked to probe deeper. This ensures thorough coverage while scaling with complexity.

### Stakeholder Skipping
**Decision:** Yes, with warning and smart suggestions

Users can skip specific stakeholders when appropriate. The system:
- Warns about potential blind spots when skipping
- Suggests which stakeholders are most relevant based on feature type (e.g., "This looks like an API change—Tech Lead and QA recommended")
- Defaults to all stakeholders for full coverage

### Large Feature Handling
**Decision:** Decomposition-first with orchestrator integration

For large/complex features:
1. Complexity detector identifies oversized scope
2. System prompts user to decompose into sub-features
3. Each sub-feature runs through its own pipeline
4. Outputs aggregate into a parent spec

**Integration option:** If an orchestrator like ralph-borg is present, pocket-stakeholder can consume the features/sub-features already defined there rather than requiring decomposition.

## Open Questions

*No unresolved questions at this time.*

## Glossary

| Term | Definition |
|------|------------|
| **Stakeholder** | A simulated expert role that provides input on decisions |
| **Pipeline** | The flow of getting stakeholder input to produce outputs |
| **Interview** | The interactive Q&A process between a stakeholder agent and the user |
| **Decision Record** | A document capturing what was decided and why |

## References

- Existing spec workflow: `specs/README.md`
- ralph-borg commands: See CLAUDE.md
