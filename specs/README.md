# Specifications

Index of specification documents for pocket-stakeholder.

## Base Specification

| Document | Description | Status |
|----------|-------------|--------|
| [SPEC.md](./SPEC.md) | Complete product specification covering vision, features, technical architecture, and roadmap | Living document |

## Feature Specs

*Feature-specific specifications will be added here as they're created.*

| Document | Feature | Status |
|----------|---------|--------|
| [tech-lead-agent.md](./tech-lead-agent.md) | Tech Lead Agent - first stakeholder for architecture decisions and ADRs | Draft |

## Implementation Plans

*Step-by-step implementation guides that reference their parent spec.*

| Document | Spec |
|----------|------|
| [tech-lead-agent.implementation.md](./tech-lead-agent.implementation.md) | tech-lead-agent.md |

## How This Works

- **SPEC.md** is the source of truth for product vision and requirements
- Feature specs are created when implementing specific sections of SPEC.md
- Each feature spec references its parent section in SPEC.md

## Spec Workflow

### The Refinement Flow

```
SPEC.md (explores options)
    ↓
Feature Spec (makes opinionated choices)
    ↓
Implementation Plan (phased tasks)
    ↓
Implementation (builds it)
    ↓
Update CLAUDE.md + SPEC.md (reflect reality)
```

### Document Roles

| Document | Purpose | Technology Stance |
|----------|---------|-------------------|
| **SPEC.md** | Product vision, explores options | Lists alternatives, doesn't mandate |
| **Feature specs** | Implementation plan for specific feature | **Opinionated** - makes specific choices |
| **CLAUDE.md** | Agent guidance for working in codebase | Reflects what's actually built |

### Why This Matters

- **SPEC.md** stays flexible for future features
- **Feature specs** make decisions so implementation can proceed without ambiguity
- **CLAUDE.md** must reflect reality or it misleads the agent

### Adding a New Feature Spec

1. Run `/ralph-borg:feature <name>` to create via interview, OR
2. Create manually: `specs/<feature-name>.md` and `specs/<feature-name>.implementation.md`
3. Add an entry to the Feature Specs table above
4. Update status as work progresses: `Draft` → `In Progress` → `Complete`

### After Implementation

When a feature is built:
1. Update **CLAUDE.md** with patterns, file locations, and working guidance
2. Update feature spec status to `Complete`
