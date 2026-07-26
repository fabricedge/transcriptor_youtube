package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	log.SetFlags(0)

	var (
		lang    string
		outDir  string
		format  string
		cookies string
	)

	flag.StringVar(&lang, "lang", "en", "Subtitle language code")
	flag.StringVar(&outDir, "out", "transcripts", "Output directory")
	flag.StringVar(&format, "format", "vtt", "Output format (vtt, srt, txt)")
	flag.StringVar(&cookies, "cookies", "", "Path to cookies.txt file")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: yt-transcribe [flags] <url-or-id>\n\nAccepts a playlist URL, video URL, playlist ID, or video ID.\nIf the URL contains &, parts split by the shell are rejoined automatically.\n\nFlags:\n")
		flag.PrintDefaults()
	}
	flag.Parse()

	if flag.NArg() == 0 {
		flag.Usage()
		os.Exit(1)
	}

	args := flag.Args()
	arg := args[0]
	if len(args) > 1 && strings.HasPrefix(arg, "http") {
		arg = strings.Join(args, "&")
	}

	var videoIDs []string

	if playlistID, singleID := extractIDs(arg); playlistID != "" {
		fmt.Printf("Fetching playlist %s ...\n", playlistID)
		var err error
		videoIDs, err = fetchPlaylist(playlistID)
		if err != nil {
			log.Fatalf("Failed to fetch playlist: %v", err)
		}
	} else if singleID != "" {
		videoIDs = []string{singleID}
	} else {
		log.Fatalf("Could not extract video or playlist ID from: %s", arg)
	}

	if err := os.MkdirAll(outDir, 0755); err != nil {
		log.Fatalf("Failed to create output directory: %v", err)
	}

	if len(videoIDs) == 0 {
		fmt.Println("No videos found in playlist.")
		return
	}

	fmt.Printf("Found %d video(s)\n", len(videoIDs))
	fmt.Printf("Output:   %s/\n", outDir)
	fmt.Printf("Language: %s\n", lang)
	fmt.Printf("Format:   %s\n", format)
	fmt.Println("")

	var httpClient = newHTTPClient(cookies)

	count, failed := 0, 0
	for _, id := range videoIDs {
		count++
		fmt.Printf("[%d/%d] %s ... ", count, len(videoIDs), id)

		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		result, err := fetchTranscript(ctx, httpClient, id, lang)
		cancel()

		if err != nil {
			failed++
			fmt.Printf("FAILED (%v)\n", err)
			continue
		}

		ext := "." + format
		if format == "txt" {
			ext = ".txt"
		}
		path := filepath.Join(outDir, id+ext)
		if err := writeTranscript(path, result, format); err != nil {
			failed++
			fmt.Printf("FAILED writing (%v)\n", err)
			continue
		}
		fmt.Println("OK")
	}

	fmt.Printf("\nDone — %d processed, %d failed\n", count, failed)
	fmt.Printf("Transcripts saved in: %s/\n", outDir)
}

func extractIDs(s string) (playlistID, videoID string) {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "http") {
		if len(s) == 11 {
			return "", s
		}
		return s, ""
	}

	for _, prefix := range []string{"list=", "?list=", "&list="} {
		i := strings.Index(s, prefix)
		if i >= 0 {
			id := s[i+len(prefix):]
			if amp := strings.IndexByte(id, '&'); amp >= 0 {
				id = id[:amp]
			}
			return id, ""
		}
	}

	for _, prefix := range []string{"v=", "?v=", "&v="} {
		i := strings.Index(s, prefix)
		if i >= 0 {
			id := s[i+len(prefix):]
			if amp := strings.IndexByte(id, '&'); amp >= 0 {
				id = id[:amp]
			}
			return "", id
		}
	}

	return "", ""
}
