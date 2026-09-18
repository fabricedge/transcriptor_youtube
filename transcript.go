package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/rapha30/yt-youtube-transcript/transcript"
)

const timeout = 30 * time.Second

func newHTTPClient(cookieFile string) *http.Client {
	return &http.Client{Timeout: timeout}
}

func fetchTranscript(ctx context.Context, client *http.Client, videoID, lang string) (*transcript.Result, error) {
	if lang == "" {
		return fetchTranscriptAuto(ctx, client, videoID)
	}
	result, err := transcript.Fetch(ctx, videoID, transcript.Options{Lang: lang, Client: client})
	if err != nil {
		if base := baseLang(lang); base != lang {
			retry, retryErr := transcript.Fetch(ctx, videoID, transcript.Options{Lang: base, Client: client})
			if retryErr == nil {
				result, err = retry, nil
			}
		}
		if err != nil {
			return nil, fmt.Errorf("fetch transcript: %w", err)
		}
	}

	if len(result.Segments) == 0 {
		return nil, fmt.Errorf("no segments in transcript")
	}

	return result, nil
}

func baseLang(lang string) string {
	if i := strings.IndexByte(lang, '-'); i >= 0 {
		return lang[:i]
	}
	return lang
}

// autoLang picks the original spoken language: the first auto-generated (asr)
// track when present, otherwise the first available track.
func autoLang(tracks []transcript.Track) string {
	for _, t := range tracks {
		if t.IsAuto() {
			return t.LanguageCode
		}
	}
	if len(tracks) > 0 {
		return tracks[0].LanguageCode
	}
	return ""
}

// fetchTranscriptAuto lists the available caption tracks and downloads the one
// matching the video's original language.
func fetchTranscriptAuto(ctx context.Context, client *http.Client, videoID string) (*transcript.Result, error) {
	_, tracks, _, err := transcript.ListTracks(ctx, videoID, transcript.Options{Client: client})
	if err != nil {
		return nil, fmt.Errorf("list tracks: %w", err)
	}
	lang := autoLang(tracks)
	if lang == "" {
		return nil, fmt.Errorf("no caption tracks available")
	}
	result, err := transcript.Fetch(ctx, videoID, transcript.Options{Lang: lang, Client: client})
	if err != nil {
		return nil, fmt.Errorf("fetch transcript: %w", err)
	}
	if len(result.Segments) == 0 {
		return nil, fmt.Errorf("no segments in transcript")
	}
	return result, nil
}
