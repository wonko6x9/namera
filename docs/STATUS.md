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
- WebDAV destination support reached an honest preview/handoff boundary in phase 3, but real transfer execution is deferred until local execution is stronger
- Product direction is primarily media matching, renaming, and tagging, with Plex-friendly organization as an important workflow target

## Current next step
Stay focused on Milestone 4 until local execution is boringly trustworthy: tighten batch sequencing, collision reporting, partial-success recovery, and interruption-safe behavior. The newest local slice is persisted batch recovery state; the next likely move is tighter collision/undo integration coverage. WebDAV remote execution stays explicitly deferred until the local lane is solid.

## Working implementation snapshot
- TypeScript/Vite desktop MVP is real and runnable
- Filename normalization handles dotted/ugly separators, common release noise, multi-episode markers, and the first pass of edition / part-disc junk trimming
- Filename normalization handles dotted/ugly separators, common release noise, multi-episode markers, the first pass of edition / part-disc junk trimming, subtitle sidecar qualifiers, and basic audio-file classification into the music lane
- Movie year extraction and `SxxExx` TV parsing work
- Local heuristic ranking works for movie/episode happy paths
- Plex-style rename-plan generation works
- Exportable plan sets and local config/history scaffolding exist
- Real text/file/folder ingest is wired into the desktop flow
- Real text/file/folder ingest is wired into the desktop flow, and recent ingest roots are now remembered so repeated folder-driven sessions are less tedious
- Provider request shaping exists, live provider lookup is no longer movie-only: OMDb remains wired when configured, TVmaze now adds a TV-specific provider lane for episode searches, provider candidates now feed the preview-selection path, provider results are cached locally, provider diagnostics now surface idle / empty / cached / error states visibly, remembered corrections now persist and can bias future ranking for matching parsed items, the batch review flow now exposes summary counts and review filters, candidate stacks are deduplicated and biased toward live-provider results over equivalent heuristics, match reasons and confidence labels are surfaced visibly in the desktop flow, and manual candidate override is wired into the desktop flow
- Provider request shaping exists, live provider lookup is no longer movie-only: OMDb remains wired when configured, TVmaze now adds a TV-specific provider lane for episode searches, provider candidates now feed the preview-selection path, provider results are cached locally, provider diagnostics now surface idle / empty / cached / error states visibly, remembered corrections now persist and can bias future ranking for matching parsed items, the batch review flow now exposes summary counts and review filters, candidate stacks are deduplicated and biased toward live-provider results over equivalent heuristics, match reasons and confidence labels are surfaced visibly in the desktop flow, manual candidate override is wired into the desktop flow, each preview now offers manual web/artwork search escape hatches based on parsed media context, and manual title search defaults are now configurable per media type with sane first-pass presets (IMDb for movies, TVmaze for TV, MusicBrainz for music)
- Config editing for destination roots, execution roots, collision policy, and OMDb key is wired into the desktop flow, and configured destination roots now affect generated plans
- TV parsing now separates series title from episode title for better preview naming
- Local execution steps are modeled as explicit dry-run/apply/undo execution batches, apply/undo actions are persisted into a local execution log, the Tauri side now exposes native apply/undo commands, collision policy is now configurable (`skip`, `overwrite`, `rename-new`), undo now refuses at least one obvious stale-file case by validating recorded apply metadata against the current destination file, visible-batch apply now reports honest per-item outcomes instead of only a rolled-up count, failed batch items can now be retried selectively, and subtitle/sidecar language qualifiers now survive rename planning instead of collapsing into collisions
- Local execution steps are modeled as explicit dry-run/apply/undo execution batches, apply/undo actions are persisted into a local execution log, the Tauri side now exposes native apply/undo commands, collision policy is now configurable (`skip`, `overwrite`, `rename-new`), undo now refuses at least one obvious stale-file case by validating recorded apply metadata against the current destination file, visible-batch apply now reports honest per-item outcomes instead of only a rolled-up count, failed batch items can now be retried selectively, failed batch sets can now be exported as structured JSON directly from the UI, the review lane can now be filtered down to failed batch items only, local apply batches now persist explicit recovery state (planned inputs, completed inputs, failed inputs, last processed item, and per-item outcomes) so interruption/retry behavior stops depending on transient UI memory, the ingest queue now supports per-item removal and whole-queue clearing directly in the desktop flow, and subtitle/sidecar language qualifiers now survive rename planning instead of collapsing into collisions
- Phase 3 WebDAV routing is now configurable per library type (Movies / TV / Music) and previewable in the desktop flow, the review lane lets the user switch preview mode between local destination paths and WebDAV destination/transfer contracts at prompt time, and the desktop review/export flow emits honest review plans, transfer queues, snapshots, intents, validation packets, owner packets, manifests, and status rollups without pretending remote execution exists. Manual mkdir/upload/verify stages can now be marked completed, blocked, or reset back to pending for retry from the desktop flow so downstream handoff state stays truthful while remote execution remains manual. This lane is intentionally paused at the truthful preview/handoff boundary until Milestone 4 local execution work is stronger. Actual upload/copy execution is still not implemented

## Recovery note
If work resumes after interruption, start by reading:
1. `docs/STATUS.md`
2. `docs/BACKLOG.md`
3. `docs/ARCHITECTURE.md`
4. `docs/NAMES.md`
5. `docs/MILESTONES.md`
6. `docs/REPO-STRUCTURE.md`

Then continue from the next implementation step instead of re-discovering the plan from chat.
