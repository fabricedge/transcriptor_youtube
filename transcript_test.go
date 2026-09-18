package main

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/rapha30/yt-youtube-transcript/transcript"
)

type fakeTransport struct {
	fn func(*http.Request) (*http.Response, error)
}

func (f fakeTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f.fn(r) }

func httpResp(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

func clientWith(fn func(*http.Request) (*http.Response, error)) *http.Client {
	return &http.Client{Transport: fakeTransport{fn: fn}}
}

func playerWith(tracks string) string {
	return `{"playabilityStatus":{"status":"OK"},` +
		`"videoDetails":{"title":"T","videoId":"abc12345678","author":"chan","lengthSeconds":"100"},` +
		`"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[` + tracks + `]}}}`
}

const json3Body = `{"events":[` +
	`{"tStartMs":0,"dDurationMs":1000,"segs":[{"utf8":"olá"}]},` +
	`{"tStartMs":1000,"dDurationMs":1000,"segs":[{"utf8":"mundo"}]}]}`

func isPlayer(r *http.Request) bool {
	return r.Method == http.MethodPost && r.URL.Path == "/youtubei/v1/player"
}

func TestFetchTranscriptFallsBackToBaseLanguage(t *testing.T) {
	const player = `{"baseUrl":"https://cc.test/cap?fmt=srv3",` +
		`"name":{"simpleText":"Portuguese (auto-generated)"},` +
		`"languageCode":"pt","kind":"asr","isTranslatable":true}`

	captionsHits := 0
	client := clientWith(func(r *http.Request) (*http.Response, error) {
		switch {
		case isPlayer(r):
			return httpResp(200, playerWith(player)), nil
		case r.URL.Host == "cc.test":
			captionsHits++
			return httpResp(200, json3Body), nil
		}
		return httpResp(404, ""), nil
	})

	res, err := fetchTranscript(context.Background(), client, "abc12345678", "pt-BR")
	if err != nil {
		t.Fatalf("fetchTranscript error: %v", err)
	}
	if res.Lang != "pt" || res.Track.LanguageCode != "pt" {
		t.Errorf("lang = %q / track = %q; want pt fallback", res.Lang, res.Track.LanguageCode)
	}
	if res.Text() != "olá mundo" {
		t.Errorf("text = %q; want %q", res.Text(), "olá mundo")
	}
	if captionsHits != 1 {
		t.Errorf("captions fetched %d times; want 1", captionsHits)
	}
}

func TestFetchTranscriptPrefersExactLanguage(t *testing.T) {
	const tracks = `{"baseUrl":"https://cc.test/pt?fmt=srv3",` +
		`"name":{"simpleText":"Portuguese (auto-generated)"},` +
		`"languageCode":"pt","kind":"asr","isTranslatable":true},` +
		`{"baseUrl":"https://cc.test/ptbr?fmt=srv3",` +
		`"name":{"simpleText":"Portuguese (Brazil)"},` +
		`"languageCode":"pt-BR","kind":"","isTranslatable":true}`

	client := clientWith(func(r *http.Request) (*http.Response, error) {
		switch {
		case isPlayer(r):
			return httpResp(200, playerWith(tracks)), nil
		case r.URL.Host == "cc.test":
			return httpResp(200, json3Body), nil
		}
		return httpResp(404, ""), nil
	})

	res, err := fetchTranscript(context.Background(), client, "abc12345678", "pt-BR")
	if err != nil {
		t.Fatalf("fetchTranscript error: %v", err)
	}
	if res.Lang != "pt-BR" || res.Track.LanguageCode != "pt-BR" {
		t.Errorf("lang = %q / track = %q; want exact pt-BR", res.Lang, res.Track.LanguageCode)
	}
}

func TestAutoLangPrefersAsrTrack(t *testing.T) {
	cases := []struct {
		name   string
		tracks []transcript.Track
		want   string
	}{
		{
			name: "asr wins over manual",
			tracks: []transcript.Track{
				{LanguageCode: "en", Kind: ""},
				{LanguageCode: "pt", Kind: "asr"},
			},
			want: "pt",
		},
		{
			name: "first manual when no asr",
			tracks: []transcript.Track{
				{LanguageCode: "pt-BR", Kind: ""},
				{LanguageCode: "en", Kind: ""},
			},
			want: "pt-BR",
		},
		{name: "empty when no tracks", want: ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := autoLang(tc.tracks); got != tc.want {
				t.Errorf("autoLang() = %q; want %q", got, tc.want)
			}
		})
	}
}

func TestFetchTranscriptAutoSelectsOriginalLanguage(t *testing.T) {
	const tracks = `{"baseUrl":"https://cc.test/en?fmt=srv3",` +
		`"name":{"simpleText":"English"},` +
		`"languageCode":"en","kind":"","isTranslatable":true},` +
		`{"baseUrl":"https://cc.test/pt?fmt=srv3",` +
		`"name":{"simpleText":"Portuguese (auto-generated)"},` +
		`"languageCode":"pt","kind":"asr","isTranslatable":true}`

	client := clientWith(func(r *http.Request) (*http.Response, error) {
		switch {
		case isPlayer(r):
			return httpResp(200, playerWith(tracks)), nil
		case r.URL.Host == "cc.test":
			return httpResp(200, json3Body), nil
		}
		return httpResp(404, ""), nil
	})

	res, err := fetchTranscript(context.Background(), client, "abc12345678", "")
	if err != nil {
		t.Fatalf("fetchTranscript error: %v", err)
	}
	if res.Lang != "pt" || res.Track.LanguageCode != "pt" {
		t.Errorf("lang = %q / track = %q; want auto pt", res.Lang, res.Track.LanguageCode)
	}
}
