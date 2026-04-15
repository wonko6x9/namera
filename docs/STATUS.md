# STATUS

## Current phase
Phases 1 and 2 are at a defendable MVP baseline, Phase 4 local execution is now the active implementation lane

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
Build native local filesystem apply/undo, starting from the existing execution-batch/log contract instead of inventing a second execution model.

## Working implementation snapshot
- TypeScript/Vite desktop MVP is real and runnable
- Filename normalization handles dotted/ugly separators, common release noise, multi-episode markers, and the first pass of edition / part-disc junk trimming
- Movie year extraction and `SxxExx` TV parsing work
- Local heuristic ranking works for movie/episode happy paths
- Plex-style rename-plan generation works
- Exportable plan sets and local config/history scaffolding exist
- Real text/file/folder ingest is wired into the desktop flow
- Provider request shaping exists, live provider lookup is no longer movie-only: OMDb remains wired when configured, TVmaze now adds a TV-specific provider lane for episode searches, provider candidates now feed the preview-selection path, provider results are cached locally, provider diagnostics now surface idle / empty / cached / error states visibly, remembered corrections now persist and can bias future ranking for matching parsed items, the batch review flow now exposes summary counts and review filters, candidate stacks are deduplicated and biased toward live-provider results over equivalent heuristics, match reasons and confidence labels are surfaced visibly in the desktop flow, and manual candidate override is wired into the desktop flow
- Config editing for destination roots and OMDb key is wired into the desktop flow, and configured destination roots now affect generated plans
- TV parsing now separates series title from episode title for better preview naming
- Local execution steps are modeled as explicit dry-run/apply/undo execution batches, apply/undo actions are persisted into a local execution log, and the Tauri side now exposes a native execution-batch preview command
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
