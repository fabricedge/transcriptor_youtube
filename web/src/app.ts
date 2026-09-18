import { Hono, type Context } from "hono"
import type { Database } from "bun:sqlite"
import { config, isFormat, langs, priceCents } from "./lib/config"
import * as db from "./lib/db"
import type { RateLimiter } from "./lib/ratelimit"
import { createRateLimiter } from "./lib/ratelimit"
import type { Order } from "./lib/types"
import type { ProcessResult } from "./lib/worker"
import { homePage, notFoundPage, orderPage } from "./views"
import { fetchPlaylistVideoIds, parseYoutubeUrl } from "./lib/youtube"
import { buildZip } from "./lib/zip"

export type WebhookEvent = {
  type: string
  data?: unknown
}

function completedSession(ev: WebhookEvent): { sessionId: string; paymentIntent: unknown } | null {
  if (ev.type !== "checkout.session.completed") return null
  const obj = ev.data && typeof ev.data === "object" ? (ev.data as { object?: unknown }).object : undefined
  if (!obj || typeof obj !== "object") return null
  const o = obj as { id?: unknown; payment_intent?: unknown }
  if (typeof o.id !== "string") return null
  return { sessionId: o.id, paymentIntent: o.payment_intent }
}

export type AppDeps = {
  db: Database
  createCheckout: (order: Order) => Promise<{ sessionId: string; url: string }>
  verifyWebhook: (body: string, signature: string) => Promise<WebhookEvent>
  fetchPaymentIntent: (sessionId: string) => Promise<string | null>
  refund: (paymentIntent: string) => Promise<void>
  processOrder: (order: Order) => Promise<ProcessResult>
  fetchPlaylistVideoIds?: typeof fetchPlaylistVideoIds
  rateLimiter?: RateLimiter
}

const contentType = (format: string): string => {
  switch (format) {
    case "txt":
      return "text/plain; charset=utf-8"
    case "vtt":
      return "text/vtt; charset=utf-8"
    case "srt":
      return "application/x-subrip"
    default:
      return "application/octet-stream"
  }
}

function clientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const env = c.env as { server?: { requestIP?: (r: Request) => { address?: string } } } | undefined
  return env?.server?.requestIP?.(c.req.raw)?.address ?? "unknown"
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.get("/", (c) => {
    return homePage({ cancelled: c.req.query("cancelled") === "1" })
  })

  app.post("/checkout", async (c) => {
    const limiter = deps.rateLimiter ?? createRateLimiter(config.requestLimitPerHour, 60 * 60 * 1000)
    if (!limiter.check(clientIp(c))) {
      return homePage({ error: "Muitas tentativas. Tente novamente mais tarde." })
    }

    const form = await c.req.parseBody()
    const url = String(form.url ?? "").trim()
    const lang = String(form.lang ?? "")
    const format = String(form.format ?? "txt")

    if (!isFormat(format)) return homePage({ error: "Formato inválido." })
    if (!langs.some((l) => l.code === lang)) return homePage({ error: "Idioma inválido." })

    const parsed = parseYoutubeUrl(url)
    if (!parsed.ok) return homePage({ error: parsed.reason })

    let kind: Order["kind"] = parsed.kind
    let sourceUrl = parsed.sourceUrl
    let count = 1
    if (parsed.kind === "playlist") {
      const r = await (deps.fetchPlaylistVideoIds ?? fetchPlaylistVideoIds)(parsed.playlistId)
      if (r.error) return homePage({ error: r.error })
      count = r.ids.length
    }

    const order: Order = db.createOrder(deps.db, {
      id: crypto.randomUUID(),
      amountCents: priceCents(count),
      currency: config.currency,
      kind,
      sourceUrl,
      lang,
      format,
      videoCount: count,
    })

    let session: { sessionId: string; url: string }
    try {
      session = await deps.createCheckout({ ...order })
    } catch (err) {
      db.setOrderStatus(deps.db, order.id, "failed", {
        error: err instanceof Error ? err.message : "falha ao iniciar pagamento",
      })
      return homePage({ error: "Não foi possível iniciar o pagamento. Verifique a configuração do Stripe e tente novamente." })
    }

    db.attachSession(deps.db, order.id, session.sessionId)
    return c.redirect(session.url, 303)
  })

  app.get("/orders/:id", (c) => {
    const order = db.getOrder(deps.db, c.req.param("id"))
    if (!order) return notFoundPage()
    const filenames =
      order.status === "ready" ? db.transcriptsForOrder(deps.db, order.id).map((t) => t.filename) : []
    return orderPage(order, filenames)
  })

  app.get("/orders/:id/status", (c) => {
    const order = db.getOrder(deps.db, c.req.param("id"))
    if (!order) return c.json({ status: "not_found" }, 404)
    return c.json({ status: order.status, error: order.error })
  })

  app.get("/orders/:id/download/all.zip", (c) => {
    const order = db.getOrder(deps.db, c.req.param("id"))
    if (!order || order.status !== "ready") return notFoundPage()
    const transcripts = db.transcriptsForOrder(deps.db, order.id)
    if (transcripts.length === 0) return notFoundPage()
    const bytes = buildZip(transcripts.map((t) => ({ name: t.filename, data: t.data })))
    return new Response(bytes, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${order.id}.zip"`,
      },
    })
  })

  app.get("/orders/:id/download/:file", (c) => {
    const order = db.getOrder(deps.db, c.req.param("id"))
    if (!order || order.status !== "ready") return notFoundPage()
    const name = c.req.param("file")
    const transcript = db.transcriptsForOrder(deps.db, order.id).find((t) => t.filename === name)
    if (!transcript) return notFoundPage()
    return new Response(transcript.data, {
      headers: {
        "content-type": contentType(order.format),
        "content-disposition": `attachment; filename="${transcript.filename}"`,
      },
    })
  })

  app.post("/webhook/stripe", async (c) => {
    const signature = c.req.header("stripe-signature")
    if (!signature) return c.text("missing signature", 400)
    const raw = await c.req.text()
    let event: WebhookEvent
    try {
      event = await deps.verifyWebhook(raw, signature)
    } catch {
      return c.text("invalid signature", 400)
    }
    if (event.type !== "checkout.session.completed") return c.body(null, 200)

    const completed = completedSession(event)
    if (!completed) return c.body(null, 200)
    const sessionId = completed.sessionId
    const order = db.getOrderBySession(deps.db, sessionId)
    if (!order || order.status === "paid" || order.status === "processing") return c.body(null, 200)

    let paymentIntent = typeof completed.paymentIntent === "string" ? completed.paymentIntent : null
    if (!paymentIntent) paymentIntent = await deps.fetchPaymentIntent(sessionId)
    db.markOrderPaid(deps.db, order.id, sessionId, paymentIntent ?? "")
    return c.body(null, 200)
  })

  return app
}