#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -x "$SCRIPT_DIR/.venv/bin/yt-dlp" ]; then
    YT="$SCRIPT_DIR/.venv/bin/yt-dlp"
else
    YT="yt-dlp"
fi

usage() {
    cat <<EOF
Usage: $0 <playlist-url> [language] [output-dir] [--cookies-from-browser BROWSER]

Download transcripts for every video in a YouTube playlist.

Arguments:
  playlist-url          YouTube playlist URL
  language              Subtitle language code (default: en)
  output-dir            Output directory (default: transcripts)
  --cookies-from-browser BROWSER
                        Use cookies from browser (firefox, chrome, chromium, etc.)

Examples:
  $0 "https://youtube.com/playlist?list=PLabc123"
  $0 "https://youtube.com/playlist?list=PLabc123" pt-BR
  $0 "https://youtube.com/playlist?list=PLabc123" en subs --cookies-from-browser firefox
EOF
    exit 1
}

COOKIES_ARG=()
while [ $# -gt 0 ]; do
    case "$1" in
        --cookies-from-browser)
            if [ -z "${2:-}" ]; then
                echo "Error: --cookies-from-browser requires a browser name"
                exit 1
            fi
            COOKIES_ARG=(--cookies-from-browser "$2")
            shift 2
            ;;
        --help|-h)
            usage
            ;;
        *)
            break
            ;;
    esac
done

PLAYLIST_URL="${1:-}"
LANG="${2:-en}"
OUTDIR="${3:-transcripts}"

if [ -z "$PLAYLIST_URL" ]; then
    usage
fi

mkdir -p "$OUTDIR"

echo "Fetching playlist ..."
VIDEO_IDS=$("$YT" "${COOKIES_ARG[@]}" --flat-playlist --print id "$PLAYLIST_URL")
TOTAL=$(echo "$VIDEO_IDS" | wc -l)

if [ "$TOTAL" -eq 0 ]; then
    echo "No videos found in playlist."
    exit 0
fi

echo "Found $TOTAL video(s)"
echo "Output dir: $OUTDIR/"
echo "Language:   $LANG"
echo ""

COUNT=0
FAIL=0

while IFS= read -r id; do
    [ -z "$id" ] && continue
    COUNT=$((COUNT + 1))
    echo "[$COUNT/$TOTAL] $id"

    if "$YT" "${COOKIES_ARG[@]}" --write-subs --sub-langs "$LANG" --skip-download \
        -o "$OUTDIR/%(id)s" \
        "https://www.youtube.com/watch?v=$id"; then
        echo "  OK"
    else
        FAIL=$((FAIL + 1))
        echo "  FAILED"
    fi
done <<< "$VIDEO_IDS"

echo ""
echo "Done — $COUNT processed, $FAIL failed"
echo "Transcripts saved in: $OUTDIR/"
