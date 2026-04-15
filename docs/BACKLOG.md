# Backlog

## Planning principles

- Reach practical parity with core FileBot workflows before major enhancements
- Fix modern filename garbage early, because it is blocking core usefulness now
- Prefer safe preview + execution over clever automation theater
- Keep the app recoverable and interruption-tolerant
- Treat WebDAV as a destination backend, not a rename-engine assumption

---

## MVP

### P0, must-have

- **Project scaffolding**
  - initialize repo structure for Tauri app + Rust core
  - baseline build targets for Windows and Linux
  - durable docs and backlog checked in

- **Robust filename normalization**
  - treat dots, underscores, and repeated punctuation as separators by default
  - collapse repeated separators and whitespace
  - preserve meaningful tokens like year, season/episode, part/disc markers
  - classify common release noise: resolution, source, codec, audio, release group
  - reconstruct clean title candidates for matching
  - ensure modern dotted filenames do not require manual retyping in common cases

- **Movie matching**
  - parse movie title + year candidates from filenames
  - query metadata providers
  - candidate ranking and confidence scoring
  - manual override when confidence is low
  - status: MVP baseline achieved

- **TV matching**
  - parse season/episode patterns reliably
  - query TV metadata providers
  - candidate ranking and confidence scoring
  - manual override when confidence is low
  - status: MVP baseline achieved

- **Rename plan preview**
  - show current filename, detected metadata, and proposed output path
  - surface ambiguity and low-confidence cases clearly
  - dry-run mode by default before execution
  - status: MVP baseline achieved

- **Safe local rename/move execution**
  - execute rename/move on local filesystems
  - collision detection and conflict policy
  - operation log
  - undo / revert history for completed operations
  - now the active implementation lane
  - current honest state: first collision policy pass exists (`skip`, `overwrite`, `rename-new`), undo validates some stale-file cases, visible-batch apply now reports per-item outcomes honestly, and subtitle sidecars preserve language qualifiers during rename planning, but batch-wide sequencing/recovery is still a live seam

- **Plex-friendly default templates**
  - movie template
  - TV template
  - simple music template placeholder even if music matching is not fully mature yet
  - default root routing should be opinionated: movies go under the Movies root, TV goes under the TV root with series folders and season subfolders, and music goes under the Music root with primary artist / album structure

- **Settings and local state**
  - local config storage
  - provider configuration surface if needed
  - local cache for provider responses
  - operation history
  - make routing, provider defaults, search fallbacks, artwork/manual-search actions, and per-type WebDAV destinations configurable with sane defaults and importable/editable presets for different system preferences

### P1, strong MVP candidates

- **Folder ingest workflow**
  - select file(s) or folder(s)
  - batch process queue
  - current honest state: recent ingest roots are now remembered, but queue management is still minimal

- **Basic music organization groundwork**
  - parse artist/album/track when tags are available or filename is obvious
  - preview music destination paths
  - do not overpromise advanced music matching yet

- **Better ambiguity tooling**
  - searchable manual series/movie picker
  - sticky correction for repeated series patterns in same batch
  - current honest state: desktop preview now exposes manual title/artwork search buttons populated from parsed media context, and title search defaults are configurable per media type, but artwork import remains unfinished
  - add a lightweight artwork grab/import flow from that search path so the user can choose a poster / DVD cover image and pull it back into the item without pretending we fully solved artwork matching

- **Status and diagnostics**
  - provider error details
  - quick explanation for why a match scored poorly

---

## Version 2

### Core parity expansion

- **Broader provider parity**
  - expand and harden provider support beyond MVP basics
  - better fallback ordering among providers
  - richer metadata pull for artwork and extended info
  - default provider/search lane per file by detected media type instead of one generic flow: audio -> music search, `SxxEyy` patterns -> TV search, otherwise video -> movie search

- **Music workflow maturity**
  - stronger music identification
  - artist / album / track path generation
  - album-level batching behavior

- **Subtitle and artwork workflow parity**
  - subtitle search/download where it genuinely earns complexity
  - artwork preview and optional acquisition behavior
  - manual fallback: launch a default image/web search for posters or DVD covers using parsed media context, then let the user import the selected image into the media item workflow

- **Smarter rename rules**
  - richer naming templates
  - edition / cut / special handling
  - anime-specific heuristics if needed

- **Batch quality-of-life**
  - richer queue management beyond the current first pass of per-item removal and whole-queue clearing in the ingest lane
  - selective re-run of failed items beyond the current first-pass retry button (for example preserving richer context, retry policy choices, and exportable failure sets)
  - better partial-success recovery
  - current honest state: failed batch sets can now be exported as structured JSON and filtered directly in the review lane, and the ingest queue now supports per-item removal plus whole-queue clearing, but richer queue management and retry policy controls are still open

- **Import confidence improvements**
  - learning from user corrections within a batch or remembered local rules

- **UI polish**
  - cleaner review flow
  - more usable bulk editing / approval workflow

---

## Version 3

### Destination and media pipeline enhancements

- **WebDAV destination backend**
  - configure WebDAV roots per library type (Movies / TV / Music independently)
  - create missing remote folders
  - upload/copy verified outputs to WebDAV
  - verify success before source cleanup
  - resume/retry-aware transfer behavior
  - allow prompt-time choice to copy matched files to the configured per-type WebDAV destination instead of treating remote transfer as all-or-nothing global behavior
  - current honest state: per-type WebDAV destination routing is now configurable and previewable, the desktop review now supports prompt-time local-vs-WebDAV destination preview selection, exported review plans now preserve the selected destination backend plus honest transfer contracts for both the full queue and the currently filtered visible subset, the desktop flow also exports a truthful WebDAV transfer queue for the visible set with a summary block, per-item ready/blocked state, concrete actions/reasons, ready-only plus blocked-only subsets, a deduplicated next-actions rollup, visible blocked-reason rollups, persisted queue snapshots for later review/handoff, a stable JSON export of the latest saved snapshot, and persisted transfer intents derived from saved snapshots with explicit next-action, blocker, prerequisite, derived handoff readiness, handoff owner/note, assignment timestamp, acknowledgement state, lifecycle event history, plus an explicit control to mark blocked items resolved after snapshot review so handoff readiness can advance without recreating the intent, and a richer ready-operation handoff packet that separates ready remote actions from still-blocked items plus an explicit packet-readiness checklist (assigned, acknowledged, ready ops present, blocked items cleared) for downstream execution without pretending upload exists, plus latest and recent and acknowledged and handoff-ready packet exports, the status lane now summarizes which queued items are WebDAV-ready vs blocked overall, by media kind, and by grouped blocked reasons for triage, the review lane can now filter directly to WebDAV-ready vs blocked items, and phase 3 transfer contracts are previewed honestly (mkdir/upload/verify or blocked reasons), but transfer/upload execution remains unimplemented

- **Library-specific destination routing**
  - separate destination profiles for Movies / TV / Music
  - TV path routing by series/season
  - Music path routing by artist/album
  - Movie dump-to-folder or foldered-movie options

- **Ingest pipeline behavior**
  - rename locally, then transfer remotely
  - optional source cleanup after verified success
  - better queue/reporting around remote destinations

- **Automation hooks**
  - watch-folder or scheduled ingest once the manual workflow is trusted
  - optional Plex-friendly post-processing hooks

- **Advanced metadata and polish**
  - richer artwork / extras / collection behavior
  - provider health dashboard
  - more powerful correction memory

---

## Version 4+ / nice-to-have

- macOS packaging and distribution polish
- plugin system if real need emerges
- shared profiles / export-import of library configs
- deeper Plex integration if it proves useful
- remote job execution / worker mode if scale ever demands it

---

## Explicit non-goals for MVP

- WebDAV transfers
- Apple-first packaging polish
- perfect parity with every obscure FileBot script/workflow
- overbuilt plugin architecture
- cloud service dependency for core matching/renaming workflow
