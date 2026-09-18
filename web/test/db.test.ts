import { describe, expect, test } from "bun:test"
import {
  addTranscript,
  createOrder,
  getCache,
  getOrder,
  getOrderBySession,
  listOrdersByStatus,
  markOrderPaid,
  migrate,
  openDb,
  setCache,
  setOrderStatus,
  transcriptsForOrder,
} from "../src/lib/db"

const mkDb = () => {
  const db = openDb(":memory:")
  return { db }
}

describe("db", () => {
  test("createOrder persists and getOrder returns it", () => {
    const { db } = mkDb()
    const o = createOrder(db, {
      id: "ord-1",
      amountCents: 50,
      currency: "usd",
      kind: "video",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      lang: "en",
      format: "txt",
      videoCount: 1,
    })
    expect(o.status).toBe("pending")
    const got = getOrder(db, "ord-1")
    expect(got?.kind).toBe("video")
    expect(got?.amountCents).toBe(50)
    expect(getOrder(db, "nope")).toBeNull()
  })

  test("markOrderPaid and setOrderStatus", () => {
    const { db } = mkDb()
    createOrder(db, { id: "ord-2", amountCents: 100, currency: "usd", kind: "playlist", sourceUrl: "u", lang: "en", format: "vtt", videoCount: 2 })
    markOrderPaid(db, "ord-2", "cs_test_123", "pi_test_456")
    const paid = getOrder(db, "ord-2")
    expect(paid?.status).toBe("paid")
    expect(paid?.stripeSessionId).toBe("cs_test_123")
    expect(getOrderBySession(db, "cs_test_123")?.id).toBe("ord-2")

    setOrderStatus(db, "ord-2", "failed", { error: "no captions" })
    const failed = getOrder(db, "ord-2")
    expect(failed?.status).toBe("failed")
    expect(failed?.error).toBe("no captions")
  })

  test("listOrdersByStatus filters", () => {
    const { db } = mkDb()
    createOrder(db, { id: "a", amountCents: 50, currency: "usd", kind: "video", sourceUrl: "u", lang: "en", format: "txt", videoCount: 1 })
    createOrder(db, { id: "b", amountCents: 50, currency: "usd", kind: "video", sourceUrl: "u", lang: "en", format: "txt", videoCount: 1 })
    markOrderPaid(db, "b", "cs_b", "pi_b")
    expect(listOrdersByStatus(db, "pending").map((o) => o.id)).toEqual(["a"])
    expect(listOrdersByStatus(db, "paid").map((o) => o.id)).toEqual(["b"])
  })

  test("transcripts round-trip", () => {
    const { db } = mkDb()
    createOrder(db, { id: "ord", amountCents: 50, currency: "usd", kind: "video", sourceUrl: "u", lang: "en", format: "txt", videoCount: 1 })
    addTranscript(db, { id: "t1", orderId: "ord", videoId: "dQw4w9WgXcQ", filename: "dQw4w9WgXcQ.txt", data: new TextEncoder().encode("hello") })
    const list = transcriptsForOrder(db, "ord")
    expect(list).toHaveLength(1)
    expect(list[0].filename).toBe("dQw4w9WgXcQ.txt")
    expect(new TextDecoder().decode(list[0].data)).toBe("hello")
  })

  test("transcript cache get/set/update", () => {
    const { db } = mkDb()
    expect(getCache(db, "vid1", "en", "txt")).toBeNull()
    setCache(db, "vid1", "en", "txt", new TextEncoder().encode("v1"))
    expect(new TextDecoder().decode(getCache(db, "vid1", "en", "txt")!)).toBe("v1")
    setCache(db, "vid1", "en", "txt", new TextEncoder().encode("v2"))
    expect(new TextDecoder().decode(getCache(db, "vid1", "en", "txt")!)).toBe("v2")
  })

  test("schema is idempotent", () => {
    const { db } = mkDb()
    migrate(db)
    migrate(db)
    expect(listOrdersByStatus(db, "pending")).toEqual([])
  })
})