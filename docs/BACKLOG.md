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
  - remember recent roots

- **Basic music organization groundwork**
  - parse artist/album/track when tags are available or filename is obvious
  - preview music destination paths
  - do not overpromise advanced music matching yet

- **Better ambiguity tooling**
  - searchable manual series/movie picker
  - sticky correction for repeated series patterns in same batch
  - when a title is unmatched or low-confidence, offer a desktop action to open the system default web search prefilled with the parsed media query (movie title + year, or series + season/episode)
  - add a lightweight artwork grab flow from that search path so the user can choose a poster / DVD cover image and pull it back into the item without pretending we fully solved artwork matching

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
  - queue management
  - selective re-run of failed items beyond the current first-pass retry button (for example preserving richer context, retry policy choices, and exportable failure sets)
  - better partial-success recovery
  - richer per-item review/export from batch execution results

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
