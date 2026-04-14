# Milestones

## Milestone 0, foundation scaffold

Goal: make the repo implementation-ready instead of doc-only.

### Deliverables
- initial monorepo structure for Tauri app + Rust core + shared docs
- baseline workspace manifests and package metadata
- development scripts for local build/test entrypoints
- placeholder UI shell and backend wiring proving app startup path
- contribution and status docs wired to the new structure

### Exit criteria
- repo has a clear source tree
- `cargo` workspace resolves
- Tauri app shell structure exists
- first implementation tickets can land without restructuring the repo again

---

## Milestone 1, normalization engine MVP

Goal: turn ugly filenames into structured candidates reliably.

### Deliverables
- tokenizer and separator normalization
- release-noise classification model/tables
- extraction of title/year and season/episode patterns
- fixtures covering dotted filenames, repeated separators, release tags, and edge cases
- confidence/explanation output from the parser

### Exit criteria
- common dotted movie and TV filenames parse without manual retyping
- parser fixtures exist for real-world garbage cases
- normalization output is stable enough for matcher integration

---

## Milestone 2, movie and TV matching MVP

Goal: convert normalized parse output into ranked metadata candidates.

### Deliverables
- provider abstraction layer
- initial movie provider integration
- initial TV provider integration
- candidate ranking and confidence scoring
- manual override hooks for low-confidence matches
- local cache for provider responses

### Exit criteria
- movie and TV flows can return ranked candidates from real metadata sources
- low-confidence cases surface ambiguity instead of pretending certainty
- matcher outputs are consumable by planning layer

---

## Milestone 3, rename planning and preview

Goal: generate trustworthy rename plans before touching files.

### Deliverables
- plan model for source, metadata, destination, warnings, and confidence
- Plex-friendly default templates for movies and TV
- preview UI for current filename, detected metadata, and target path
- collision detection and suspicious-match warnings
- dry-run-first review flow

### Exit criteria
- user can inspect proposed results before execution
- collisions and ambiguous cases are explicit
- plan format is stable enough to log and replay

---

## Milestone 4, safe execution and undo

Goal: perform local rename/move operations safely and reversibly.

### Deliverables
- local filesystem move/rename executor
- operation log and persisted history
- undo/revert support for completed operations
- conflict policy for collisions and partial failures
- interruption-safe execution state

### Exit criteria
- completed operations are logged and revertable
- partial failures are visible and recoverable
- local rename workflow is usable end-to-end for movies and TV

---

## Milestone 5, batch ingest and settings

Goal: make MVP practical for real library work.

### Deliverables
- folder/file ingest workflow
- batch queue and recent roots
- settings/state storage
- provider configuration surface
- diagnostic status for provider failures and poor matches
- basic music placeholder path template in settings

### Exit criteria
- batch workflow is usable for a folder of mixed files
- settings persist locally
- MVP is coherent enough for early dogfooding

---

## Deferred after MVP

- stronger music matching
- richer ambiguity tooling and sticky corrections
- subtitle/artwork parity features
- WebDAV destination backend
- automation hooks and watch folders
- macOS distribution polish
