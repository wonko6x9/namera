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

- **Plex-friendly default templates**
  - movie template
  - TV template
  - simple music template placeholder even if music matching is not fully mature yet

- **Settings and local state**
  - local config storage
  - provider configuration surface if needed
  - local cache for provider responses
  - operation history

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

- **Music workflow maturity**
  - stronger music identification
  - artist / album / track path generation
  - album-level batching behavior

- **Subtitle and artwork workflow parity**
  - subtitle search/download where it genuinely earns complexity
  - artwork preview and optional acquisition behavior

- **Smarter rename rules**
  - richer naming templates
  - edition / cut / special handling
  - anime-specific heuristics if needed

- **Batch quality-of-life**
  - queue management
  - selective re-run of failed items
  - better partial-success recovery

- **Import confidence improvements**
  - learning from user corrections within a batch or remembered local rules

- **UI polish**
  - cleaner review flow
  - more usable bulk editing / approval workflow

---

## Version 3

### Destination and media pipeline enhancements

- **WebDAV destination backend**
  - configure WebDAV roots per library type
  - create missing remote folders
  - upload/copy verified outputs to WebDAV
  - verify success before source cleanup
  - resume/retry-aware transfer behavior

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
