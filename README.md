# transcriptor_youtube

Download transcripts/subtitles for every video in a YouTube playlist.

## Requirements

- Python 3.8+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)

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

### Examples

Transcribe a playlist in English:

```bash
./transcribe_playlist.sh "https://www.youtube.com/playlist?list=PLabc123"
```

Transcribe in Portuguese:

```bash
./transcribe_playlist.sh "https://www.youtube.com/playlist?list=PLabc123" pt-BR
```

If YouTube blocks your IP or asks for login, pass cookies from your browser:

```bash
./transcribe_playlist.sh "https://www.youtube.com/playlist?list=PLabc123" en subs --cookies-from-browser firefox
```

Supported browsers: `firefox`, `chrome`, `chromium`, `brave`, `edge`, `opera`, `safari`.

## Output

Transcripts are saved as `.vtt` (WebVTT) files named by video ID in the output directory (default: `transcripts/`).
