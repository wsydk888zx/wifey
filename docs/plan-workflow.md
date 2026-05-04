# Plan Workflow

This repo uses Markdown plans as the source of truth for active work.

## Active Plan Location

- Put active work plans in `docs/plans/`.
- Name them `YYYY-MM-DD-short-task-name.md`.
- Use one plan per scoped task, not one giant rolling file.

## Required Sections

Every active plan should contain:

- `Objective`
- `Context` or `Why This Matters`
- `Steps`
- `Verification`
- `Completion Notes`

Optional but encouraged:

- `Risks`
- `Open Questions`
- `Follow-ups`

## Start-Of-Work Rules

1. Look for an existing active plan in `docs/plans/` that already matches the task.
2. If none exists, create a new plan before treating the task as underway.
3. Write concrete steps, not vague reminders.
4. If the scope changes, update the plan in the same turn.

## During-Work Rules

- Check off completed steps.
- Add short notes when a step changes shape or reveals a new dependency.
- Keep the plan accurate enough that a new session can resume from it without guessing.

## Completion And Archive Rules

1. Add a short completion summary.
2. Record what was verified and what was not.
3. Note any follow-up work that still remains.
4. Move the finished file from `docs/plans/` to `docs/archive/`.

Archived plans are historical records. If follow-up work starts later, create a new active plan and link back to the archived one if helpful.

## Template

```md
# Task Name

## Objective

Short statement of what this task is trying to accomplish.

## Context

Why this task matters and what constraints apply.

## Steps

- [ ] Step one
- [ ] Step two
- [ ] Step three

## Verification

- [ ] Verification command or manual check

## Completion Notes

Pending.
```
