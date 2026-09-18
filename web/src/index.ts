import { createApp } from "./app"
import { config } from "./lib/config"
import { openDb } from "./lib/db"
import { fetchPaymentIntent, refundPaymentIntent, createCheckoutSession, verifyWebhook } from "./lib/stripe"
import { transcribeOrder } from "./lib/transcriber"
import { startWorker } from "./lib/worker"

const db = openDb()

const app = createApp({
  db,
  createCheckout: async (order) => createCheckoutSession({ order }),
  verifyWebhook,
  fetchPaymentIntent,
  refund: refundPaymentIntent,
  processOrder: (order) => transcribeOrder(db, order),
})

const processOrder = (order: Parameters<typeof transcribeOrder>[1]) => transcribeOrder(db, order)
startWorker({
  db,
  processOrder,
  refund: refundPaymentIntent,
  onCycleError: (err) => console.error("[worker]", err),
})

const server = Bun.serve({
  port: config.port,
  fetch(req, server) {
    return app.fetch(req, server)
  },
})

console.log(`yt-transcribe service on ${server.url}`)