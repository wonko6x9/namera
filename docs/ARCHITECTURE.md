# Architecture Notes

## Goals

Build a cross-platform successor to FileBot/FB-Mod focused on Plex-friendly media organization.

## Platform priorities

1. Windows
2. Pop!_OS / Linux
3. macOS (later, lower priority)

## Recommended stack

### App shell
- Tauri
- TypeScript UI

### Core engine
- Rust

### Why
- good cross-platform packaging story
- portable/self-contained-friendly distribution targets
- strong filesystem and concurrency behavior for file-heavy workflows
- cleaner long-term maintenance than Java Swing

## Product layers

1. **Normalization + parsing layer**
   - tokenization of ugly filenames
   - separator normalization (dots / underscores / junk)
   - extraction of title, year, season/episode, track info, and noise tokens

2. **Matching layer**
   - provider lookups
   - candidate scoring
   - confidence / ambiguity handling

3. **Planning layer**
   - generate rename + move plan
   - show target path previews
   - detect collisions / suspicious matches

4. **Execution layer**
   - safe rename / copy / move
   - undo history
   - durable operation log

5. **Destination layer**
   - local filesystem first
   - WebDAV later (phase 3)

## Metadata/provider direction

Near-term providers to support for parity-focused work:
- TMDb
- TheTVDB
- OMDb
- FanartTV
- AniDB
- OpenSubtitles (later / optional parity work)
- music metadata provider path to be scoped carefully

## Plex-oriented output rules

### Movies
Preferred default:
- `Movies/{Movie Name} ({Year})/{Movie Name} ({Year}).ext`

### TV
Preferred default:
- `TV Shows/{Series Name}/Season {season.pad(2)}/{Series Name} - S{season.pad(2)}E{episode.pad(2)} - {Episode Title}.ext`

### Music
Preferred default:
- `Music/{Artist}/{Album}/{track.pad(2)} - {Title}.ext`

## Delivery targets

### MVP
- Windows build
- Linux build, preferably AppImage

### Later
- macOS build once the product earns Apple-signing pain
