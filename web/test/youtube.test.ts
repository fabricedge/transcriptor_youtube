import { describe, expect, test } from "bun:test"
import { extractVideoIdsFromRss, parseYoutubeUrl } from "../src/lib/youtube"

describe("parseYoutubeUrl", () => {
  test("accepts watch?v= URL", () => {
    const r = parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    expect(r).toEqual({ ok: true, kind: "video", videoId: "dQw4w9WgXcQ", sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })
  })

  test("accepts youtu.be short URL", () => {
    const r = parseYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")
    expect(r).toEqual({ ok: true, kind: "video", videoId: "dQw4w9WgXcQ", sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })
  })

  test("accepts playlist URL", () => {
    const r = parseYoutubeUrl("https://www.youtube.com/playlist?list=PLabc1234567890xyz")
    expect(r).toEqual({
      ok: true,
      kind: "playlist",
      playlistId: "PLabc1234567890xyz",
      sourceUrl: "https://www.youtube.com/playlist?list=PLabc1234567890xyz",
    })
  })

  test("accepts bare video ID", () => {
    const r = parseYoutubeUrl("dQw4w9WgXcQ")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.kind).toBe("video")
    if (r.kind === "video") expect(r.videoId).toBe("dQw4w9WgXcQ")
  })

  test("accepts bare playlist ID", () => {
    const r = parseYoutubeUrl("PLabc1234567890xyz")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.kind).toBe("playlist")
    if (r.kind === "playlist") expect(r.playlistId).toBe("PLabc1234567890xyz")
  })

  test("rejects non-youtube domain", () => {
    const r = parseYoutubeUrl("https://vimeo.com/watch?v=dQw4w9WgXcQ")
    expect(r.ok).toBe(false)
  })

  test("rejects invalid bare string", () => {
    const r = parseYoutubeUrl("not-an-id")
    expect(r.ok).toBe(false)
  })

  test("rejects video with bad id", () => {
    const r = parseYoutubeUrl("https://www.youtube.com/watch?v=short")
    expect(r.ok).toBe(false)
  })

  test("empty input rejected", () => {
    expect(parseYoutubeUrl("   ").ok).toBe(false)
  })
})

describe("extractVideoIdsFromRss", () => {
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
  <entry>
    <yt:videoId>dQw4w9WgXcQ</yt:videoId>
  </entry>
  <entry>
    <yt:videoId>aaaaaaaaaaa</yt:videoId>
  </entry>
</feed>`

  test("extracts valid video ids", () => {
    expect(extractVideoIdsFromRss(xml)).toEqual(["dQw4w9WgXcQ", "aaaaaaaaaaa"])
  })

  test("skips invalid ids", () => {
    const bad = xml.replace("<yt:videoId>aaaaaaaaaaa</yt:videoId>", "<yt:videoId>too-short</yt:videoId>")
    expect(extractVideoIdsFromRss(bad)).toEqual(["dQw4w9WgXcQ"])
  })

  test("empty xml yields empty list", () => {
    expect(extractVideoIdsFromRss("")).toEqual([])
  })
})