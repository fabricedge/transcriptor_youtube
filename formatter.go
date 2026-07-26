package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/rapha30/yt-youtube-transcript/transcript"
)

func msToVTT(ms int) string {
	totalSec := ms / 1000
	h := totalSec / 3600
	m := (totalSec % 3600) / 60
	s := totalSec % 60
	cs := (ms % 1000) / 10
	return fmt.Sprintf("%02d:%02d:%02d.%02d", h, m, s, cs)
}

func msToSRT(ms int) string {
	totalSec := ms / 1000
	h := totalSec / 3600
	m := (totalSec % 3600) / 60
	s := totalSec % 60
	cs := ms % 1000
	return fmt.Sprintf("%02d:%02d:%02d,%03d", h, m, s, cs)
}

func formatVTT(segs []transcript.Segment) string {
	var b strings.Builder
	b.WriteString("WEBVTT\nKind: captions\n\n")
	for _, s := range segs {
		end := s.StartMs + s.DurMs
		text := strings.ReplaceAll(s.Text, "\n", "\n")
		b.WriteString(fmt.Sprintf("%s --> %s\n%s\n\n", msToVTT(s.StartMs), msToVTT(end), text))
	}
	return b.String()
}

func formatSRT(segs []transcript.Segment) string {
	var b strings.Builder
	for i, s := range segs {
		end := s.StartMs + s.DurMs
		text := strings.ReplaceAll(s.Text, "\n", "\n")
		b.WriteString(fmt.Sprintf("%d\n%s --> %s\n%s\n\n", i+1, msToSRT(s.StartMs), msToSRT(end), text))
	}
	return b.String()
}

func formatTXT(segs []transcript.Segment) string {
	var b strings.Builder
	for _, s := range segs {
		text := strings.TrimSpace(s.Text)
		if text == "" {
			continue
		}
		b.WriteString(text)
		b.WriteByte('\n')
	}
	return strings.TrimRight(b.String(), "\n")
}

func writeTranscript(path string, result *transcript.Result, format string) error {
	var data string
	switch format {
	case "vtt":
		data = formatVTT(result.Segments)
	case "srt":
		data = formatSRT(result.Segments)
	case "txt":
		data = formatTXT(result.Segments)
	default:
		data = formatVTT(result.Segments)
	}
	return os.WriteFile(path, []byte(data), 0644)
}
