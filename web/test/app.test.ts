import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { createApp, type AppDeps, type WebhookEvent } from "../src/app"
import { config } from "../src/lib/config"
import { openDb } from "../src/lib/db"
import type { Order } from "../src/lib/types"
import { createRateLimiter } from "../src/lib/ratelimit"

const VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

function mkDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const db = openDb(":memory:")
  return {
    db,
    createCheckout: async () => ({ sessionId: "cs_123", url: "https://checkout.stripe.test/pay" }),
    verifyWebhook: async () => ({ type: "ignored" }),
    fetchPaymentIntent: async () => "pi_123",
    refund: async () => {},
    processOrder: async () => ({ ok: true, count: 1 }),
    ...overrides,
  }
}

async function checkout(app: ReturnType<typeof createApp>, url = VIDEO_URL, lang = "en", format = "txt") {
  return app.request("/checkout", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url, lang, format }).toString(),
    redirect: "manual",
  })
}

describe("app", () => {
  test("GET / renders the home form", async () => {
    const app = createApp(mkDeps())
    const res = await app.request("/")
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("action=\"/checkout\"")
  })

  test("checkout redirects to the Stripe URL", async () => {
    const holder: { order: Order | null } = { order: null }
    const app = createApp(
      mkDeps({
        createCheckout: async (order) => {
          holder.order = order
          return { sessionId: "cs_x", url: "https://pay.test/s" }
        },
      }),
    )
    const res = await checkout(app)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("https://pay.test/s")
    expect(holder.order?.kind).toBe("video")
    expect(holder.order?.videoCount).toBe(1)
  })

  test("playlist checkout counts videos and computes price", async () => {
    const holder: { order: Order | null } = { order: null }
    const app = createApp(
      mkDeps({
        createCheckout: async (order) => {
          holder.order = order
          return { sessionId: "cs_pl", url: "https://pay.test/s" }
        },
        fetchPlaylistVideoIds: async () => ({ ids: ["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc"] }),
      }),
    )
    const res = await checkout(app, "https://www.youtube.com/playlist?list=PLxxxxxxxxxy")
    expect(res.status).toBe(303)
    expect(holder.order?.kind).toBe("playlist")
    expect(holder.order?.videoCount).toBe(3)
    expect(holder.order?.amountCents).toBe(Math.round(config.pricePerVideoUsd * 3 * 100))
  })

  test("invalid URL returns error page", async () => {
    const app = createApp(mkDeps())
    const res = await checkout(app, "https://vimeo.com/watch?v=xxxx")
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("error")
  })

  test("invalid format is rejected", async () => {
    const app = createApp(mkDeps())
    const res = await checkout(app, VIDEO_URL, "en", "exe")
    expect(await res.text()).toContain("Formato inválido")
  })

  test("rate limiter blocks repeated submissions", async () => {
    let called = 0
    const app = createApp(
      mkDeps({
        rateLimiter: createRateLimiter(2, 1000),
        createCheckout: async (order) => {
          called++
          return { sessionId: "cs_r", url: "https://pay.test" }
        },
      }),
    )
    await checkout(app)
    await checkout(app)
    const res = await checkout(app)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("Muitas tentativas")
    expect(called).toBe(2)
  })

  test("order page shows processing then ready/downloads", async () => {
    const deps = mkDeps()
    const app = createApp(deps)
    await checkout(app)
    const order = deps.db.query("SELECT id FROM orders").get() as { id: string }
    let res = await app.request(`/orders/${order.id}`)
    expect(await res.text()).toContain("Processando")

    deps.db.query("UPDATE orders SET status = 'ready' WHERE id = ?").run(order.id)
    deps.db.query("INSERT INTO transcripts (id, order_id, video_id, filename, data, created_at) VALUES ('t', ?, 'dQw4w9WgXcQ', 'dQw4w9WgXcQ.txt', ?, 'now')").run(order.id, new TextEncoder().encode("hello transcricao"))
    res = await app.request(`/orders/${order.id}`)
    const html = await res.text()
    expect(html).toContain("dQw4w9WgXcQ.txt")
    expect(html).toContain("all.zip")
  })

  test("download routes are closed for non-ready orders", async () => {
    const deps = mkDeps()
    const app = createApp(deps)
    await checkout(app)
    const order = deps.db.query("SELECT id FROM orders").get() as { id: string }
    expect((await app.request(`/orders/${order.id}/download/all.zip`)).status).toBe(404)
    expect((await app.request(`/orders/${order.id}/download/x.txt`)).status).toBe(404)
  })

  test("single file and zip download work when ready", async () => {
    const deps = mkDeps()
    const app = createApp(deps)
    await checkout(app)
    const order = deps.db.query("SELECT id FROM orders").get() as { id: string }
    deps.db.query("UPDATE orders SET status = 'ready' WHERE id = ?").run(order.id)
    deps.db.query("INSERT INTO transcripts (id, order_id, video_id, filename, data, created_at) VALUES ('t', ?, 'dQw4w9WgXcQ', 'dQw4w9WgXcQ.txt', ?, 'now')").run(order.id, new TextEncoder().encode("olá"))
    const file = await app.request(`/orders/${order.id}/download/dQw4w9WgXcQ.txt`)
    expect(file.status).toBe(200)
    expect(await file.text()).toBe("olá")
    const zip = await app.request(`/orders/${order.id}/download/all.zip`)
    expect(zip.status).toBe(200)
    expect(zip.headers.get("content-type")).toBe("application/zip")
  })

  test("filenames outside the order are not served", async () => {
    const deps = mkDeps()
    const app = createApp(deps)
    await checkout(app)
    const order = deps.db.query("SELECT id FROM orders").get() as { id: string }
    deps.db.query("UPDATE orders SET status = 'ready' WHERE id = ?").run(order.id)
    deps.db.query("INSERT INTO transcripts (id, order_id, video_id, filename, data, created_at) VALUES ('t', ?, 'dQw4w9WgXcQ', 'dQw4w9WgXcQ.txt', ?, 'now')").run(order.id, new TextEncoder().encode("olá"))
    expect((await app.request(`/orders/${order.id}/download/..%2F..%2Fetc/passwd`)).status).toBe(404)
    expect((await app.request(`/orders/${order.id}/download/other.txt`)).status).toBe(404)
  })

  test("webhook marks a pending order paid", async () => {
    const deps = mkDeps({ createCheckout: async () => ({ sessionId: "cs_wh", url: "https://pay.test" }) })
    const app = createApp(deps)
    await checkout(app)

    const ev: WebhookEvent = {
      type: "checkout.session.completed",
      data: { object: { id: "cs_wh", payment_intent: "pi_wh" } },
    }
    let received = ""
    const deps2 = { ...deps, verifyWebhook: async (_b: string, sig: string) => {
      received = sig
      return ev
    } }
    const app2 = createApp(deps2)
    const res = await app2.request("/webhook/stripe", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "sig1" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
    expect(received).toBe("sig1")
    const order = deps.db.query("SELECT * FROM orders").get() as { status: string; payment_intent: string }
    expect(order.status).toBe("paid")
    expect(order.payment_intent).toBe("pi_wh")
  })

  test("webhook with invalid signature returns 400", async () => {
    const deps = mkDeps({ verifyWebhook: async () => {
      throw new Error("bad signature")
    } })
    const app = createApp(deps)
    const res = await app.request("/webhook/stripe", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": "nope" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  test("unknown webhook events are acknowledged", async () => {
    const deps = mkDeps()
    const app = createApp(deps)
    const res = await app.request("/webhook/stripe", {
      method: "POST",
      headers: { "stripe-signature": "x" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(200)
  })
})