# STATUS

## Current phase
Phase 2 working, Phase 3 scaffold started, ingest lane now being pushed beyond demo-only input

## Project name
- **Namera**
- domain secured: **namera.org**

## What has been decided
- This is a new program, not a refactor of FB-Mod
- Preferred architecture is Tauri + Rust core
- Windows and Pop!_OS are the first-class targets
- macOS is low priority
- Achieve parity before major enhancements
- Robust dotted/scene filename normalization is required in MVP
- WebDAV destination support is targeted for phase 3
- Product direction is primarily media matching, renaming, and tagging, with Plex-friendly organization as an important workflow target

## Current next step
Replace demo-only batch input with real text/file ingest, then land the first provider-backed metadata lookup and local execution wiring.

## Working implementation snapshot
- TypeScript/Vite desktop MVP is real and runnable
- Filename normalization handles dotted/ugly separators and basic release noise
- Movie year extraction and `SxxExx` TV parsing work
- Local heuristic ranking works for movie/episode happy paths
- Plex-style rename-plan generation works
- Exportable plan sets and local config/history scaffolding exist
- Provider request shaping exists, first live OMDb lookup wiring is present when an API key is configured, provider candidates now feed the preview-selection path, match reasons are surfaced visibly in the desktop flow, manual candidate override is wired into the desktop flow, config editing for destination roots and OMDb key is wired into the desktop flow, TV parsing now separates series title from episode title for better preview naming, local execution steps are modeled as explicit dry-run/apply/undo execution batches, and the Tauri side now exposes a native execution-batch preview command
- WebDAV is represented honestly as a phase-3 destination stub, not fake functionality

## Recovery note
If work resumes after interruption, start by reading:
1. `docs/STATUS.md`
2. `docs/BACKLOG.md`
3. `docs/ARCHITECTURE.md`
4. `docs/NAMES.md`
5. `docs/MILESTONES.md`
6. `docs/REPO-STRUCTURE.md`

Then continue from the next implementation step instead of re-discovering the plan from chat.
