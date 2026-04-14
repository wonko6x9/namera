# Initial Repo Structure

This structure is meant to get Namera into implementation mode fast, without overbuilding.

```text
namera/
├── README.md
├── .gitignore
├── Cargo.toml                  # Rust workspace root
├── package.json                # JS workspace root
├── pnpm-workspace.yaml         # or npm workspaces if we choose npm
├── docs/
│   ├── STATUS.md
│   ├── BACKLOG.md
│   ├── ARCHITECTURE.md
│   ├── NAMES.md
│   ├── MILESTONES.md
│   └── REPO-STRUCTURE.md
├── apps/
│   └── desktop/                # Tauri app shell + frontend UI
│       ├── package.json
│       ├── src/
│       ├── src-tauri/
│       └── tests/
├── crates/
│   ├── namera-core/            # shared domain logic
│   │   ├── src/
│   │   └── tests/
│   ├── namera-parse/           # normalization + parsing engine
│   │   ├── src/
│   │   ├── tests/
│   │   └── fixtures/
│   ├── namera-match/           # provider abstraction + ranking
│   │   ├── src/
│   │   └── tests/
│   ├── namera-plan/            # rename/move plan generation
│   │   ├── src/
│   │   └── tests/
│   ├── namera-exec/            # safe execution + undo/logging
│   │   ├── src/
│   │   └── tests/
│   └── namera-config/          # settings, local state, cache paths
│       ├── src/
│       └── tests/
├── fixtures/
│   ├── filenames/
│   ├── provider-responses/
│   └── plans/
├── scripts/
│   ├── bootstrap.sh
│   ├── dev.sh
│   └── test.sh
└── .github/                    # optional later, if GitHub remains in play
```

## Notes

- Keep parsing, matching, planning, and execution separate. Those are real boundaries, not architecture-cosplay.
- `namera-core` should hold shared types and domain models, not become a junk drawer.
- Start with a desktop app only. No service split, no worker mode, no plugin circus.
- Favor fixture-heavy parser/matcher tests early. This product lives or dies on ugly real-world filenames.
- WebDAV should land later as an additional destination backend, not contaminate MVP core abstractions.
