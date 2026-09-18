import { describe, expect, test } from "bun:test"
import { openDb, createOrder, getCache, transcriptsForOrder, addTranscript, setCache } from "../src/lib/db"
import type { Database } from "bun:sqlite"
import type { Order } from "../src/lib/types"
import { extractIdFromUrl, resolveOrderUrls, runGoTranscribe, transcribeOrder } from "../src/lib/transcriber"

const STUB = import.meta.dir + "/stubs/fake-transcribe.sh"
const HANG = import.meta.dir + "/stubs/hang.mjs"

function mkOrder(db: Database, overrides: Partial<Order> = {}): Order {
  return createOrder(db, {
    id: "ord",
    amountCents: 50,
    currency: "usd",
    kind: "video",
    sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    lang: "en",
    format: "txt",
    videoCount: 1,
    ...overrides,
  })
}

describe("runGoTranscribe", () => {
  test("happy path writes and returns the file", async () => {
    const res = await runGoTranscribe(STUB, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "en", "txt")
    expect(res.ok).toBe(true)
    if (res.ok) {
      const text = new TextDecoder().decode(res.data)
      expect(text).toContain("stub transcript")
      expect(text).toContain("dQw4w9WgXcQ")
    }
  })

  test("failed subprocess returns stderr", async () => {
    const res = await runGoTranscribe(STUB, "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "en", "txt", {
      env: { ...Bun.env, FAKE_TRANSCRIBE_FAIL: "1" },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain("no captions")
  })

  test("timeout kills the subprocess", async () => {
    const res = await runGoTranscribe([process.execPath, HANG], "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "en", "txt", {
      timeoutMs: 200,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain("timeout")
  })
})

describe("extractIdFromUrl", () => {
  test("extracts video id", () => {
    expect(extractIdFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
  })
})

describe("resolveOrderUrls", () => {
  test("video order returns single url", async () => {
    const db = openDb(":memory:")
    const order = mkOrder(db)
    const r = await resolveOrderUrls(order)
    expect(r.urls).toHaveLength(1)
    expect(r.urls[0].videoId).toBe("dQw4w9WgXcQ")
  })

  test("playlist order uses RSS feed and caps at paid count", async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(`<?xml version="1.0"?><feed><entry><yt:videoId>aaaaaaaaaaa</yt:videoId></entry><entry><yt:videoId>bbbbbbbbbbb</yt:videoId></entry><entry><yt:videoId>ccccccccccc</yt:videoId></entry></feed>`)) as unknown as typeof fetch
    try {
      const db = openDb(":memory:")
      const order = mkOrder(db, { kind: "playlist", sourceUrl: "https://www.youtube.com/playlist?list=PLxxxxxxxy", videoCount: 2 })
      const r = await resolveOrderUrls(order)
      expect(r.error).toBeUndefined()
      expect(r.urls.map((u) => u.videoId)).toEqual(["aaaaaaaaaaa", "bbbbbbbbbbb"])
    } finally {
      globalThis.fetch = realFetch
    }
  })
})

describe("transcribeOrder", () => {
  test("video order produces a transcript row and uses cache on rerun", async () => {
    const db = openDb(":memory:")
    const order = mkOrder(db)
    const first = await transcribeOrder(db, order, STUB)
    expect(first).toEqual({ ok: true, count: 1 })
    const rows = transcriptsForOrder(db, order.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].filename).toBe("dQw4w9WgXcQ.txt")
    expect(new TextDecoder().decode(rows[0].data)).toContain("stub transcript")
    expect(getCache(db, "dQw4w9WgXcQ", "en", "txt")).not.toBeNull()

    const second = await transcribeOrder(db, order, "/bin/false")
    expect(second.ok).toBe(true)
  })

  test("failure marks nothing and returns error", async () => {
    const db = openDb(":memory:")
    const order = mkOrder(db)
    const res = await transcribeOrder(db, order, STUB, { env: { ...Bun.env, FAKE_TRANSCRIBE_FAIL: "1" } })
    expect(res.ok).toBe(false)
    expect(transcriptsForOrder(db, order.id)).toHaveLength(0)
  })

  test("cached transcripts do not call the subprocess", async () => {
    const db = openDb(":memory:")
    const order = mkOrder(db)
    addTranscript(db, { id: "t", orderId: order.id, videoId: "dQw4w9WgXcQ", filename: "dQw4w9WgXcQ.txt", data: new TextEncoder().encode("pre") })
    setCache(db, "dQw4w9WgXcQ", "en", "txt", new TextEncoder().encode("pre"))
    const res = await transcribeOrder(db, order, "/bin/false")
    expect(res.ok).toBe(true)
  })
})