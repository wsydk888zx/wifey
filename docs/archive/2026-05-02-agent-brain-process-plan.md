# Agent Brain & Process Plan

## Objective

Tighten the project "brain" so future sessions reliably understand the current architecture, start work from a Markdown plan, and leave behind an archived completion record.

## Why This Matters

- The repo already has architecture and ops knowledge, but it is spread across multiple docs.
- `CLAUDE.md` says to work from a Markdown plan, but it does not define one canonical plan/archive workflow.
- Continuity suffers when recurring facts, current priorities, and task history live only in chat.

## Steps

- [x] Inspect existing architecture, process, and agent-guidance docs.
- [x] Identify what is documented well versus what is missing for continuity.
- [x] Add a canonical project-brain doc with architecture, priorities, and workflow guidance.
- [x] Add a Markdown plan/archive workflow doc or template future sessions can reuse.
- [x] Update `CLAUDE.md` so future work starts from an `.md` plan and ends with an archive step.
- [x] Update this plan with completion notes and archive it when the work is done.

## Findings So Far

- `docs/architecture.md`, `docs/ops-playbook.md`, and `docs/dev-rules.md` already capture the technical architecture and many recurring incidents.
- `CLAUDE.md` already contains a strong amount of project memory and says to work from a Markdown plan.
- There is no single canonical "project brain" document that combines architecture, operating assumptions, current priorities, and workflow.
- There is no documented plan naming convention, required plan sections, or explicit archive location for completed work.

## Outputs

- `MEMORY.md`
- `docs/plan-workflow.md`
- `docs/plans/README.md`
- `docs/archive/`
- `CLAUDE.md` updates pointing to the new workflow
- `README.md` and `docs/dev-rules.md` accuracy pass for the current content flow

## Completion Notes

Completed on 2026-05-02.

- Added `MEMORY.md` as the canonical project brain for architecture, operating assumptions, and continuity rules.
- Added `docs/plan-workflow.md` plus `docs/plans/README.md` and `docs/archive/README.md` so active plans and archives have an explicit home.
- Updated `CLAUDE.md` to require opening `MEMORY.md`, starting work from `docs/plans/`, and archiving finished plans into `docs/archive/`.
- Updated `README.md` and `docs/dev-rules.md` so they match the current Supabase-backed content flow instead of the older draft-sync and `releaseUrl` workflow.

## Verification

- `git diff --check`
- Manual review of the updated docs and the new plan/archive structure

## Follow-ups

- Continue correcting or archiving older plan documents when they conflict with the current architecture but are no longer active.
