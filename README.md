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

Implementation scaffold started.

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
- real metadata provider integrations
- actual filesystem execution/undo in the UI
- real file/folder ingest instead of sample/demo batch input
- verified remote transfer behavior

## Phase progress

- Phase 1: parser + planner MVP, working
- Phase 2: batch preview + settings/history/provider scaffolding, working
- Phase 3: destination backend shape stubbed so WebDAV can land without redesign

## Immediate next implementation step

Replace demo input with real file/folder ingest and add the first live metadata provider integration.
