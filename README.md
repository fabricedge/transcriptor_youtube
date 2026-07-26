# transcriptor_youtube

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Download transcripts/subtitles for every video in a YouTube playlist.

A single static binary — no Python, no API key, no external dependencies.

## Install

### From source

```bash
git clone https://github.com/fabricedge/transcriptor_youtube.git
cd transcriptor_youtube
go build -o yt-transcribe .
```

### From release

Download the pre-built binary for your platform from the [Releases page](https://github.com/fabricedge/transcriptor_youtube/releases).

| File | Platform |
|---|---|
| `yt-transcribe-linux-amd64` | Linux (x86_64) |
| `yt-transcribe-linux-arm64` | Linux (ARM64, e.g. Raspberry Pi) |
| `yt-transcribe-windows-amd64.exe` | Windows (x86_64) |

## Usage

```bash
yt-transcribe [flags] <playlist-url>
```

### Flags

| Flag | Default | Description |
|---|---|---|
| `--lang` | `en` | Subtitle language code |
| `--out` | `transcripts` | Output directory |
| `--format` | `vtt` | Output format: `vtt`, `srt`, `txt` |
| `--cookies` | — | Path to cookies.txt file |
| `--help` | — | Show help |

### Examples

Transcribe a playlist in English (VTT format):

```bash
./yt-transcribe "https://www.youtube.com/playlist?list=PLabc123"
```

```cmd
yt-transcribe-windows-amd64.exe "https://www.youtube.com/playlist?list=PLabc123"
```

Transcribe in Portuguese as SRT:

```bash
./yt-transcribe --lang pt-BR --format srt "https://www.youtube.com/playlist?list=PLabc123"
```

```cmd
yt-transcribe-windows-amd64.exe --lang pt-BR --format srt "https://www.youtube.com/playlist?list=PLabc123"
```

Transcribe using cookies (for age-restricted videos or to bypass rate limits):

```bash
./yt-transcribe --cookies cookies.txt "https://www.youtube.com/playlist?list=PLabc123"
```

```cmd
yt-transcribe-windows-amd64.exe --cookies cookies.txt "https://www.youtube.com/playlist?list=PLabc123"
```

## Use cases

- [MIT OpenCourseWare — 6.006 Introduction to Algorithms](docs/mit-opencourseware.md) — transcribe an entire MIT course playlist with full license compliance, including a real example transcript.

## Windows

### Run

Open **Command Prompt** or **PowerShell** in the folder where you saved the `.exe`:

```cmd
yt-transcribe-windows-amd64.exe "https://www.youtube.com/playlist?list=PLabc123"
```

In PowerShell, prefix with `.\` if the command doesn't run:

```powershell
.\yt-transcribe-windows-amd64.exe --lang pt-BR --format srt "https://www.youtube.com/playlist?list=PLabc123"
```

### Add to PATH (run from any folder)

1. Press **Win + R**, type `sysdm.cpl`, press Enter
2. Go to **Advanced** → **Environment Variables**
3. Under **System variables**, select `Path`, click **Edit**
4. Click **New**, add the folder path (e.g. `C:\Users\You\yt-transcribe`)
5. Click **OK** on all windows, restart your terminal
6. Now you can run from anywhere:

```cmd
yt-transcribe-windows-amd64.exe "https://www.youtube.com/playlist?list=PLabc123"
```

---

## How it works

1. Fetches the playlist RSS feed (`youtube.com/feeds/videos.xml?playlist_id=...`) to list all video IDs.
2. For each video, fetches the transcript via YouTube's InnerTube API using the `ANDROID`/`IOS` client (bypasses pot-token restrictions).
3. Saves each transcript as a timed subtitle file.

## Output formats

- **vtt** — WebVTT (default, widely supported in HTML5 video players)
- **srt** — SubRip (compatible with most media players)
- **txt** — Plain text, one line per segment (best for LLMs and further processing)

## Troubleshooting

### "Sign in to confirm you're not a bot"

Export cookies from your browser logged into YouTube and pass them:

```bash
./yt-transcribe --cookies ~/cookies.txt "https://www.youtube.com/playlist?list=..."
```

```cmd
yt-transcribe-windows-amd64.exe --cookies C:\Users\You\cookies.txt "https://www.youtube.com/playlist?list=..."
```

### No transcripts found

The video may not have captions in the requested language. Try a different language or check if the video has subtitles.

## Limitations

- Playlists are limited to the first ~50 videos returned by the RSS feed.
- Age-restricted videos may require cookies.
- Depends on YouTube's internal API — may break if YouTube changes their endpoints.

## License

[MIT](LICENSE)
