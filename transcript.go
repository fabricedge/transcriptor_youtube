package main

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/rapha30/yt-youtube-transcript/transcript"
)

const timeout = 30 * time.Second

func newHTTPClient(cookieFile string) *http.Client {
	return &http.Client{Timeout: timeout}
}

func fetchTranscript(ctx context.Context, client *http.Client, videoID, lang string) (*transcript.Result, error) {
	opts := transcript.Options{
		Lang:   lang,
		Client: client,
	}

	result, err := transcript.Fetch(ctx, videoID, opts)
	if err != nil {
		return nil, fmt.Errorf("fetch transcript: %w", err)
	}

	if len(result.Segments) == 0 {
		return nil, fmt.Errorf("no segments in transcript")
	}

	return result, nil
}
