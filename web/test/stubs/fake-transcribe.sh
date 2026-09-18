#!/usr/bin/env bash
# Stub for the real yt-transcribe Go binary (test-only).
# Mirrors its CLI: --lang L --format F --out DIR <url-or-id>
if [[ -n "$FAKE_TRANSCRIBE_FAIL" ]]; then
  echo "no captions found for video" >&2
  exit 1
fi
out=""
lang="en"
format="txt"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) out="$2"; shift 2 ;;
    --lang) lang="$2"; shift 2 ;;
    --format) format="$2"; shift 2 ;;
    *) url="$1"; shift ;;
  esac
done
id="$(printf '%s' "$url" | sed -n 's/.*v=\([A-Za-z0-9_-]\{11\}\).*/\1/p')"
[[ -z "$id" ]] && { printf 'could not extract id from %s\n' "$url" >&2; exit 1; }
ext="$format"
printf 'stub transcript for %s [%s]\nline one\nline two\n' "$id" "$lang" > "$out/$id.$ext"
echo "OK"