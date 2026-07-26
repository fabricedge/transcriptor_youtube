# Changelog

## 2.0.1 — 2026-07-26

### Added

- Auto-rejoin URL arguments split by `&` when shell quoting is missing.
- Accept bare playlist IDs and bare video IDs (no URL required).
- MIT OpenCourseWare use case documentation.
- CI and release GitHub Actions workflows.

### Changed

- Improved README with Windows download/run instructions.

## 2.0.0 — 2026-07-26

### Changed

- **Rewritten in Go** — single static binary, no Python or yt-dlp needed.
- Replaced bash script with a compiled Go CLI tool.

### Added

- Native YouTube transcript fetching via InnerTube ANDROID/IOS API.
- Support for VTT, SRT, and plain text output formats.
- `--cookies` flag for cookie-based authentication.
- `--lang`, `--out`, `--format` CLI flags.

### Removed

- Python/yt-dlp dependency.

## 1.0.0 — 2026-07-26

### Added

- Initial release with `transcribe_playlist.sh` bash script.
