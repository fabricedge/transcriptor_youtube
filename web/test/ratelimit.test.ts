import { beforeAll, describe, expect, test } from "bun:test"
import { createRateLimiter } from "../src/lib/ratelimit"

describe("createRateLimiter", () => {
  test("allows up to the limit then blocks", () => {
    const rl = createRateLimiter(2, 1000)
    expect(rl.check("ip")).toBe(true)
    expect(rl.check("ip")).toBe(true)
    expect(rl.check("ip")).toBe(false)
    expect(rl.check("other-ip")).toBe(true)
  })

  test("resets clears hits", () => {
    const rl = createRateLimiter(1, 1000)
    expect(rl.check("a")).toBe(true)
    expect(rl.check("a")).toBe(false)
    rl.reset()
    expect(rl.check("a")).toBe(true)
  })
})