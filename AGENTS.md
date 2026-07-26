# transcriptor_youtube — AI Helper

## Build & Run

```bash
go build -o yt-transcribe .
./yt-transcribe --help
./yt-transcribe "https://www.youtube.com/playlist?list=<id>"
./yt-transcribe --lang pt-BR --format srt "https://www.youtube.com/playlist?list=<id>"
```

## Code Quality

```bash
go vet ./...
```

## Project Structure

| File | Purpose |
|---|---|
| `main.go` | CLI entry point, flag parsing |
| `playlist.go` | Fetches playlist RSS feed, extracts video IDs |
| `transcript.go` | Wraps `rapha30/yt-youtube-transcript` for InnerTube fetching |
| `formatter.go` | Output formatters (VTT, SRT, TXT) |

## Key Library

`github.com/rapha30/yt-youtube-transcript/transcript` — no API key, no external deps.

- `transcript.Fetch(ctx, videoID, opts)` → `*Result` with `Segments []Segment`
- Each `Segment` has `StartMs`, `DurMs`, `Text`
- `Result` also provides `.Text()`, `.SRT()`, `.Timestamps()` string methods

## Conventions

- Standard Go project layout (flat, simple CLI)
- Package name: `main`
- Error handling: return errors, log.Fatalf only in main.go
- Context propagation for timeouts
- No external config files — all config via CLI flags
- No tests directory yet — manual testing against real playlists
