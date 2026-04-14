# Namera

Cross-platform Plex-focused media matching, renaming, and tagging tool.

## Current direction

- Windows and Pop!_OS first
- macOS low priority
- parity with core FileBot workflows before major enhancements
- robust filename normalization in MVP
- WebDAV destination support targeted for phase 3
- durable planning and backlog so work survives interruptions

## Product shape

A cross-platform desktop app and local engine for:
- parsing ugly media filenames
- matching movies / TV / music against metadata providers
- previewing rename + move plans
- executing safe renames and moves
- organizing media into Plex-friendly library layouts

## Current status

Real TypeScript/Vite MVP in progress. Parser, local heuristic matching, rename-plan generation, preview UI, editable config for destination roots and OMDb key, config/history scaffolding, exportable plan sets, real file/folder ingest, first OMDb live-lookup wiring, provider-backed preview selection, local provider-response caching, cleaner deduplicated candidate stacks, visible match explanations and confidence labels, manual candidate override controls, richer TV episode parsing/naming, and an explicit local execution contract with dry-run/apply/undo batch modeling are all working. Configured destination roots now affect actual plan generation. Apply/undo actions are now persisted into an honest local execution log, and the Tauri/native side exposes an execution-batch preview command, with a phase-3 WebDAV destination stub held separately. The next useful step is real native filesystem apply/undo replacing the scaffolded log-only execution layer, plus richer provider-backed episode metadata.

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
- honest phase-3 WebDAV destination stub

Still intentionally stubbed:
- broader metadata provider integrations beyond the first OMDb lane
- actual native filesystem execution/undo in the UI, beyond the persisted execution-log scaffold
- verified remote transfer behavior

## Phase progress

- Phase 1: parser + planner MVP, wrapped to a solid baseline
- Phase 2: batch preview + settings/history/provider scaffolding, wrapped to a solid baseline
- Phase 3: destination backend shape stubbed so WebDAV can land without redesign

## Immediate next implementation step

Replace log-only execution scaffolding with real Tauri/Rust filesystem apply/undo, then deepen TV/provider metadata.
