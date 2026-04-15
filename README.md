# Namera

Cross-platform Plex-focused media matching, renaming, and tagging tool.

## Current direction

- Windows and Pop!_OS first
- macOS low priority
- parity with core FileBot workflows before major enhancements
- robust filename normalization in MVP
- local rename/move execution and undo hardening are the active lane
- WebDAV destination support remains a later lane after local execution is defendable
- durable planning and backlog so work survives interruptions

## Product shape

A cross-platform desktop app and local engine for:
- parsing ugly media filenames
- matching movies / TV / music against metadata providers
- previewing rename + move plans
- executing safe renames and moves
- organizing media into Plex-friendly library layouts

## Current status

Real TypeScript/Vite MVP in progress. Parser, local heuristic matching, rename-plan generation, preview UI, editable config for destination roots and OMDb key, config/history scaffolding, exportable plan sets, real file/folder ingest, first OMDb live-lookup wiring, provider-backed preview selection, local provider-response caching, cleaner deduplicated candidate stacks, visible match explanations and confidence labels, manual candidate override controls, richer TV episode parsing/naming, and an explicit local execution contract with dry-run/apply/undo batch modeling are all working. Configured destination roots now affect actual plan generation. Apply/undo actions are now persisted into an honest local execution log, and the Tauri/native side exposes an execution-batch preview command. The phase-3 WebDAV lane has moved beyond a pure stub into truthful handoff/state exports with explicit stage progress and blocked-stage reporting, but still stops short of pretending remote upload exists. The next useful step is resumable/manual remote execution state or real transfer execution, plus richer provider-backed episode metadata.

## Key docs

- `docs/STATUS.md`
- `docs/BACKLOG.md`
- `docs/ARCHITECTURE.md`
- `docs/NAMES.md`
- `docs/MILESTONES.md`
- `docs/REPO-STRUCTURE.md`

## Initial repo layout

- `apps/desktop` - Vite desktop MVP shell with live sample preview
- `packages/core` - shared TypeScript domain types used by the MVP app flow
- `packages/parse` - filename normalization and parsing
- `packages/match` - local heuristic ranking
- `packages/plan` - rename planning
- `crates/*` - Rust/Tauri direction scaffold retained for the eventual native core

## Current MVP state

Working now:
- dotted/ugly filename normalization
- basic movie year extraction
- basic `SxxExx` TV parsing
- local heuristic candidate ranking
- previewable Plex-style rename plan generation
- batch-style desktop sample flow
- local history/config scaffolding in the browser
- provider request scaffolding
- honest phase-3 WebDAV destination and handoff-state exports

Still intentionally stubbed:
- broader metadata provider integrations beyond the first OMDb lane
- fuller native filesystem execution/undo depth in the UI, beyond the current first real slice
- verified remote transfer behavior beyond truthful handoff/state tracking

## Phase progress

- Phase 1: parser + planner MVP, wrapped to a solid baseline
- Phase 2: batch preview + settings/history/provider scaffolding, wrapped to a solid baseline
- Phase 3: destination backend and truthful manual handoff state are in place as an honest preview/export layer, but remote transfer execution is still deferred
- Phase 4: safe local execution and undo hardening is the active implementation lane

## Immediate next implementation step

Keep pushing the local/native execution lane until batch sequencing, collision handling, recovery, and interruption behavior are genuinely trustworthy. After that, resume real WebDAV transfer execution and richer provider-backed metadata.
