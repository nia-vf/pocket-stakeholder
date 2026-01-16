# ADR-001: Technology Stack Selection

## Status
Accepted

## Context

The pocket-stakeholder project needs a technology stack for implementing the Tech Lead Agent and subsequent stakeholder agents. The core requirements from the specification are:

**Performance Requirements:**
- CLI startup < 1 second
- Interview questions appear within 2 seconds
- Full pipeline (3 stakeholders) completes in reasonable interaction time

**Functional Requirements:**
- LLM API integration (Claude API)
- Markdown parsing for spec files
- File system I/O for reading specs and writing outputs
- CLI interface for interactive interviews
- Module export for programmatic invocation (orchestrator integration)

**Architecture Requirements:**
- Pluggable stakeholder roles
- Extensible output generators
- Compatible with ralph-borg commands and spec workflow
- Document-centric (markdown outputs)

**Candidates from SPEC.md:**
1. Node.js/TypeScript
2. Python
3. Go

## Decision

We will use **Node.js with TypeScript** as the implementation stack.

## Consequences

### Positive

1. **Type Safety**: TypeScript provides strong typing which helps define clear interfaces for `StakeholderAgent`, `FeatureContext`, `InterviewResult`, and `Recommendations` types as specified in SPEC.md.

2. **Ecosystem Fit**: The ralph-borg ecosystem uses JavaScript/TypeScript conventions (npm scripts, package.json). This ensures seamless integration with existing workflow commands.

3. **CLI Tooling**: Excellent libraries for CLI development:
   - `commander` or `yargs` for command parsing
   - `inquirer` or `prompts` for interactive interviews
   - `chalk` or `kleur` for output formatting

4. **Fast Development**: Quick iteration cycles, hot reloading during development, and extensive npm ecosystem for common tasks.

5. **Anthropic SDK**: Official `@anthropic-ai/sdk` package provides native TypeScript support with proper types.

6. **Markdown Processing**: Libraries like `remark` and `unified` provide excellent markdown parsing capabilities for spec file processing.

7. **Startup Performance**: Node.js CLI tools can achieve sub-second startup times, meeting the < 1 second requirement. For even faster startup, can consider bundling with `esbuild` or `bun`.

### Negative

1. **Runtime Dependency**: Requires Node.js installed (mitigated: nearly universal among developers, can bundle to standalone executable with `pkg` or `nexe` if needed).

2. **Not Single Binary**: Unlike Go, cannot distribute as a single self-contained binary without additional tooling.

3. **Memory Usage**: Higher baseline memory than Go for simple CLI operations (acceptable for our use case involving LLM API calls which dominate execution time).

## Alternatives Considered

### Python
- **Pros**: Strong AI/LLM ecosystem (LangChain, LlamaIndex), easy prototyping, good markdown libraries
- **Cons**: Slower startup time, dependency management complexity (virtualenv/poetry), less natural fit with existing ralph-borg JavaScript tooling
- **Rejected because**: Integration friction with ralph-borg ecosystem and slower CLI startup

### Go
- **Pros**: Fast startup, single binary distribution, strong performance
- **Cons**: Less mature LLM SDK ecosystem, more verbose for rapid iteration, weaker ecosystem for interactive CLI prompts
- **Rejected because**: Slower development iteration and less ecosystem support for our LLM-heavy use case
