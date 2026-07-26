package main

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"time"
)

const playlistFeedURL = "https://www.youtube.com/feeds/videos.xml?playlist_id=%s"

type feed struct {
	Entries []entry `xml:"entry"`
}

type entry struct {
	VideoID string `xml:"http://www.youtube.com/xml/schemas/2015 videoId"`
}

func fetchPlaylist(playlistID string) ([]string, error) {
	url := fmt.Sprintf(playlistFeedURL, playlistID)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch feed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("feed returned status %d", resp.StatusCode)
	}

	var f feed
	if err := xml.NewDecoder(resp.Body).Decode(&f); err != nil {
		return nil, fmt.Errorf("parse feed: %w", err)
	}

	ids := make([]string, 0, len(f.Entries))
	for _, e := range f.Entries {
		if e.VideoID != "" {
			ids = append(ids, e.VideoID)
		}
	}
	return ids, nil
}
