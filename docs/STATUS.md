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
Push phase 3 beyond transfer-contract previews into actual remote execution semantics, while continuing to harden execution behavior, collision reporting, and richer recovery/reporting around partial success.

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
- Local execution steps are modeled as explicit dry-run/apply/undo execution batches, apply/undo actions are persisted into a local execution log, the Tauri side now exposes native apply/undo commands, collision policy is now configurable (`skip`, `overwrite`, `rename-new`), undo now refuses at least one obvious stale-file case by validating recorded apply metadata against the current destination file, visible-batch apply now reports honest per-item outcomes instead of only a rolled-up count, failed batch items can now be retried selectively, failed batch sets can now be exported as structured JSON directly from the UI, the review lane can now be filtered down to failed batch items only, the ingest queue now supports per-item removal and whole-queue clearing directly in the desktop flow, and subtitle/sidecar language qualifiers now survive rename planning instead of collapsing into collisions
- Phase 3 WebDAV routing is now configurable per library type (Movies / TV / Music) and previewable in the desktop flow, the review lane now lets the user switch preview mode between local destination paths and WebDAV destination/transfer contracts at prompt time instead of treating remote routing as all-or-nothing, the desktop review/export flow now emits both full and filter-respecting visible review plan sets that record the selected destination backend plus the honest remote transfer contract preview (mkdir/upload/verify or blocked reasons), it now also exports a truthful WebDAV transfer queue for the currently visible set with per-item ready/blocked state, concrete actions/reasons, ready-only and blocked-only subsets, a deduplicated visible-next-actions rollup, visible blocked-reason rollups, saved queue snapshots for later handoff/review, the latest saved snapshot as a stable JSON export surface, and persisted transfer intents that now carry explicit prerequisite checklist entries, derived handoff-readiness state, handoff ownership/notes, assignment timestamps, acknowledgement state, lifecycle event history, plus an explicit blocked-items-resolved control that can promote a saved intent to handoff-ready after follow-up triage without recreating it, plus a ready-operation handoff packet that cleanly separates executable remote actions from remaining blocked items and scores packet readiness with explicit assigned/acknowledged/ready-ops/blocked-items checks, plus a pass/fail handoff validation export with actionable remediation next steps for downstream triage, plus a condensed execution brief export for downstream operators that groups mkdir/upload/verify work and adds an owner-facing execution checklist, plus a machine-readable remote checklist packet export, plus a concise WebDAV handoff summary export for downstream operators, plus a per-stage WebDAV operation manifest export with per-item target detail, plus a WebDAV owner packet export with acknowledgement and required-action detail, and latest, recent, acknowledged, and handoff-ready packet review surfaces without claiming remote execution. The status lane summarizes WebDAV transfer readiness overall, by media kind, and with grouped blocked reasons across the current review set. Actual upload/copy execution is still not implemented

## Recovery note
If work resumes after interruption, start by reading:
1. `docs/STATUS.md`
2. `docs/BACKLOG.md`
3. `docs/ARCHITECTURE.md`
4. `docs/NAMES.md`
5. `docs/MILESTONES.md`
6. `docs/REPO-STRUCTURE.md`

Then continue from the next implementation step instead of re-discovering the plan from chat.
