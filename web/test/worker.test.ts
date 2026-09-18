import { describe, expect, test } from "bun:test"
import { createOrder, getOrder, listOrdersByStatus, markOrderPaid, openDb, setOrderStatus } from "../src/lib/db"
import { recoverStuckOrders, tick } from "../src/lib/worker"
import type { Order } from "../src/lib/types"

const base = { amountCents: 50, currency: "usd", kind: "video" as const, sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", lang: "en", format: "txt" as const, videoCount: 1 }

function paidOrder(db: ReturnType<typeof openDb>, id: string): Order {
  createOrder(db, { id, ...base })
  markOrderPaid(db, id, `cs_${id}`, `pi_${id}`)
  const o = getOrder(db, id)
  if (!o) throw new Error("order missing")
  return o
}

describe("worker", () => {
  test("recoverStuckOrders resets processing back to paid", () => {
    const db = openDb(":memory:")
    paidOrder(db, "a")
    setOrderStatus(db, "a", "processing")
    expect(recoverStuckOrders(db)).toBe(1)
    expect(getOrder(db, "a")?.status).toBe("paid")
  })

  test("tick marks paid orders ready on success", async () => {
    const db = openDb(":memory:")
    paidOrder(db, "a")
    await tick({
      db,
      processOrder: async () => ({ ok: true, count: 1 }),
      refund: async () => {},
    })
    expect(getOrder(db, "a")?.status).toBe("ready")
  })

  test("tick marks failed and refunds", async () => {
    const db = openDb(":memory:")
    paidOrder(db, "a")
    const refunded: string[] = []
    await tick({
      db,
      processOrder: async () => ({ ok: false, error: "no captions" }),
      refund: async (pi) => {
        refunded.push(pi)
      },
    })
    const o = getOrder(db, "a")
    expect(o?.status).toBe("failed")
    expect(o?.error).toBe("no captions")
    expect(refunded).toEqual(["pi_a"])
  })

  test("tick does not refund when no payment intent present", async () => {
    const db = openDb(":memory:")
    createOrder(db, { id: "b", ...base })
    setOrderStatus(db, "b", "paid")
    await tick({
      db,
      processOrder: async () => ({ ok: false, error: "x" }),
      refund: async () => {
        throw new Error("should not be called")
      },
    })
    expect(getOrder(db, "b")?.status).toBe("failed")
  })

  test("tick leaves non-paid orders alone", async () => {
    const db = openDb(":memory:")
    createOrder(db, { id: "c", ...base })
    await tick({ db, processOrder: async () => ({ ok: true, count: 1 }), refund: async () => {} })
    expect(getOrder(db, "c")?.status).toBe("pending")
    expect(listOrdersByStatus(db, "ready")).toEqual([])
  })
})