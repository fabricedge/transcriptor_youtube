import Stripe from "stripe"
import { config } from "./config"
import type { Order } from "./types"

let _stripe: Stripe | null = null

export function stripeClient(): Stripe {
  if (!_stripe) {
    if (!config.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY não configurada")
    _stripe = new Stripe(config.stripeSecretKey)
  }
  return _stripe
}

export async function createCheckoutSession(o: {
  order: Order
}): Promise<{ sessionId: string; url: string }> {
  const { order } = o
  const stripe = stripeClient()
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    metadata: { order_id: order.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: config.currency,
          unit_amount: order.amountCents,
          product_data: {
            name:
              order.kind === "playlist"
                ? `Transcrição de playlist (${order.videoCount} vídeos)`
                : "Transcrição de vídeo do YouTube",
            description: order.lang === "" ? "Idioma original (auto-detectado)" : order.lang === "en" ? "English (auto-generated)" : order.lang,
          },
        },
      },
    ],
    success_url: `${config.appUrl}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appUrl}/?cancelled=1`,
  })
  const sessionId = session.id
  const url = session.url
  if (!sessionId || !url) throw new Error("Stripe não retornou uma session válida")
  return { sessionId, url }
}

export async function verifyWebhook(body: string, signatureHeader: string): Promise<Stripe.Event> {
  if (!config.stripeWebhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET não configurada")
  return stripeClient().webhooks.constructEventAsync(body, signatureHeader, config.stripeWebhookSecret)
}

export function isCheckoutCompleted(event: Stripe.Event): boolean {
  return event.type === "checkout.session.completed"
}

export async function refundPaymentIntent(paymentIntent: string): Promise<void> {
  await stripeClient().refunds.create({ payment_intent: paymentIntent })
}

export async function fetchPaymentIntent(sessionId: string): Promise<string | null> {
  const session = await stripeClient().checkout.sessions.retrieve(sessionId)
  if (session.mode !== "payment") return null
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null
}