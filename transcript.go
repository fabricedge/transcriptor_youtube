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
