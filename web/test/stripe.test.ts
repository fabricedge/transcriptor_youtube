import { describe, expect, test } from "bun:test"
import { config } from "../src/lib/config"
import { isCheckoutCompleted, verifyWebhook } from "../src/lib/stripe"

const secret = "whsec_test_secret_123"

function setTestEnv() {
  config.stripeSecretKey = "sk_test_fake"
  config.stripeWebhookSecret = secret
}

function sign(payload: string, s: string = secret): string {
  const t = Math.floor(Date.now() / 1000).toString()
  const hasher = new Bun.CryptoHasher("sha256", s)
  hasher.update(`${t}.${payload}`)
  return `t=${t},v1=${hasher.digest("hex")}`
}

function completedEvent(payload: Record<string, unknown>): { body: string; header: string } {
  const body = JSON.stringify({
    id: "evt_test",
    object: "event",
    type: "checkout.session.completed",
    data: { object: payload },
  })
  return { body, header: sign(body) }
}

describe("stripe webhook", () => {
  test("verifyWebhook accepts a valid signed payload", async () => {
    setTestEnv()
    const { body, header } = completedEvent({ id: "cs_123", amount_total: 50, currency: "usd" })
    const event = await verifyWebhook(body, header)
    expect(event.type).toBe("checkout.session.completed")
    expect(isCheckoutCompleted(event)).toBe(true)
  })

  test("verifyWebhook rejects a tampered signature", async () => {
    setTestEnv()
    const { body } = completedEvent({ id: "cs_123" })
    const badHeader = sign(body, "wrong_secret")
    await expect(verifyWebhook(body, badHeader)).rejects.toThrow()
  })

  test("verifyWebhook rejects malformed header", async () => {
    setTestEnv()
    const { body } = completedEvent({ id: "cs_123" })
    await expect(verifyWebhook(body, "garbage")).rejects.toThrow()
  })
})