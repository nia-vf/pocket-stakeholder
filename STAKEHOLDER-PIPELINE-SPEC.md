# Stakeholder Pipeline Spec

A Claude Code plugin system that models key delivery stakeholders as specialized agents, running in parallel with feedback loops to produce comprehensive feature specifications before implementation.

## Concept

Traditional software delivery involves multiple stakeholders - UX, Architecture, Business Analysis, Development - each bringing different perspectives to feature definition. This plugin system replicates that collaborative process using specialized Claude Code agents.

Rather than a single agent trying to think about all concerns, each stakeholder agent focuses on their domain expertise, produces artifacts, and raises questions for other stakeholders or the user (acting as Product Owner).

## Architecture

```
                    ┌─────────────┐
                    │   User/PO   │
                    │  (request)  │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  UX Lead   │  │  Architect │  │     BA     │
    │  (flows)   │  │  (system)  │  │  (rules)   │
    └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           ▼
                    ┌─────────────┐
                    │  Resolver   │  ← Identifies conflicts, asks user
                    │   (sync)    │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Developer  │  ← Implementation plan
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  borg-ralph │  ← Parallel implementation agents
                    └─────────────┘
```

## Stakeholder Roles

### UX Lead

**Focus:** User experience, flows, interactions, accessibility

**Inputs:**
- Feature request
- Existing product context

**Outputs:**
- `ux-spec.md` - User flows, screen inventory, interaction patterns
- Questions about user needs, edge cases

**Interview concerns:**
- Who are the users?
- What's the current journey vs proposed?
- What screens/interactions are needed?
- Error states and edge cases?
- Accessibility requirements?

---

### Architect

**Focus:** System design, technical constraints, build vs buy decisions

**Inputs:**
- Feature request
- Existing codebase analysis
- UX spec (when available)

**Outputs:**
- `technical-design.md` - System boundaries, data models, API contracts
- `adrs/ADR-NNN-<decision>.md` - Architecture Decision Records
- Questions about scale, performance, security requirements

**Interview concerns:**
- What system boundaries are affected?
- Data model changes needed?
- API contracts (internal and external)?
- Non-functional requirements (scale, perf, security)?
- Build vs buy decisions?
- Technical risks?

---

### Business Analyst (BA)

**Focus:** Business rules, requirements detail, acceptance criteria

**Inputs:**
- Feature request
- UX spec
- Technical design

**Outputs:**
- `requirements.md` - Detailed functional requirements
- `acceptance-criteria.md` - Testable criteria (Gherkin or checklist format)
- Questions about business rules, edge cases, data validation

**Interview concerns:**
- What are the business rules?
- Data validation requirements?
- Edge cases and error handling?
- Integration touchpoints?
- Regulatory/compliance needs?

---

### Resolver

**Focus:** Conflict identification and resolution facilitation

**Inputs:**
- All stakeholder outputs
- `questions.md` from all stakeholders

**Outputs:**
- Conflict summary for user
- `decisions.md` recording user decisions
- Triggers for stakeholder revisions if needed

**Responsibilities:**
- Identify contradictions between stakeholder outputs
- Surface unresolved questions to user
- Record decisions
- Determine if stakeholders need to revise based on decisions

---

### Developer

**Focus:** Implementation planning

**Inputs:**
- All resolved specs and decisions

**Outputs:**
- `implementation.md` - Phased implementation plan with checkboxes
- Ready for borg-ralph execution

---

## Workflow

### Phase 1: Parallel Stakeholder Analysis

User provides feature request. UX Lead, Architect, and BA run in parallel (via borg slots), each:
1. Reading the feature request
2. Analyzing existing codebase/context
3. Conducting their domain-specific interview (if interactive) or analysis
4. Producing their artifacts
5. Appending any questions/concerns to `questions.md`

### Phase 2: Resolution

Resolver agent:
1. Reads all stakeholder outputs
2. Identifies conflicts and contradictions
3. Presents consolidated questions to user
4. Records decisions in `decisions.md`
5. Determines if any stakeholder needs to revise

### Phase 3: Iteration (if needed)

If decisions require significant changes:
1. Affected stakeholder(s) re-run with new context
2. May trigger cascade (e.g., Architect change affects BA requirements)
3. Loop until no pending questions remain

### Phase 4: Implementation Planning

Developer agent:
1. Reads all finalized specs
2. Generates phased `implementation.md`
3. Each phase scoped for single agent session (2-3 tasks)

### Phase 5: Execution

Hand off to borg-ralph:
1. `borg-ralph loop <feature> specs/<feature>/implementation.md`
2. Parallel implementation agents execute phases
3. Checkboxes track progress

---

## Artifact Structure

```
specs/<feature>/
├── request.md              # Initial user request (input)
├── ux-spec.md              # UX Lead output
├── technical-design.md     # Architect output
├── adrs/
│   └── ADR-001-*.md        # Architecture Decision Records
├── requirements.md         # BA output
├── acceptance-criteria.md  # BA output (testable criteria)
├── questions.md            # Cross-stakeholder questions/concerns
├── decisions.md            # User/PO decisions on conflicts
├── implementation.md       # Developer output (for borg-ralph)
└── status.json             # Pipeline state tracking
```

---

## The Feedback Loop: `questions.md`

This file is the collaboration primitive. Any stakeholder can append questions or concerns:

```markdown
# Questions & Concerns

## From: Architect
**Re:** UX wizard flow (ux-spec.md#wizard-flow)
**Concern:** Multi-step wizard requires complex state management.
Are we okay with browser refresh losing progress, or do we need
server-side draft persistence?
**Options:**
1. Accept refresh = lost progress (simpler)
2. Add draft persistence (adds complexity)
**Status:** PENDING

---

## From: BA
**Re:** Technical Design (technical-design.md#async-processing)
**Concern:** Async order processing conflicts with requirement
that users see confirmation number immediately.
**Question:** Can we show a pending confirmation that updates?
**Status:** PENDING

---

## From: UX Lead
**Re:** Requirements (requirements.md#field-validation)
**Concern:** Inline validation on every field may feel aggressive.
**Suggestion:** Validate on blur, not on keystroke.
**Status:** RESOLVED → See decisions.md#validation-timing
```

### Question States

- `PENDING` - Awaiting user decision
- `RESOLVED` - Decision made, recorded in decisions.md
- `REVISED` - Stakeholder updated their artifact based on decision

---

## Plugin Structure

```
stakeholder-pipeline/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── kickoff.md          # /pipeline:kickoff <feature>
│   ├── ux.md               # /pipeline:ux <feature> (run UX alone)
│   ├── architect.md        # /pipeline:architect <feature>
│   ├── ba.md               # /pipeline:ba <feature>
│   ├── resolve.md          # /pipeline:resolve <feature>
│   ├── plan.md             # /pipeline:plan <feature>
│   ├── run.md              # /pipeline:run <feature> (full pipeline)
│   └── status.md           # /pipeline:status [feature]
├── scripts/
│   └── pipeline            # Orchestration (integrates with borg)
├── skills/
│   ├── ux/
│   │   ├── SKILL.md
│   │   └── templates/
│   ├── architect/
│   │   ├── SKILL.md
│   │   └── templates/
│   ├── ba/
│   │   ├── SKILL.md
│   │   └── templates/
│   ├── resolver/
│   │   └── SKILL.md
│   └── developer/
│       ├── SKILL.md
│       └── templates/
└── templates/
    ├── request.template.md
    ├── questions.template.md
    ├── decisions.template.md
    └── status.template.json
```

---

## Commands

### `/pipeline:kickoff <feature>`

Start parallel stakeholder analysis:
1. Create `specs/<feature>/` directory
2. Create `request.md` from user input (or prompt for it)
3. Spawn parallel borg slots for UX, Architect, BA
4. Wait for completion
5. Auto-run resolver to identify conflicts
6. Report status and pending questions

### `/pipeline:resolve <feature>`

Interactive conflict resolution:
1. Read `questions.md`
2. Present each PENDING question to user
3. Record decisions in `decisions.md`
4. Mark questions as RESOLVED
5. If major revisions needed, offer to re-run affected stakeholder

### `/pipeline:plan <feature>`

Generate implementation plan:
1. Verify no PENDING questions remain
2. Read all specs and decisions
3. Generate `implementation.md` with phased tasks
4. Report ready for implementation

### `/pipeline:run <feature>`

Full pipeline execution:
1. kickoff → resolve (loop until clear) → plan → implement
2. May pause for user input during resolve phase

### `/pipeline:status [feature]`

Show pipeline progress:
- Which stakeholders have completed
- Pending questions count
- Implementation progress (if started)

---

## Integration with borg-ralph

This pipeline produces specs; borg-ralph executes them.

```bash
# Option 1: Pipeline then borg-ralph separately
/pipeline:kickoff user-auth
/pipeline:resolve user-auth
/pipeline:plan user-auth
borg-ralph loop user-auth specs/user-auth/implementation.md

# Option 2: Full automation
/pipeline:run user-auth  # Does everything including implementation
```

The `pipeline` script uses `borg` under the hood for parallel stakeholder execution:

```bash
borg spawn ux-$feature "Analyze feature as UX Lead..."
borg spawn arch-$feature "Analyze feature as Architect..."
borg spawn ba-$feature "Analyze feature as BA..."
borg wait ux-$feature arch-$feature ba-$feature
```

---

## Design Principles

1. **Parallel by default** - Stakeholders don't wait for each other initially
2. **Explicit handoffs** - Artifacts are the communication medium, not direct agent-to-agent calls
3. **Human in the loop** - User resolves conflicts, makes product decisions
4. **Iterative refinement** - Loop until consensus, don't force single-pass completion
5. **Composable** - Can run individual stakeholders or full pipeline
6. **Integration-ready** - Outputs feed directly into borg-ralph for implementation

---

## Open Questions

- Should stakeholders be able to read each other's in-progress work, or only completed artifacts?
- How to handle stakeholder disagreement that user doesn't want to resolve (e.g., "you two figure it out")?
- Should there be a "tech lead" or "senior dev" reviewer before implementation?
- How to handle features that span multiple existing features/specs?
- Version control for specs - how to track evolution of decisions?

---

## Future Enhancements

- **Stakeholder personas** - Configurable personality/priorities for each role
- **Project memory** - Learn from past decisions to inform new features
- **Dependency detection** - Identify when features conflict or depend on each other
- **Cost estimation** - Architect/Developer provide rough effort estimates
- **Risk flagging** - Highlight high-risk decisions for extra review
