# CLAUDE.md

## What This Is

pocket-stakeholder - [brief description].

## Commands

```bash
# Add your project commands here
```

## Spec Workflow

This project uses spec-driven development.

- **specs/SPEC.md** - Source of truth for product vision and requirements
- **specs/README.md** - Index of all specifications
- **specs/<feature>.md** - Feature specifications
- **specs/<feature>.implementation.md** - Phased implementation plans

### Working from Implementation Plans

When working from an implementation plan (`.implementation.md` files):

1. Before starting: read the implementation plan to understand scope
2. After completing each checkbox item: **immediately update the plan** by changing `- [ ]` to `- [x]`
3. This keeps progress visible and prevents duplicate work across sessions

## Available Commands

- `/ralph-borg:feature <name>` - Create feature spec via interview
- `/ralph-borg:implement <name>` - Run implementation loop with parallel agents
- `/ralph-borg:status` - Show all feature progress
