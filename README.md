# Namera

Cross-platform Plex-focused media matching, renaming, and tagging tool.

## Current direction

- Windows and Pop!_OS first
- macOS low priority
- parity with core FileBot workflows before major enhancements
- robust filename normalization in MVP
- local rename/move execution and undo hardening are the active lane
- Windows install readiness and local-first workflow polish now outrank remote destination work
- WebDAV destination support remains a low-priority later lane, useful but not required for product success
- durable planning and backlog so work survives interruptions

## Product shape

A cross-platform desktop app and local engine for:
- parsing ugly media filenames
- matching movies / TV / music against metadata providers
- previewing rename + move plans
- executing safe renames and moves
- organizing media into Plex-friendly library layouts

## Current status

Real TypeScript/Vite MVP in progress. Parser, local heuristic matching, rename-plan generation, preview UI, editable config for destination roots and OMDb key, config/history scaffolding, exportable plan sets, real file/folder ingest, first OMDb live-lookup wiring, provider-backed preview selection, local provider-response caching, cleaner deduplicated candidate stacks, visible match explanations and confidence labels, manual candidate override controls, richer TV episode parsing/naming, and an explicit local execution contract with dry-run/apply/undo batch modeling are all working. Configured destination roots now affect actual plan generation. Apply/undo actions are now persisted into an honest local execution log, the Tauri/native side exposes an execution-batch preview command, local batch recovery state now persists across runs, and the desktop flow now surfaces diagnostics plus recovery guidance for local execution troubleshooting. The phase-3 WebDAV lane has moved beyond a pure stub into truthful handoff/state exports with explicit stage progress and blocked-stage reporting, but it is now a deliberately low-priority lane rather than the success path for the product. The next useful step is Windows install readiness and local workflow polish, plus richer provider-backed episode metadata. The Tauri app now also carries real Windows bundle metadata, icon wiring, and explicit `pnpm build:desktop` / `pnpm build:windows` entry points so installer-oriented validation stops depending on ad-hoc manual commands. It also now has a portable-first build path via `pnpm build:portable`, which produces a runnable app folder without needing installer generation.

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

Keep pushing the local/native execution lane until batch sequencing, collision handling, recovery, interruption behavior, and Windows install readiness are genuinely trustworthy. WebDAV can stay paused as a low-priority later lane while the core local product becomes solid.

## Build entry points

- `pnpm build` - build the frontend bundle only
- `pnpm build:desktop` - build the frontend and run the Tauri desktop bundle flow
- `pnpm build:portable` - build a portable Tauri app folder under `dist-portable/<platform>/Namera`
- `pnpm build:windows` - build the frontend and produce Windows installer targets (`nsis`, `msi`) from the Tauri app on a Windows host
