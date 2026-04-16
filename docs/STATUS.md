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
- WebDAV destination support reached an honest preview/handoff boundary in phase 3, but real transfer execution is deferred and now explicitly low priority
- Product direction is primarily media matching, renaming, and tagging, with Plex-friendly organization as an important workflow target
- Product success does not depend on shipping WebDAV support; the local-first workflow is the primary lane

## Current next step
Stay focused on Milestone 4 until local execution is boringly trustworthy: tighten batch sequencing, collision reporting, partial-success recovery, interruption-safe behavior, and Windows install readiness. The newest local slices are persisted batch recovery state, stronger exec-layer coverage for rename-new collisions, stale undo refusal when the source path reappears, apply/undo/reapply cycles, a lightweight diagnostics log for provider/config/execution/recovery troubleshooting, actionable recovery guidance that turns the latest batch state plus diagnostics into concrete next steps, a first honest Windows bundle/build surface (real Tauri bundle metadata, Windows icon wiring, and explicit `pnpm build:desktop` / `pnpm build:windows` entry points), and now a portable-first Tauri packaging path via `pnpm build:portable` plus corrected `beforeBuildCommand` wiring so real no-bundle builds actually run. The next likely move is a Windows-host smoke test of the portable build, then installer packaging later if still worth it. WebDAV remote execution remains explicitly deferred as a low-priority later lane.

## Working implementation snapshot
- TypeScript/Vite desktop MVP is real and runnable, and the Tauri shell is now configured for actual installer-oriented bundle builds instead of only a loose dev shell
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
- Local execution steps are modeled as explicit dry-run/apply/undo execution batches, apply/undo actions are persisted into a local execution log, the Tauri side now exposes native apply/undo commands, collision policy is now configurable (`skip`, `overwrite`, `rename-new`), undo now refuses at least one obvious stale-file case by validating recorded apply metadata against the current destination file, visible-batch apply now reports honest per-item outcomes instead of only a rolled-up count, failed batch items can now be retried selectively, failed batch sets can now be exported as structured JSON directly from the UI, the review lane can now be filtered down to failed batch items only, local apply batches now persist explicit recovery state (planned inputs, completed inputs, failed inputs, last processed item, and per-item outcomes) so interruption/retry behavior stops depending on transient UI memory, exec-layer integration coverage now explicitly exercises rename-new choosing the next free suffix, undo refusal when the original source path has reappeared, and full apply/undo/reapply recovery cycles, a lightweight diagnostics log now records recent provider refreshes, config updates, native execution outcomes, and batch recovery results directly in the desktop flow for troubleshooting, and the recovery panel now derives concrete next steps from the latest failed inputs plus recent execution diagnostics instead of leaving the operator to infer what to do next, the ingest queue now supports per-item removal and whole-queue clearing directly in the desktop flow, and subtitle/sidecar language qualifiers now survive rename planning instead of collapsing into collisions
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

## Latest Windows build-readiness slice
- Tauri config now enables bundling instead of leaving it disabled.
- Windows installer targets are explicitly set to `nsis` and `msi`.
- A Windows `.ico` bundle icon is now present and wired into both the general bundle icon list and NSIS installer config.
- Workspace scripts now expose `pnpm build:desktop`, `pnpm build:portable`, and `pnpm build:windows` so install-test work has obvious entry points.
- Tauri `beforeBuildCommand` and `beforeDevCommand` now resolve correctly from real packaging runs, and `pnpm build:portable` produces a runnable no-bundle app folder under `dist-portable/<platform>/Namera`.
