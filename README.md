# transcriptor_youtube

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/fabricedge/transcriptor_youtube/actions/workflows/ci.yml/badge.svg)](https://github.com/fabricedge/transcriptor_youtube/actions/workflows/ci.yml)

Download transcripts/subtitles for every video in a YouTube playlist.

## Table of Contents

- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [How it works](#how-it-works)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [License](#license)

## Requirements

- **Python 3.8+**
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — automatically handles YouTube's subtitle extraction and bypass mechanisms

The script auto-detects a local `.venv` installation, making it easy to run in isolated environments.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install yt-dlp
```

## Usage

```bash
./transcribe_playlist.sh <playlist-url> [language] [output-dir] [--cookies-from-browser BROWSER]
```

### Arguments

| Argument | Description | Default |
|---|---|---|
| `playlist-url` | YouTube playlist URL | **required** |
| `language` | Subtitle language code | `en` |
| `output-dir` | Output directory | `transcripts` |
| `--cookies-from-browser BROWSER` | Use cookies from browser (firefox, chrome, chromium, brave, edge, opera, safari) | — |

### Examples

Transcribe a playlist in English:

```bash
./transcribe_playlist.sh "https://www.youtube.com/playlist?list=PLabc123"
```

Transcribe in Portuguese:

```bash
./transcribe_playlist.sh "https://www.youtube.com/playlist?list=PLabc123" pt-BR
```

Transcribe using Firefox cookies (bypasses IP bans and age-restricted videos):

```bash
./transcribe_playlist.sh "https://www.youtube.com/playlist?list=PLabc123" en subs --cookies-from-browser firefox
```

## How it works

1. Lists all video IDs in the playlist using `yt-dlp --flat-playlist --print id`.
2. Iterates over each video and downloads its subtitles with `--write-subs --skip-download`.
3. Saves each transcript as a `.vtt` (WebVTT) file in the output directory, named by video ID.

No video content is downloaded — only subtitle data.

## Troubleshooting

### "Sign in to confirm you're not a bot"

YouTube is rate-limiting your IP. Pass your browser's cookies:

```bash
./transcribe_playlist.sh <playlist-url> --cookies-from-browser firefox
```

### "Could not retrieve a transcript"

The video may not have subtitles in the requested language. Try listing available languages first:

```bash
yt-dlp --list-subs "https://www.youtube.com/watch?v=VIDEO_ID"
```

### All downloads fail

Your IP may be blocked. Use `--cookies-from-browser` with a browser logged into YouTube, or use a VPN/proxy.

## Limitations

- **Depends on YouTube's internal API** — yt-dlp and this script may break if YouTube changes its backend.
- **No video content** — only subtitles are downloaded.
- **Requires subtitles** — videos without captions (manual or auto-generated) will be skipped.
- **JavaScript runtime warning** — yt-dlp may warn about missing JS runtimes; this does not affect subtitle downloads.

## License

[MIT](LICENSE)
